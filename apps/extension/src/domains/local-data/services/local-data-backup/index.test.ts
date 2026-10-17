import { describe, expect, it, vi } from 'vitest';
import { createBackupFixture } from './__fixtures__';
import { Palette } from '../../../preferences/types';
import { ProtectionConfigurationStorageKey } from '../../../protection/services/protection-configuration-storage';
import { PreferencesStorageKey } from '../../../preferences/services/preferences-storage';
import { StatisticsStorageKey } from '../../../statistics/services/statistics-storage';
import { LocalDataGenerationStorageKey } from '../local-data-generation';
import { BackupImportJournalKey, BackupImportReceiptKey } from '../../types/backup-operation';

describe( 'local backup replacement authority', () => {
	it( 'replaces settings and history with fresh identities while preserving unrelated data', async () => {
		const fixture = createBackupFixture();
		fixture.request.backup.preferences.palette = Palette.PINK;
		const result = await fixture.backup.import( fixture.request );
		expect( result.status ).toBe( 'completed' );
		expect( fixture.values[ PreferencesStorageKey.PREFERENCES ] ).toMatchObject( { palette: 'pink' } );
		expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toMatchObject( {
			generationId: 'id_2', lastAppliedBatchId: null,
			scopes: { scope_default: { currentMeasurementRevision: 'id_3', totals: { completedWaitCount: 12 } } },
		} );
		expect( fixture.values[ LocalDataGenerationStorageKey ] ).toEqual( {
			generation: 'id_1', pending: false, needsOnboarding: false,
		} );
		expect( fixture.values[ BackupImportJournalKey ] ).toBeUndefined();
		expect( fixture.values.unrelated ).toBe( 'preserved' );
		expect( fixture.isSuspended() ).toBe( false );
	} );

	it( 'rejects unsupported input and stale confirmations without changing storage', async () => {
		const fixture = createBackupFixture();
		const original = structuredClone( fixture.values );
		expect( ( await fixture.backup.import( { ...fixture.request, backup: {} } ) ).status ).toBe( 'invalid' );
		expect( ( await fixture.backup.import( { ...fixture.request, expectedGeneration: 'old' } ) ).status ).toBe( 'stale' );
		expect( fixture.values ).toEqual( original );
		expect( fixture.writeCount() ).toBe( 0 );
	} );

	for ( const phase of [ 'suspend', 'journal' ] ) {
		it( `resumes original protection after ${ phase } fails before committing`, async () => {
			const fixture = createBackupFixture();
			const original = structuredClone( fixture.values );
			fixture.setFailure( phase );
			expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'failed' );
			expect( fixture.values ).toEqual( original );
			expect( fixture.isSuspended() ).toBe( false );
		} );
	}

	for ( const phase of [ 'target', 'target-response', 'journal-response', 'remove' ] ) {
		it( `recovers a complete replacement after ${ phase } fails past the commit point`, async () => {
			const fixture = createBackupFixture();
			fixture.setFailure( phase );
			expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'recovery-pending' );
			expect( fixture.values[ BackupImportJournalKey ] ).toBeDefined();
			fixture.setFailure( '' );
			expect( await fixture.restart().recover() ).toBe( true );
			expect( fixture.values[ BackupImportJournalKey ] ).toBeUndefined();
			expect( fixture.values[ BackupImportReceiptKey ] ).toMatchObject( { requestId: 'request_1' } );
			expect( fixture.values[ LocalDataGenerationStorageKey ] ).toMatchObject( { generation: 'id_1' } );
		} );
	}

	it( 'does not replace newer statistics when a completed request is retried after restart', async () => {
		const fixture = createBackupFixture();
		const first = await fixture.backup.import( fixture.request );
		fixture.values[ StatisticsStorageKey.STATISTICS ] = { newer: 'history' };
		const before = fixture.writeCount();
		expect( await fixture.restart().import( fixture.request ) ).toEqual( first );
		expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toEqual( { newer: 'history' } );
		expect( fixture.writeCount() ).toBe( before );
	} );

	it( 'refuses replay when reset intent exists and never resurrects its staged data', async () => {
		const fixture = createBackupFixture();
		fixture.setFailure( 'target' );
		await fixture.backup.import( fixture.request );
		fixture.setFailure( '' );
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'reset_new', pending: true };
		const before = structuredClone( fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] );
		expect( await fixture.restart().recover() ).toBe( false );
		expect( fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] ).toEqual( before );
		expect( fixture.values[ BackupImportJournalKey ] ).toBeUndefined();
	} );

	it( 'exports history without suspending current browsing', async () => {
		const fixture = createBackupFixture();
		const result = await fixture.backup.export();
		expect( result.status ).toBe( 'available' );
		expect( fixture.isSuspended() ).toBe( false );
		expect( fixture.writeCount() ).toBe( 0 );
	} );

	it( 'joins duplicate confirmations and rejects a different payload under a completed identity', async () => {
		const fixture = createBackupFixture();
		const results = await Promise.all( [ fixture.backup.import( fixture.request ),
			fixture.backup.import( fixture.request ) ] );
		expect( results[ 0 ] ).toEqual( results[ 1 ] );
		expect( fixture.writeCount() ).toBe( 2 );
		const changed = structuredClone( fixture.request );
		changed.backup.preferences.palette = Palette.BLUE;
		expect( ( await fixture.backup.import( changed ) ).status ).toBe( 'stale' );
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'later_reset', pending: false };
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'stale' );
	} );

	it( 'accepts a newly confirmed replacement of the current generation', async () => {
		const fixture = createBackupFixture();
		await fixture.backup.import( fixture.request );
		const exported = await fixture.backup.export();
		expect( exported ).toMatchObject( { status: 'available', generation: 'id_1' } );
		const next = { ...fixture.request, requestId: 'request_2', expectedGeneration: 'id_1' };
		expect( ( await fixture.backup.import( next ) ).status ).toBe( 'completed' );
		expect( fixture.values[ LocalDataGenerationStorageKey ] ).toMatchObject( { generation: 'id_4' } );
	} );

	it( 'keeps a pending journal exclusive while allowing its own request to finish', async () => {
		const fixture = createBackupFixture();
		fixture.setFailure( 'target' );
		await fixture.backup.import( fixture.request );
		expect( ( await fixture.backup.export() ).status ).toBe( 'busy' );
		expect( ( await fixture.backup.import( { ...fixture.request, requestId: 'other' } ) ).status ).toBe( 'busy' );
		fixture.setFailure( '' );
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'completed' );
	} );

	it( 'keeps import and export blocked while a full reset is pending', async () => {
		const fixture = createBackupFixture();
		fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: true };
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'busy' );
		expect( ( await fixture.backup.export() ).status ).toBe( 'busy' );
	} );

	it( 'retries resumption without replaying committed history after a runtime failure', async () => {
		const fixture = createBackupFixture();
		fixture.setFailure( 'resume' );
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'recovery-pending' );
		expect( ( await fixture.backup.export() ).status ).toBe( 'busy' );
		fixture.setFailure( '' );
		const writes = fixture.writeCount();
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'completed' );
		expect( fixture.writeCount() ).toBe( writes );
		expect( fixture.isSuspended() ).toBe( false );
	} );

	it( 'fails safely on corrupt metadata and snapshot or storage read failures', async () => {
		const fixture = createBackupFixture();
		expect( await fixture.backup.recover() ).toBe( true );
		fixture.values[ BackupImportReceiptKey ] = { malformed: true };
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'failed' );
		fixture.values[ BackupImportJournalKey ] = { malformed: true };
		expect( await fixture.backup.recover() ).toBe( false );
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'recovery-pending' );
		Reflect.deleteProperty( fixture.values, BackupImportJournalKey );
		fixture.options.snapshot = vi.fn().mockRejectedValue( new Error( 'Snapshot unavailable.' ) );
		expect( ( await fixture.backup.export() ).status ).toBe( 'unavailable' );
		vi.spyOn( fixture.area, 'get' ).mockRejectedValue( new Error( 'Storage unavailable.' ) );
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'recovery-pending' );
		expect( await fixture.backup.recover() ).toBe( false );
		expect( ( await fixture.backup.export() ).status ).toBe( 'unavailable' );
	} );

	it( 'keeps recovery pending if startup cleanup fails and can resume a completed target', async () => {
		const fixture = createBackupFixture();
		fixture.setFailure( 'target' );
		await fixture.backup.import( fixture.request );
		fixture.setFailure( 'suspend' );
		expect( await fixture.restart().recover() ).toBe( false );
		fixture.setFailure( 'resume' );
		expect( await fixture.backup.recover() ).toBe( false );
		fixture.setFailure( '' );
		expect( await fixture.backup.recover() ).toBe( true );
	} );

	it( 'rejects oversized valid structures before creating any durable intent', async () => {
		const fixture = createBackupFixture();
		fixture.request.backup.statistics.scopes = Object.fromEntries( [
			[ 'a'.repeat( 10 * 1_024 * 1_024 ), fixture.request.backup.statistics.scopes.scope_default ],
		] );
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'invalid' );
		expect( fixture.writeCount() ).toBe( 0 );
	} );
} );
