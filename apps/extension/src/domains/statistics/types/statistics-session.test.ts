import { describe, expect, it } from 'vitest';
import {
	StatisticsFocusEpochDocumentSchema,
	StatisticsSessionDocumentSchema,
} from './statistics-session';

/**
 * Valid session document carrying one focus anchor and one pending interval.
 * @since 0.1.0 Initial implementation.
 */
const VALID_STATISTICS_SESSION = {
	schemaVersion: 1,
	focusAnchor: {
		sessionContinuityId: 'session_current',
		focusEpochId: 'focus_epoch_current',
		generationId: 'generation_1',
		scopeId: 'scope_default',
		measurementRevision: 'revision_1',
		allowanceId: 'allowance_1',
		focusedAtEpochMilliseconds: 200_000,
	},
	pendingInterval: {
		generationId: 'generation_1',
		scopeId: 'scope_other',
		measurementRevision: 'revision_other',
		allowanceId: 'allowance_other',
		startedAtEpochMilliseconds: 100_000,
		endedAtEpochMilliseconds: 150_000,
	},
};

describe( 'StatisticsSessionDocumentSchema', () => {
	it( 'parses at most one focus anchor and one pending interval', () => {
		expect( StatisticsSessionDocumentSchema.parse( VALID_STATISTICS_SESSION ) ).toEqual(
			VALID_STATISTICS_SESSION,
		);
	} );

	it( 'rejects an unsupported session document version', () => {
		expect( StatisticsSessionDocumentSchema.safeParse( {
			...VALID_STATISTICS_SESSION,
			schemaVersion: 2,
		} ).success ).toBe( false );
	} );

	it( 'rejects a pending interval whose end precedes its start', () => {
		expect( StatisticsSessionDocumentSchema.safeParse( {
			...VALID_STATISTICS_SESSION,
			pendingInterval: {
				...VALID_STATISTICS_SESSION.pendingInterval,
				startedAtEpochMilliseconds: 160_000,
				endedAtEpochMilliseconds: 150_000,
			},
		} ).success ).toBe( false );
	} );

	it( 'rejects a focus anchor without a valid browser-session continuity identifier', () => {
		expect( StatisticsSessionDocumentSchema.safeParse( {
			...VALID_STATISTICS_SESSION,
			focusAnchor: {
				...VALID_STATISTICS_SESSION.focusAnchor,
				sessionContinuityId: '',
			},
		} ).success ).toBe( false );
	} );

	it( 'rejects a focus anchor without a valid focus epoch identifier', () => {
		expect( StatisticsSessionDocumentSchema.safeParse( {
			...VALID_STATISTICS_SESSION,
			focusAnchor: {
				...VALID_STATISTICS_SESSION.focusAnchor,
				focusEpochId: '',
			},
		} ).success ).toBe( false );
	} );

	it( 'omits explicitly undefined optional work fields', () => {
		const result = StatisticsSessionDocumentSchema.parse( {
			schemaVersion: 1,
			focusAnchor: undefined,
			pendingInterval: undefined,
		} );

		expect( Object.hasOwn( result, 'focusAnchor' ) ).toBe( false );
		expect( Object.hasOwn( result, 'pendingInterval' ) ).toBe( false );
	} );
} );

describe( 'StatisticsFocusEpochDocumentSchema', () => {
	it( 'parses one current focus epoch document', () => {
		expect( StatisticsFocusEpochDocumentSchema.parse( {
			schemaVersion: 1,
			focusEpochId: 'focus_epoch_current',
		} ) ).toEqual( {
			schemaVersion: 1,
			focusEpochId: 'focus_epoch_current',
		} );
	} );
} );
