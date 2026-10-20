import { describe, expect, it, vi } from 'vitest';
import { createSettingsDataBoundary } from '.';
import { BackupImportJournalKey } from '../../../../domains/local-data/types/backup-storage-key';
import { PreferencesStorageKey } from '../../../../domains/preferences/services/preferences-storage';
import { LocalDataGenerationStorageKey } from '../../../../domains/local-data/services/local-data-generation';
import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import type { PreferencesStorageChangeListener } from '../../../preferences/services/preferences-controller';

describe( 'coherent settings data', () => {
	it( 'blocks mixed reads and notifications, then rebinds before publishing committed preferences', async () => {
		const values: Record<string, unknown> = { [ PreferencesStorageKey.PREFERENCES ]: { theme: 'old' } };
		let sourceListener: PreferencesStorageChangeListener | undefined;
		const onReplaced = vi.fn().mockResolvedValue( undefined );
		const boundary = createSettingsDataBoundary( {
			area: {
				get: vi.fn( ( key: string ) => Promise.resolve( { [ key ]: values[ key ] } ) ),
				set: vi.fn().mockResolvedValue( undefined ),
			},
			changes: {
				addListener: vi.fn( ( listener: PreferencesStorageChangeListener ) => {
					sourceListener = listener;
				} ),
				removeListener: vi.fn(),
			}, onReplaced,
		} );
		const listener = vi.fn();
		boundary.changes.addListener( listener );
		await boundary.area.get( PreferencesStorageKey.PREFERENCES );
		values[ BackupImportJournalKey ] = {};
		values[ PreferencesStorageKey.PREFERENCES ] = { theme: 'new' };
		sourceListener?.( { [ PreferencesStorageKey.PREFERENCES ]: { newValue: values[ PreferencesStorageKey.PREFERENCES ] } }, 'local' );
		await expect( boundary.area.get( PreferencesStorageKey.PREFERENCES ) ).rejects.toThrow();
		expect( listener ).not.toHaveBeenCalled();
		Reflect.deleteProperty( values, BackupImportJournalKey );
		values[ LocalDataGenerationStorageKey ] = { generation: 'import', pending: false, needsOnboarding: false };
		sourceListener?.( { [ BackupImportJournalKey ]: {} }, 'local' );
		await vi.waitFor( () => {
			expect( listener ).toHaveBeenCalled();
		} );
		expect( onReplaced ).toHaveBeenCalledOnce();
		expect( listener.mock.calls[ 0 ]?.[ 0 ] ).toMatchObject( {
			[ PreferencesStorageKey.PREFERENCES ]: { newValue: { theme: 'new' } },
		} );
		expect( onReplaced.mock.invocationCallOrder[ 0 ] ).toBeLessThan( listener.mock.invocationCallOrder[ 0 ] ?? 0 );
		boundary.changes.removeListener( listener );
	} );
} );

/**
 * Builds a controllable raw storage and browser event boundary.
 * @return Stored values, listener dispatch and coherent boundary.
 * @since 1.1.0
 */
function createBoundaryFixture() {
	const values: Record<string, unknown> = {};
	let source: PreferencesStorageChangeListener | undefined;
	const area = {
		get: vi.fn( ( key: string ) => Promise.resolve( { [ key ]: values[ key ] } ) ),
		set: vi.fn().mockResolvedValue( undefined ),
	};
	const changes = { addListener: vi.fn( ( listener: PreferencesStorageChangeListener ) => {
		source = listener;
	} ),
	removeListener: vi.fn() };
	const onReplaced = vi.fn().mockResolvedValue( undefined );
	const boundary = createSettingsDataBoundary( { area, changes, onReplaced } );
	const listener = vi.fn();
	boundary.changes.addListener( listener );
	/**
	 * Publishes one actual browser event into the coherent subscription.
	 * @param areaName - Browser storage area.
	 */
	function emit( areaName = 'local' ): void {
		source?.( {}, areaName );
	}
	return { boundary, values, area, changes, onReplaced, listener, emit,
		/**
		 * Publishes a browser key set for overlapping-event regressions.
		 * @param changes - Storage event payload.
		 */
		emitChanges: ( changes: Parameters<PreferencesStorageChangeListener>[0] ) => {
			source?.( changes, 'local' );
		},
	};
}

describe( 'settings replacement races', () => {
	it( 'rejects reads spanning generations and ignores reset, failed reads and unrelated areas', async () => {
		const fixture = createBoundaryFixture();
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: true };
		await expect( fixture.boundary.area.get( 'value' ) ).rejects.toThrow();
		Reflect.deleteProperty( fixture.values, LocalDataGenerationStorageKey );
		fixture.emit( 'session' );
		expect( fixture.listener ).not.toHaveBeenCalled();
		const read = fixture.area.get.getMockImplementation();
		fixture.area.get.mockImplementation( ( key ) => {
			if ( key === 'value' ) {
				fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'new', pending: false };
			}
			return read?.( key ) ?? Promise.resolve( {} );
		} );
		await expect( fixture.boundary.area.get( 'value' ) ).rejects.toThrow();
		fixture.area.get.mockRejectedValueOnce( new Error( 'Storage failed' ) );
		fixture.emit();
		await Promise.resolve();
		expect( fixture.listener ).not.toHaveBeenCalled();
		await fixture.boundary.area.set( { value: 'saved' } );
		expect( fixture.area.set ).toHaveBeenCalledWith( { value: 'saved' } );
		fixture.boundary.changes.addListener( fixture.listener );
		fixture.boundary.changes.addListener( vi.fn() );
		fixture.boundary.changes.removeListener( fixture.listener );
		expect( fixture.changes.removeListener ).not.toHaveBeenCalled();
	} );

	it( 'publishes only the latest event when reads or editor rebinding overlap', async () => {
		const fixture = createBoundaryFixture();
		await fixture.boundary.area.get( 'value' );
		fixture.emit(); fixture.emit();
		await vi.waitFor( () => {
			expect( fixture.listener ).toHaveBeenCalledTimes( 1 );
		} );
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'import', pending: false };
		const rebinding = Promise.withResolvers<undefined>();
		fixture.onReplaced.mockReturnValueOnce( rebinding.promise );
		fixture.emit();
		await vi.waitFor( () => {
			expect( fixture.onReplaced ).toHaveBeenCalledOnce();
		} );
		fixture.emit();
		rebinding.resolve( undefined );
		await vi.waitFor( () => {
			expect( fixture.listener ).toHaveBeenCalledTimes( 2 );
		} );
	} );
} );

it( 'preserves distinct preference and statistics keys from overlapping storage events', async () => {
	const fixture = createBoundaryFixture();
	await fixture.boundary.area.get( 'value' );
	const { StatisticsStorageKey } = await import( '../../../../domains/statistics/services/statistics-storage' );
	fixture.values[ PreferencesStorageKey.PREFERENCES ] = { theme: 'new' };
	fixture.values[ StatisticsStorageKey.STATISTICS ] = { history: 'new' };
	fixture.emitChanges( { [ PreferencesStorageKey.PREFERENCES ]: { newValue: { theme: 'new' } } } );
	fixture.emitChanges( { [ StatisticsStorageKey.STATISTICS ]: { newValue: { history: 'new' } } } );
	await vi.waitFor( () => {
		expect( fixture.listener ).toHaveBeenCalledWith( expect.objectContaining( {
			[ PreferencesStorageKey.PREFERENCES ]: { newValue: { theme: 'new' } },
			[ StatisticsStorageKey.STATISTICS ]: { newValue: { history: 'new' } },
		} ), 'local' );
	} );
} );

it( 'rebinds editors whose first generation read was blocked by recovery', async () => {
	const fixture = createBoundaryFixture();
	fixture.values[ BackupImportJournalKey ] = {};
	await expect( fixture.boundary.area.get( 'value' ) ).rejects.toThrow();
	Reflect.deleteProperty( fixture.values, BackupImportJournalKey );
	fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'complete', pending: false };
	fixture.emit();
	await vi.waitFor( () => {
		expect( fixture.onReplaced ).toHaveBeenCalledOnce();
	} );
} );

it( 'rereads the complete protected-site configuration after replacement notifications', async () => {
	const fixture = createBoundaryFixture();
	await fixture.boundary.area.get( 'value' );
	fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] = { sites: [ { identityHost: 'restored.example' } ] };
	fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'complete', pending: false };
	fixture.emit();
	await vi.waitFor( () => {
		expect( fixture.listener ).toHaveBeenCalledWith( expect.objectContaining( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: { newValue: { sites: [ { identityHost: 'restored.example' } ] } },
		} ), 'local' );
	} );
} );

it( 'retries queued completion notifications after an older storage read rejects', async () => {
	const fixture = createBoundaryFixture();
	await fixture.boundary.area.get( 'value' );
	const pending = Promise.withResolvers<Record<string, unknown>>();
	fixture.area.get.mockReturnValueOnce( pending.promise );
	fixture.emitChanges( { [ PreferencesStorageKey.PREFERENCES ]: {} } );
	fixture.emitChanges( { [ BackupImportJournalKey ]: {} } );
	pending.reject( new Error( 'Old storage read failed' ) );
	await vi.waitFor( () => {
		expect( fixture.listener ).toHaveBeenCalledWith( expect.objectContaining( {
			[ PreferencesStorageKey.PREFERENCES ]: {}, [ BackupImportJournalKey ]: {},
		} ), 'local' );
	} );
} );
