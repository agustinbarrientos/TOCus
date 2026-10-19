import { describe, expect, it } from 'vitest';
import { StatisticsGenerationIdSchema } from '../../../statistics/types/statistics-value';
import { ProtectionMeasurementRevisionSchema } from '../../../protection/types/protection-value';
import { createBackupSource, createBackupVisitOutcomes } from './__fixtures__';
import { createBackupDocument, createBackupDocuments, parseBackupText } from '.';
import { BackupDocumentSchema } from '../../types/backup-document';

describe( 'portable local backup', () => {
	it( 'round-trips website and hourly aggregates without requiring websites to remain configured', () => {
		const source = createBackupSource();
		const outcomes = createBackupVisitOutcomes();
		Reflect.set( source.statistics, 'visitOutcomes', outcomes );
		const backup = parseBackupText( JSON.stringify( createBackupDocument( source ) ) );
		const imported = createBackupDocuments( backup, {
			dataGeneration: 'data_new', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'stats_new' ),
			measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'revision_new' ),
		} );
		expect( backup.dataFormatVersion ).toBe( '1.1.0' );
		expect( backup.statistics.visitOutcomes ).toEqual( outcomes );
		expect( imported.statistics.visitOutcomes ).toEqual( outcomes );
		expect( imported.statistics.dailyTotals ).toEqual( source.statistics.dailyTotals );
		expect( imported.statistics.lastAppliedBatchId ).toBeNull();
		expect( imported.statistics.scopes.scope_default ).not.toHaveProperty( 'activeAllowance' );
		expect( backup.statistics.visitOutcomes ).not.toBe( outcomes );
	} );

	it( 'keeps legacy statistics fields absent through export parsing and import', () => {
		const source = createBackupSource();
		const backup = parseBackupText( JSON.stringify( createBackupDocument( source ) ) );
		const imported = createBackupDocuments( backup, {
			dataGeneration: 'data_new', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'stats_new' ),
			measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'revision_new' ),
		} );
		expect( Object.hasOwn( backup.statistics, 'visitOutcomes' ) ).toBe( false );
		expect( Object.hasOwn( imported.statistics, 'visitOutcomes' ) ).toBe( false );
		expect( imported.statistics.dailyTotals ).toEqual( source.statistics.dailyTotals );
	} );

	it( 'preserves empty aggregate coverage instead of treating it as legacy missing history', () => {
		const source = createBackupSource();
		const outcomes = { ...createBackupVisitOutcomes(), dailySites: [], dailyHours: [] };
		Reflect.set( source.statistics, 'visitOutcomes', outcomes );
		const backup = parseBackupText( JSON.stringify( createBackupDocument( source ) ) );
		expect( backup.statistics.visitOutcomes ).toEqual( outcomes );
	} );

	it( 'round-trips settings and historical totals without restoring live state', () => {
		const source = createBackupSource();
		const backup = createBackupDocument( source );
		const imported = createBackupDocuments( parseBackupText( JSON.stringify( backup ) ), {
			dataGeneration: 'data_new', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'stats_new' ),
			measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'revision_new' ),
		} );
		expect( imported.configuration.sites ).toEqual( source.configuration.sites );
		expect( imported.configuration.timingConfiguration.initialWaitMilliseconds ).toBe( 20_000 );
		expect( imported.configuration.measurementRevisionsByScope ).toEqual( { scope_default: 'revision_new' } );
		expect( imported.preferences ).toEqual( source.preferences );
		expect( imported.statistics.scopes.scope_default ).toEqual( {
			totals: { estimatedReclaimedMilliseconds: 300_000, focusedPauseMilliseconds: 50_000,
				reconsideredVisitCount: 7, completedWaitCount: 12, allowanceGrantedCount: 10 },
			currentMeasurementRevision: 'revision_new',
		} );
		expect( imported.statistics.dailyTotals ).toEqual( source.statistics.dailyTotals );
		expect( imported.statistics.generationId ).toBe( 'stats_new' );
		expect( imported.statistics.lastAppliedBatchId ).toBeNull();
		expect( Object.keys( backup.settings ) ).toEqual( [ 'sites', 'timingConfiguration', 'schedule' ] );
		expect( Object.keys( backup.preferences ) ).toEqual( [ 'theme', 'palette', 'pauseMode', 'language', 'focusLinks' ] );
		expect( Object.keys( backup.statistics ) ).toEqual( [ 'firstRecordedDate', 'dailyTotals', 'scopes' ] );
		expect( Object.keys( ( backup.statistics.scopes.scope_default ?? {} ) ) ).toEqual( [
			'estimatedReclaimedMilliseconds', 'focusedPauseMilliseconds', 'reconsideredVisitCount',
			'completedWaitCount', 'allowanceGrantedCount',
		] );
		expect( source.statistics.scopes.scope_default?.activeAllowance ).toBeDefined();
	} );

	for ( const mutate of [
		( backup: Record<string, unknown> ) => {
			backup.dataFormatVersion = '9.0.0';
		},
		( backup: Record<string, unknown> ) => {
			backup.dataFormatVersion = 1;
		},
		( backup: Record<string, unknown> ) => {
			backup.application = 'Other';
		},
		( backup: Record<string, unknown> ) => {
			backup.exportedAt = 'yesterday';
		},
		( backup: Record<string, unknown> ) => {
			backup.extra = true;
		},
		( backup: Record<string, unknown> ) => {
			delete backup.settings;
		},
	] ) {
		it( 'rejects malformed and unsupported envelopes before conversion', () => {
			const backup = { ...createBackupDocument( createBackupSource() ) };
			mutate( backup );
			expect( () => parseBackupText( JSON.stringify( backup ) ) ).toThrow();
		} );
	}

	it( 'allows newer exporter releases to use an unchanged format', () => {
		const source = createBackupSource();
		source.extensionVersion = '1.2.7';
		expect( parseBackupText( JSON.stringify( createBackupDocument( source ) ) ).extensionVersion ).toBe( '1.2.7' );
	} );

	it( 'rejects malformed JSON and UTF-8 payloads over ten MiB', () => {
		expect( () => parseBackupText( '{' ) ).toThrow();
		expect( () => parseBackupText( '\u00e9'.repeat( 5 * 1_024 * 1_024 + 1 ) ) ).toThrow( /size/i );
	} );

	it( 'refuses corrupted saved values instead of exporting defaults', () => {
		const source = createBackupSource();
		Reflect.set( source.preferences, 'schemaVersion', 99 );
		expect( () => createBackupDocument( source ) ).toThrow();
	} );

	it( 'preserves historical scope keys without object prototype mutation', () => {
		const source = createBackupSource();
		Object.defineProperty( source.statistics.scopes, '__proto__', {
			value: source.statistics.scopes.scope_default, enumerable: true,
		} );
		const backup = parseBackupText( JSON.stringify( createBackupDocument( source ) ) );
		expect( Object.hasOwn( backup.statistics.scopes, '__proto__' ) ).toBe( true );
		expect( Object.getPrototypeOf( backup.statistics.scopes ) ).toBe( Object.prototype );
		const imported = createBackupDocuments( backup, {
			dataGeneration: 'new_data', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'new_stats' ),
			measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'new_revision' ),
		} );
		expect( Object.getOwnPropertyDescriptor( imported.statistics.scopes, '__proto__' )?.value ).toEqual( {
			totals: { estimatedReclaimedMilliseconds: 300_000, focusedPauseMilliseconds: 50_000,
				reconsideredVisitCount: 7, completedWaitCount: 12, allowanceGrantedCount: 10 },
		} );
	} );

	it( 'keeps empty history and browser-following language valid', () => {
		const source = createBackupSource();
		source.preferences.language = null;
		source.statistics.firstRecordedDate = null;
		source.statistics.dailyTotals = [];
		source.statistics.scopes = {};
		const backup = createBackupDocument( source );
		expect( backup.preferences.language ).toBeNull();
		expect( backup.statistics ).toEqual( { firstRecordedDate: null, dailyTotals: [], scopes: {} } );
	} );

	it( 'rejects invalid history, settings, nested runtime values and record shapes', () => {
		const backup = createBackupDocument( createBackupSource() );
		const day = backup.statistics.dailyTotals[ 0 ];
		if ( ! day ) {
			throw new Error( 'Missing fixture day.' );
		}
		const invalid = [
			{ ...backup, preferences: { ...backup.preferences, theme: 'unknown' } },
			{ ...backup, preferences: { ...backup.preferences, schemaVersion: 3 } },
			{ ...backup, statistics: { ...backup.statistics, activeAllowance: {} } },
			{ ...backup, statistics: { ...backup.statistics, firstRecordedDate: null } },
			{ ...backup, statistics: { ...backup.statistics, dailyTotals: [] } },
			{ ...backup, statistics: { ...backup.statistics, dailyTotals: [ day, day ] } },
			{ ...backup, statistics: { ...backup.statistics,
				dailyTotals: [ ...backup.statistics.dailyTotals ].reverse() } },
			{ ...backup, statistics: { ...backup.statistics, dailyTotals: [ { ...day, date: '2026-02-30' } ] } },
			{ ...backup, statistics: { ...backup.statistics, scopes: null } },
			{ ...backup, statistics: { ...backup.statistics, scopes: [] } },
			{ ...backup, statistics: { ...backup.statistics, scopes: 'wrong' } },
			{ ...backup, statistics: { ...backup.statistics,
				scopes: { '1': backup.statistics.scopes.scope_default } } },
			{ ...backup, statistics: { ...backup.statistics,
				scopes: { scope_default: { ...backup.statistics.scopes.scope_default, completedWaitCount: -1 } } } },
			{ ...backup, statistics: { ...backup.statistics,
				scopes: { scope_default: { ...backup.statistics.scopes.scope_default,
					completedWaitCount: Number.MAX_SAFE_INTEGER + 1 } } } },
			{ ...backup, settings: { ...backup.settings, schedule: { mode: 'custom', windows: [] } } },
			{ ...backup, settings: { ...backup.settings, sites: [ ...backup.settings.sites,
				...backup.settings.sites ] } },
			{ ...backup, settings: { ...backup.settings,
				timingConfiguration: { ...backup.settings.timingConfiguration, initialWaitMilliseconds: 1 } } },
		];
		for ( const input of invalid ) {
			expect( () => parseBackupText( JSON.stringify( input ) ) ).toThrow();
		}
		const customPrototype: unknown = Object.setPrototypeOf( {}, { inherited: {} } );
		expect( BackupDocumentSchema.safeParse( { ...backup, statistics: {
			...backup.statistics, scopes: customPrototype,
		} } ).success ).toBe( false );
		const emptyPrototype: unknown = Object.setPrototypeOf( { ...backup.statistics.scopes }, null );
		expect( BackupDocumentSchema.safeParse( { ...backup, statistics: {
			...backup.statistics, scopes: emptyPrototype,
		} } ).success ).toBe( true );
	} );
} );

it.each( [
	null,
	{},
	{ ...createBackupVisitOutcomes(), recordedFromDate: '2026-02-30' },
	{ ...createBackupVisitOutcomes(), eventLog: [] },
	{ ...createBackupVisitOutcomes(), dailySites: [ {
		...createBackupVisitOutcomes().dailySites[ 0 ], siteHost: 'https://archived.example/private',
	} ] },
	{ ...createBackupVisitOutcomes(), dailySites: [ {
		...createBackupVisitOutcomes().dailySites[ 0 ], visitedAfterPauseCount: -1,
	} ] },
	{ ...createBackupVisitOutcomes(), dailySites: [ {
		...createBackupVisitOutcomes().dailySites[ 0 ], reconsideredVisitCount: Number.MAX_SAFE_INTEGER + 1,
	} ] },
	{ ...createBackupVisitOutcomes(), dailySites: [ ...createBackupVisitOutcomes().dailySites ].reverse() },
	{ ...createBackupVisitOutcomes(), dailySites: Array( 2 ).fill( createBackupVisitOutcomes().dailySites[ 0 ] ) },
	{ ...createBackupVisitOutcomes(), dailyHours: [ {
		...createBackupVisitOutcomes().dailyHours[ 0 ], hour: 24,
	} ] },
	{ ...createBackupVisitOutcomes(), dailyHours: [ ...createBackupVisitOutcomes().dailyHours ].reverse() },
	{ ...createBackupVisitOutcomes(), dailyHours: Array( 2 ).fill( createBackupVisitOutcomes().dailyHours[ 0 ] ) },
] )( 'rejects malformed aggregate history without repairing or dropping it', ( visitOutcomes ) => {
	const backup = createBackupDocument( createBackupSource() );
	expect( () => parseBackupText( JSON.stringify( { ...backup,
		statistics: { ...backup.statistics, visitOutcomes },
	} ) ) ).toThrow();
} );


it( 'round-trips ordered focus destinations without changing the portable format', () => {
	const source = createBackupSource();
	source.preferences.focusLinks = [
		{ id: 'focus_link_tasks', label: 'Tasks', url: 'https://example.com/tasks' },
		{ id: 'focus_link_docs', label: 'Docs', url: 'https://example.com/docs' },
	];
	const backup = parseBackupText( JSON.stringify( createBackupDocument( source ) ) );
	expect( backup.dataFormatVersion ).toBe( '1.1.0' );
	expect( backup.preferences.focusLinks ).toEqual( source.preferences.focusLinks );
	const imported = createBackupDocuments( backup, {
		dataGeneration: 'new_data', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'new_stats' ),
		measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'new_revision' ),
	} );
	expect( imported.preferences.focusLinks ).toEqual( source.preferences.focusLinks );
} );

it( 'restores backups without focus links as empty links while retaining choices and history', () => {
	const source = createBackupSource();
	const legacy = createBackupDocument( source );
	Reflect.deleteProperty( legacy.preferences, 'focusLinks' );
	const backup = parseBackupText( JSON.stringify( legacy ) );
	const imported = createBackupDocuments( backup, {
		dataGeneration: 'new_data', statisticsGeneration: StatisticsGenerationIdSchema.parse( 'new_stats' ),
		measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'new_revision' ),
	} );
	expect( imported.preferences ).toEqual( { ...source.preferences, schemaVersion: 4, focusLinks: [] } );
	expect( imported.statistics.dailyTotals ).toEqual( source.statistics.dailyTotals );
	expect( imported.configuration.sites ).toEqual( source.configuration.sites );
} );

it.each( [ null, {}, [ { id: 'focus_link_bad', label: 'Bad', url: 'javascript:alert(1)' } ] ] )(
	'rejects malformed backup focus links without treating them as absent', ( focusLinks ) => {
		const backup = createBackupDocument( createBackupSource() );
		expect( () => parseBackupText( JSON.stringify( { ...backup,
			preferences: { ...backup.preferences, focusLinks } } ) ) ).toThrow();
	},
);
