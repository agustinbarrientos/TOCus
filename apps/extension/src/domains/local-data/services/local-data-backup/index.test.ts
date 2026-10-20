import { describe, expect, it, vi } from 'vitest';
import { createBackupFixture } from './__fixtures__';
import { Palette } from '../../../preferences/types';
import { createBackupDocuments } from '../../utils/backup-document';
import { StatisticsGenerationIdSchema } from '../../../statistics/types/statistics-value';
import { ProtectionMeasurementRevisionSchema } from '../../../protection/types/protection-value';
import { ProtectionConfigurationStorageKey } from '../../../protection/services/protection-configuration-storage';
import { PreferencesStorageKey } from '../../../preferences/services/preferences-storage';
import { StatisticsStorageKey } from '../../../statistics/services/statistics-storage';
import { LocalDataGenerationStorageKey } from '../local-data-generation';
import { BackupImportJournalKey, BackupImportReceiptKey } from '../../types/backup-operation';
import { createBackupVisitOutcomes } from '../../utils/backup-document/__fixtures__';

describe( 'local backup replacement authority', () => {
	it( 'preserves aggregate history through import and rejects changed aggregate replay contents', async () => {
		const fixture = createBackupFixture();
		const outcomes = createBackupVisitOutcomes();
		Reflect.set( fixture.request.backup.statistics, 'visitOutcomes', outcomes );
		await expect( fixture.backup.import( fixture.request ) ).resolves.toMatchObject( { status: 'completed' } );
		expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toMatchObject( { visitOutcomes: outcomes } );
		fixture.values[ StatisticsStorageKey.STATISTICS ] = { newer: 'history' };
		const writes = fixture.writeCount();
		await expect( fixture.restart().import( fixture.request ) ).resolves.toMatchObject( { status: 'completed' } );
		const changed = structuredClone( fixture.request );
		Reflect.set( changed.backup.statistics, 'visitOutcomes', { ...outcomes,
			dailySites: outcomes.dailySites.map( ( item ) => ( { ...item, visitedAfterPauseCount: 2 } ) ),
		} );
		await expect( fixture.restart().import( changed ) ).resolves.toEqual( { status: 'stale' } );
		Reflect.deleteProperty( changed.backup.statistics, 'visitOutcomes' );
		await expect( fixture.restart().import( changed ) ).resolves.toEqual( { status: 'stale' } );
		expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toEqual( { newer: 'history' } );
		expect( fixture.writeCount() ).toBe( writes );
	} );

	it( 'recovers aggregate history from a committed import journal after restart', async () => {
		const fixture = createBackupFixture();
		const outcomes = createBackupVisitOutcomes();
		Reflect.set( fixture.request.backup.statistics, 'visitOutcomes', outcomes );
		fixture.setFailure( 'target' );
		await expect( fixture.backup.import( fixture.request ) ).resolves.toEqual( { status: 'recovery-pending' } );
		expect( fixture.values[ BackupImportJournalKey ] ).toMatchObject( {
			documents: { statistics: { visitOutcomes: outcomes } },
		} );
		fixture.setFailure( '' );
		await expect( fixture.restart().recover() ).resolves.toBe( true );
		expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toMatchObject( { visitOutcomes: outcomes } );
		expect( fixture.values[ BackupImportJournalKey ] ).toBeUndefined();
	} );

	it( 'rejects malformed aggregate history before recording replacement intent', async () => {
		const fixture = createBackupFixture();
		const before = structuredClone( fixture.values );
		Reflect.set( fixture.request.backup.statistics, 'visitOutcomes', null );
		await expect( fixture.backup.import( fixture.request ) ).resolves.toEqual( { status: 'invalid' } );
		expect( fixture.values ).toEqual( before );
		expect( fixture.writeCount() ).toBe( 0 );
	} );

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
		const totals = fixture.request.backup.statistics.scopes.scope_default;
		if ( ! totals ) {
			throw new Error( 'Missing fixture history.' );
		}
		fixture.request.backup.statistics.scopes = Object.fromEntries( [
			[ 'a'.repeat( 10 * 1_024 * 1_024 ), totals ],
		] );
		expect( ( await fixture.backup.import( fixture.request ) ).status ).toBe( 'invalid' );
		expect( fixture.writeCount() ).toBe( 0 );
	} );
} );


it( 'rejects cross-date outcome overflow before persisting import intent', async () => {
	const fixture = createBackupFixture();
	const before = structuredClone( fixture.values );
	Reflect.set( fixture.request.backup.statistics, 'visitOutcomes', {
		recordedFromDate: '2026-10-15', dailyHours: [],
		dailySites: [
			{ date: '2026-10-15', siteHost: 'youtube.com', reconsideredVisitCount: 0,
				visitedAfterPauseCount: Number.MAX_SAFE_INTEGER },
			{ date: '2026-10-16', siteHost: 'youtube.com', reconsideredVisitCount: 0, visitedAfterPauseCount: 1 },
		],
	} );
	await expect( fixture.backup.import( fixture.request ) ).resolves.toEqual( { status: 'invalid' } );
	expect( fixture.writeCount() ).toBe( 0 );
	expect( fixture.values ).toEqual( before );
} );

describe( 'obsolete imported permissions', () => {
	it( 'releases obsolete rules only after committing complete targets and retries interrupted cleanup', async () => {
		const fixture = createBackupFixture();
		const release = vi.fn().mockRejectedValueOnce( new Error( 'Browser unavailable' ) ).mockResolvedValue( undefined );
		fixture.options.releaseObsoleteAccess = release;
		fixture.request.backup.settings.sites = [];
		await expect( fixture.backup.import( fixture.request ) ).resolves.toEqual( { status: 'recovery-pending' } );
		expect( release ).toHaveBeenCalledWith( [ expect.objectContaining( { host: 'youtube.com' } ) ],
			expect.objectContaining( { sites: [] } ) );
		await expect( fixture.restart().recover() ).resolves.toBe( true );
		expect( release ).toHaveBeenCalledTimes( 2 );
	} );
} );


it( 'never reports unchanged data after a committed import with a transient restart failure', async () => {
	const fixture = createBackupFixture();
	fixture.options.resume = vi.fn().mockRejectedValueOnce( new Error( 'Transient restart' ) ).mockResolvedValue( undefined );
	await expect( fixture.backup.import( fixture.request ) ).resolves.toMatchObject( { status: 'completed' } );
} );


it( 'can replace malformed existing settings without guessing which grants they owned', async () => {
	const fixture = createBackupFixture();
	fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] = { malformed: true };
	const release = vi.fn().mockResolvedValue( undefined );
	fixture.options.releaseObsoleteAccess = release;
	await expect( fixture.backup.import( fixture.request ) ).resolves.toMatchObject( { status: 'completed' } );
	expect( release ).toHaveBeenCalledWith( [], expect.objectContaining( { sites: [ expect.anything() ] } ) );
} );


/**
 * Hashes the pre-focus-links wire format retained in existing import metadata.
 * @param backup - Legacy portable backup without a focus links preference.
 * @return Existing receipt fingerprint.
 * @since 1.1.0
 */
async function legacyFingerprint( backup: unknown ): Promise<string> {
	const digest = await crypto.subtle.digest( 'SHA-256', new TextEncoder().encode( JSON.stringify( backup ) ) );
	return Array.from( new Uint8Array( digest ), ( byte ) => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );
}

it.each( [ 'recover', 'retry' ] )( 'finishes legacy version three import journals through %s', async ( mode ) => {
	const fixture = createBackupFixture();
	const legacyBackup = structuredClone( fixture.request.backup );
	Reflect.deleteProperty( legacyBackup.preferences, 'focusLinks' );
	const documents = createBackupDocuments( fixture.request.backup, {
		dataGeneration: 'legacy_data', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'legacy_stats' ),
		measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'legacy_revision' ),
	} );
	Reflect.set( documents.preferences, 'schemaVersion', 3 );
	Reflect.deleteProperty( documents.preferences, 'focusLinks' );
	const hash = await legacyFingerprint( legacyBackup );
	fixture.values[ BackupImportJournalKey ] = {
		requestId: 'request_1', fingerprint: hash, generation: 'legacy_data', documents,
	};
	if ( mode === 'recover' ) {
		expect( await fixture.restart().recover() ).toBe( true );
	} else {
		await expect( fixture.restart().import( { ...fixture.request, backup: legacyBackup } ) ).resolves.toEqual( {
			status: 'completed', requestId: 'request_1', generation: 'legacy_data',
		} );
	}
	expect( fixture.values[ PreferencesStorageKey.PREFERENCES ] ).toMatchObject( {
		schemaVersion: 4, theme: 'dark', palette: 'green', language: 'es-vos', focusLinks: [],
	} );
	expect( fixture.values[ BackupImportReceiptKey ] ).toEqual( {
		requestId: 'request_1', fingerprint: hash, generation: 'legacy_data',
	} );
	expect( fixture.values[ BackupImportJournalKey ] ).toBeUndefined();
	expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).not.toHaveProperty( 'visitOutcomes' );
} );

it( 'deduplicates legacy receipts after absent links normalize to an empty list', async () => {
	const fixture = createBackupFixture();
	const legacyBackup = structuredClone( fixture.request.backup );
	Reflect.deleteProperty( legacyBackup.preferences, 'focusLinks' );
	fixture.values[ BackupImportReceiptKey ] = {
		requestId: 'request_1', fingerprint: await legacyFingerprint( legacyBackup ), generation: 'legacy_data',
	};
	fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'legacy_data', pending: false };
	fixture.values[ StatisticsStorageKey.STATISTICS ] = { newer: 'history' };
	await expect( fixture.backup.import( { ...fixture.request, backup: legacyBackup } ) ).resolves.toEqual( {
		status: 'completed', requestId: 'request_1', generation: 'legacy_data',
	} );
	await expect( fixture.backup.import( { ...fixture.request, backup: {
		...legacyBackup, preferences: { ...legacyBackup.preferences, focusLinks: [] },
	} } ) ).resolves.toMatchObject( { status: 'completed' } );
	await expect( fixture.backup.import( { ...fixture.request, backup: { ...legacyBackup,
		statistics: { ...legacyBackup.statistics, visitOutcomes: {
			...createBackupVisitOutcomes(), dailySites: [], dailyHours: [],
		} },
	} } ) ).resolves.toEqual( { status: 'stale' } );
	expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toEqual( { newer: 'history' } );
	expect( fixture.writeCount() ).toBe( 0 );
} );

it( 'includes ordered links in import receipts and rejects edited or reordered replay contents', async () => {
	const fixture = createBackupFixture();
	const links = [ { id: 'focus_link_tasks', label: 'Tasks', url: 'https://example.com/tasks' },
		{ id: 'focus_link_docs', label: 'Docs', url: 'https://example.com/docs' } ];
	const request = { ...fixture.request, backup: { ...fixture.request.backup,
		preferences: { ...fixture.request.backup.preferences, focusLinks: links } } };
	await expect( fixture.backup.import( request ) ).resolves.toMatchObject( { status: 'completed' } );
	expect( fixture.values[ PreferencesStorageKey.PREFERENCES ] ).toMatchObject( { focusLinks: links } );
	fixture.values[ StatisticsStorageKey.STATISTICS ] = { newer: 'history' };
	await expect( fixture.restart().import( request ) ).resolves.toMatchObject( { status: 'completed' } );
	for ( const focusLinks of [ [], [ ...links ].reverse(), [ { ...links[ 0 ], label: 'Other' }, links[ 1 ] ] ] ) {
		await expect( fixture.restart().import( { ...request, backup: { ...request.backup,
			preferences: { ...request.backup.preferences, focusLinks } } } ) ).resolves.toEqual( { status: 'stale' } );
	}
	expect( fixture.values[ StatisticsStorageKey.STATISTICS ] ).toEqual( { newer: 'history' } );
} );


it( 'preserves unsupported legacy journals for explicit recovery without overwriting raw documents', async () => {
	const fixture = createBackupFixture();
	const documents = createBackupDocuments( fixture.request.backup, {
		dataGeneration: 'legacy_data', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'legacy_stats' ),
		measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'legacy_revision' ),
	} );
	Reflect.set( documents.preferences, 'schemaVersion', 3 );
	Reflect.deleteProperty( documents.preferences, 'focusLinks' );
	Reflect.set( documents.preferences, 'unrecognized', 'preserve me' );
	fixture.values[ BackupImportJournalKey ] = {
		requestId: 'request_1', fingerprint: 'a'.repeat( 64 ), generation: 'legacy_data', documents,
	};
	const before = structuredClone( fixture.values );
	expect( await fixture.restart().recover() ).toBe( false );
	expect( fixture.values ).toEqual( before );
	expect( fixture.writeCount() ).toBe( 0 );
} );


it( 'imports legacy portable data through the authority into current storage', async () => {
	const fixture = createBackupFixture();
	const request = { ...fixture.request, backup: { ...fixture.request.backup, dataFormatVersion: '1.1.0' } };
	await expect( fixture.backup.import( request ) ).resolves.toMatchObject( { status: 'completed' } );
	expect( fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] ).toMatchObject( { schemaVersion: 6 } );
} );

it( 'recovers a strict legacy configuration journal without narrowing its stored rule', async () => {
	const fixture = createBackupFixture();
	fixture.setFailure( 'target' );
	await fixture.backup.import( fixture.request );
	const journal = fixture.values[ BackupImportJournalKey ] as { documents: { configuration: {
		schemaVersion: number; sites: Array<{ identityHost: string; rule: { host: string } }>;
	} } };
	journal.documents.configuration.schemaVersion = 5;
	const first = journal.documents.configuration.sites[ 0 ];
	if ( ! first ) {
		throw new Error( 'Missing journal site.' );
	}
	first.identityHost = `studio.${ first.rule.host }`;
	fixture.setFailure( '' );
	await expect( fixture.restart().recover() ).resolves.toBe( true );
	expect( fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] ).toMatchObject( {
		schemaVersion: 6, sites: journal.documents.configuration.sites,
	} );
} );

it( 'keeps historical receipt fingerprints valid after legacy backup normalization', async () => {
	const fixture = createBackupFixture();
	const legacy = { ...fixture.request.backup, dataFormatVersion: '1.1.0',
		preferences: { ...fixture.request.backup.preferences, focusLinks: undefined } };
	const digest = await crypto.subtle.digest( 'SHA-256', new TextEncoder().encode( JSON.stringify( legacy ) ) );
	const fingerprint = Array.from( new Uint8Array( digest ), ( byte ) => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );
	fixture.values[ BackupImportReceiptKey ] = { requestId: fixture.request.requestId, fingerprint, generation: 'data_old' };
	fixture.values[ LocalDataGenerationStorageKey ] = { generation: 'data_old', pending: false, needsOnboarding: false };
	await expect( fixture.backup.import( fixture.request ) ).resolves.toMatchObject( { status: 'completed' } );
	expect( fixture.writeCount() ).toBe( 0 );
} );
