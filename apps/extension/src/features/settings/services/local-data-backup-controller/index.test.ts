import { describe, expect, it, vi } from 'vitest';
import { createLocalDataBackupController } from '.';
import { createBackupFixture } from '../../../../domains/local-data/services/local-data-backup/__fixtures__';
import type { ProtectionBackgroundMessageListener } from '../../../protection-runtime/services/protection-background-controller';

describe( 'authenticated local backup messaging', () => {
	it( 'owns settings requests and returns current generation and portable data', async () => {
		const fixture = createBackupFixture();
		const listeners: ProtectionBackgroundMessageListener[] = [];
		const controller = createLocalDataBackupController( {
			backup: fixture.backup, localArea: fixture.area, optionsPageUrl: 'extension://test/options.html',
			onMessage: { addListener: vi.fn( ( listener: ProtectionBackgroundMessageListener ) => {
				listeners.push( listener );
			} ) },
			ready: vi.fn().mockResolvedValue( true ),
		} );
		controller.start();
		controller.start();
		expect( listeners ).toHaveLength( 1 );
		const listener = listeners[ 0 ];
		if ( ! listener ) {
			throw new Error( 'Missing listener.' );
		}
		const sender = { url: 'extension://test/options.html#privacy', frameId: 0,
			tab: { id: 7, incognito: false } };
		const state = await new Promise<unknown>( ( resolve ) => {
			expect( listener( { type: 'read-local-backup-state' }, sender, resolve ) ).toBe( true );
		} );
		expect( state ).toEqual( { status: 'ready', generation: null } );
		const exported = await new Promise<unknown>( ( resolve ) => {
			listener( { type: 'export-local-backup' }, sender, resolve );
		} );
		expect( exported ).toMatchObject( { status: 'available', backup: { application: 'TOCus' } } );
		const imported = await new Promise<unknown>( ( resolve ) => {
			listener( fixture.request, sender, resolve );
		} );
		expect( imported ).toMatchObject( { status: 'completed', requestId: 'request_1' } );
	} );

	it( 'never accepts content documents, subframes, private tabs, or unrelated messages', () => {
		const fixture = createBackupFixture();
		const listeners: ProtectionBackgroundMessageListener[] = [];
		createLocalDataBackupController( {
			backup: fixture.backup, localArea: fixture.area, optionsPageUrl: 'extension://test/options.html',
			onMessage: { addListener: vi.fn( ( listener: ProtectionBackgroundMessageListener ) => {
				listeners.push( listener );
			} ) },
			ready: vi.fn().mockResolvedValue( true ),
		} ).start();
		const listener = listeners[ 0 ];
		if ( ! listener ) {
			throw new Error( 'Missing listener.' );
		}
		for ( const sender of [
			{ url: 'https://example.com/', frameId: 0, tab: { id: 7, incognito: false } },
			{ url: 'extension://test/options.html', frameId: 1, tab: { id: 7, incognito: false } },
			{ url: 'extension://test/options.html', frameId: 0, tab: { id: 7, incognito: true } },
		] ) {
			expect( listener( fixture.request, sender, () => undefined ) ).toBeUndefined();
		}
		expect( fixture.writeCount() ).toBe( 0 );
	} );
} );

/**
 * Exposes authenticated controller dispatch with controllable startup and storage failures.
 * @return Controller dependencies and owned request dispatcher.
 * @since 1.1.0
 */
function controllerFixture() {
	const fixture = createBackupFixture();
	let handler: ProtectionBackgroundMessageListener | undefined;
	const options = { backup: fixture.backup, localArea: fixture.area,
		optionsPageUrl: 'extension://test/options.html', ready: vi.fn().mockResolvedValue( true ),
		onMessage: { addListener: vi.fn( ( listener: ProtectionBackgroundMessageListener ) => {
			handler = listener;
		} ) } };
	createLocalDataBackupController( options ).start();
	/**
	 * Sends one authenticated operation and waits for its response.
	 * @param input - Unknown browser message.
	 * @return Background response.
	 */
	function send( input: unknown ): Promise<unknown> {
		return new Promise( ( resolve ) => {
			handler?.( input, { url: options.optionsPageUrl, frameId: 0, tab: { incognito: false } }, resolve );
		} );
	}
	return { ...fixture, options, send,
		/**
		 * Reads the registered handler for sender and closed-channel checks.
		 * @return Registered controller listener.
		 */
		handler: () => handler,
	};
}

describe( 'backup messaging recovery and validation', () => {
	it( 'validates before invoking recovery that could mutate records', async () => {
		const fixture = controllerFixture();
		await expect( fixture.send( { type: 'import-local-backup' } ) ).resolves.toEqual( { status: 'invalid' } );
		await expect( fixture.send( { type: 'export-local-backup', extra: true } ) ).resolves.toEqual( { status: 'unavailable' } );
		expect( fixture.options.ready ).not.toHaveBeenCalled();
	} );

	it( 'reports pending recovery and contains thrown startup failures', async () => {
		const fixture = controllerFixture();
		fixture.options.ready.mockResolvedValue( false );
		await expect( fixture.send( fixture.request ) ).resolves.toEqual( { status: 'recovery-pending' } );
		await expect( fixture.send( { type: 'read-local-backup-state' } ) ).resolves.toEqual( { status: 'unavailable' } );
		fixture.options.ready.mockRejectedValue( new Error( 'Startup' ) );
		await expect( fixture.send( fixture.request ) ).resolves.toEqual( { status: 'failed' } );
		await expect( fixture.send( { type: 'export-local-backup' } ) ).resolves.toEqual( { status: 'unavailable' } );
	} );

	it( 'reports reset and import barriers, and current completed generation', async () => {
		const fixture = controllerFixture();
		const { BackupImportJournalKey } = await import( '../../../../domains/local-data/types/backup-storage-key' );
		const { LocalDataGenerationStorageKey } = await import( '../../../../domains/local-data/services/local-data-generation' );
		fixture.values[ BackupImportJournalKey ] = {};
		await expect( fixture.send( { type: 'read-local-backup-state' } ) ).resolves.toEqual( { status: 'busy' } );
		Reflect.deleteProperty( fixture.values, BackupImportJournalKey );
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: true };
		await expect( fixture.send( { type: 'read-local-backup-state' } ) ).resolves.toEqual( { status: 'busy' } );
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'done', pending: false };
		await expect( fixture.send( { type: 'read-local-backup-state' } ) ).resolves.toEqual( { status: 'ready', generation: 'done' } );
	} );

	it( 'does not own unknown messages or incomplete browser metadata and survives tab closure', async () => {
		const fixture = controllerFixture();
		const listener = fixture.handler();
		expect( listener?.( { type: 'unknown' }, {}, vi.fn() ) ).toBeUndefined();
		expect( listener?.( fixture.request, { frameId: 0 }, vi.fn() ) ).toBeUndefined();
		expect( listener?.( fixture.request, { frameId: 0, tab: { incognito: false } }, vi.fn() ) ).toBeUndefined();
		const response = vi.fn( () => {
			throw new Error( 'Settings closed' );
		} );
		listener?.( fixture.request,
			{ url: fixture.options.optionsPageUrl, frameId: 0, tab: { incognito: false } },
			response );
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( expect.objectContaining( { status: 'completed' } ) );
		} );
	} );
} );
