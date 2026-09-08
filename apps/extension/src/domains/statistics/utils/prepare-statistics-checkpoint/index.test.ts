import { describe, expect, it } from 'vitest';
import type { CanonicalHost } from '../../../protection/types/protected-site-rule';
import {
	AllowanceIdSchema,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
	SessionContinuityIdSchema,
} from '../../../protection/types/protection-value';
import { createMockActiveStatisticsDocument } from '../../types/__fixtures__/statistics-document';
import { StatisticsSessionDocumentSchema } from '../../types/statistics-session';
import { StatisticsFocusEpochIdSchema } from '../../types/statistics-value';
import {
	prepareStatisticsCheckpoint,
	prepareStatisticsPendingReplay,
} from './index';
import {
	MaximumFocusedObservationGapMilliseconds,
	StatisticsFocusObservationMode,
	type StatisticsFocusEpochTransition,
} from './types';

/**
 * Valid allowance identity used by pure checkpoint transition tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_FOCUSED_ALLOWANCE = {
	scopeId: ProtectionScopeIdSchema.parse( 'scope_default' ),
	measurementRevision: ProtectionMeasurementRevisionSchema.parse( 'revision_1' ),
	allowanceId: AllowanceIdSchema.parse( 'allowance_1' ),
};

/**
 * Browser-session continuity used by pure focus-checkpoint fixtures.
 * @since 0.1.0 Initial implementation.
 */
const TEST_SESSION_CONTINUITY_ID = SessionContinuityIdSchema.parse( 'session_current' );

/**
 * Current focus epoch used by pure focus-checkpoint fixtures.
 * @since 0.1.0 Initial implementation.
 */
const TEST_FOCUS_EPOCH_ID = StatisticsFocusEpochIdSchema.parse( 'focus_epoch_current' );

/**
 * Next focus epoch used by browser-boundary fixtures.
 * @since 0.1.0 Initial implementation.
 */
const TEST_NEXT_FOCUS_EPOCH_ID = StatisticsFocusEpochIdSchema.parse( 'focus_epoch_next' );

/**
 * Creates one focus epoch transition for a checkpoint observation.
 * @param mode - Kind of browser observation being prepared.
 * @param previousFocusEpochId - Focus epoch before this observation.
 * @param currentFocusEpochId - Focus epoch after this observation.
 * @return Focus epoch transition fixture.
 * @since 0.1.0 Initial implementation.
 */
function createFocusEpochTransition(
	mode: StatisticsFocusEpochTransition['mode'] = StatisticsFocusObservationMode.SAMPLE,
	previousFocusEpochId: StatisticsFocusEpochTransition['previousFocusEpochId'] = TEST_FOCUS_EPOCH_ID,
	currentFocusEpochId: StatisticsFocusEpochTransition['currentFocusEpochId'] = TEST_FOCUS_EPOCH_ID,
): StatisticsFocusEpochTransition {
	return { mode, previousFocusEpochId, currentFocusEpochId };
}

/**
 * Creates one compatible focus-work session for pure transition tests.
 * @param focusedAtEpochMilliseconds - Current anchor start.
 * @param pendingEndEpochMilliseconds - Optional frozen interval end.
 * @param sessionContinuityId - Browser-session continuity identifier.
 * @param focusEpochId - Persisted focus epoch identifier.
 * @param siteHost - Optional protected-rule host retained by current focus work.
 * @return Valid session focus work.
 * @since 0.1.0 Initial implementation.
 */
function createSession(
	focusedAtEpochMilliseconds: number,
	pendingEndEpochMilliseconds?: number,
	sessionContinuityId = TEST_SESSION_CONTINUITY_ID,
	focusEpochId = TEST_FOCUS_EPOCH_ID,
	siteHost?: CanonicalHost,
) {
	const identity = {
		generationId: 'generation_1',
		scopeId: 'scope_default',
		measurementRevision: 'revision_1',
		allowanceId: 'allowance_1',
		...( siteHost === undefined ? {} : { siteHost } ),
	};

	return StatisticsSessionDocumentSchema.parse( {
		schemaVersion: 1,
		focusAnchor: {
			...identity,
			sessionContinuityId,
			focusEpochId,
			focusedAtEpochMilliseconds,
		},
		...( pendingEndEpochMilliseconds === undefined
			? {}
			: {
				pendingInterval: {
					...identity,
					startedAtEpochMilliseconds: focusedAtEpochMilliseconds,
					endedAtEpochMilliseconds: pendingEndEpochMilliseconds,
				},
			} ),
	} );
}

describe( 'prepare statistics checkpoint', () => {
	it( 'keeps the protected-site host on the anchor and frozen interval', () => {
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession(
				150_000, undefined, TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID, 'example.com',
			),
			focusedAllowance: { ...TEST_FOCUSED_ALLOWANCE, siteHost: 'example.com' },
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession?.pendingInterval ).toMatchObject( {
			siteHost: 'example.com',
			startedAtEpochMilliseconds: 150_000,
			endedAtEpochMilliseconds: 200_000,
		} );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			siteHost: 'example.com',
			focusedAtEpochMilliseconds: 200_000,
		} );
	} );

	it.each( [ 'example.com', undefined ] )(
		'does not charge a sample when the same allowance changes from site %s',
		( siteHost ) => {
			const document = createMockActiveStatisticsDocument();
			const prepared = prepareStatisticsCheckpoint( {
				sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
				focusEpochTransition: createFocusEpochTransition(),
				statisticsDocument: document,
				statisticsSession: createSession(
					150_000, undefined, TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID, siteHost,
				),
				focusedAllowance: { ...TEST_FOCUSED_ALLOWANCE, siteHost: 'other.example' },
				focusedAtEpochMilliseconds: 200_000,
				nowEpochMilliseconds: 200_000,
			} );

			expect( prepared.writeAheadSession ).toBeUndefined();
			expect( prepared.statisticsDocument ).toEqual( document );
			expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
				siteHost: 'other.example',
				focusedAtEpochMilliseconds: 200_000,
			} );
		},
	);

	it( 'charges the old site through a boundary and replays it independently of the new site anchor', () => {
		const document = createMockActiveStatisticsDocument();
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(
				StatisticsFocusObservationMode.BOUNDARY,
				TEST_FOCUS_EPOCH_ID,
				TEST_NEXT_FOCUS_EPOCH_ID,
			),
			statisticsDocument: document,
			statisticsSession: createSession(
				150_000, undefined, TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID, 'example.com',
			),
			focusedAllowance: { ...TEST_FOCUSED_ALLOWANCE, siteHost: 'other.example' },
			focusedAtEpochMilliseconds: 230_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession?.pendingInterval ).toMatchObject( {
			siteHost: 'example.com',
			startedAtEpochMilliseconds: 150_000,
			endedAtEpochMilliseconds: 200_000,
		} );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			siteHost: 'other.example',
			focusEpochId: TEST_NEXT_FOCUS_EPOCH_ID,
			focusedAtEpochMilliseconds: 230_000,
		} );

		if ( prepared.writeAheadSession === undefined ) {
			throw new Error( 'Expected a frozen interval to replay.' );
		}

		const replayed = prepareStatisticsPendingReplay( {
			statisticsDocument: document,
			statisticsSession: prepared.writeAheadSession,
		} );

		expect( replayed.statisticsDocument ).toEqual( prepared.statisticsDocument );
		expect( replayed.statisticsDocument.scopes.scope_default?.activeAllowance ).toMatchObject( {
			confirmedFocusedUseMilliseconds: 50_000,
			focusedUseBySite: { 'example.com': 50_000 },
		} );
		expect( replayed.statisticsSession ).toEqual( prepared.finalSession );

		const replayedAgain = prepareStatisticsPendingReplay( {
			statisticsDocument: replayed.statisticsDocument,
			statisticsSession: prepared.writeAheadSession,
		} );

		expect( replayedAgain.statisticsDocument ).toEqual( replayed.statisticsDocument );
	} );

	it( 'replaces a startup anchor after a site change within the same allowance', () => {
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition( StatisticsFocusObservationMode.STARTUP ),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession(
				150_000, undefined, TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID, 'example.com',
			),
			focusedAllowance: { ...TEST_FOCUSED_ALLOWANCE, siteHost: 'other.example' },
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession ).toBeUndefined();
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			siteHost: 'other.example',
			focusedAtEpochMilliseconds: 200_000,
		} );
	} );

	it( 'prepares a write-ahead interval, next anchor, and aggregated document', () => {
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession( 150_000 ),
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession?.pendingInterval ).toMatchObject( {
			startedAtEpochMilliseconds: 150_000,
			endedAtEpochMilliseconds: 200_000,
		} );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			focusedAtEpochMilliseconds: 200_000,
		} );
		expect(
			prepared.statisticsDocument.scopes.scope_default?.activeAllowance,
		).toMatchObject( {
			confirmedFocusedUseMilliseconds: 50_000,
			accountedThroughEpochMilliseconds: 200_000,
		} );
		expect( prepared.shouldSaveStatistics ).toBe( true );
		expect( prepared.shouldPersistFinalSession ).toBe( true );
	} );

	it( 'discards a backward interval while preparing only a fresh anchor', () => {
		const document = createMockActiveStatisticsDocument();
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: document,
			statisticsSession: createSession( 250_000 ),
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession ).toBeUndefined();
		expect( prepared.statisticsDocument ).toEqual( document );
		expect( prepared.shouldSaveStatistics ).toBe( false );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			focusedAtEpochMilliseconds: 200_000,
		} );
	} );

	it( 'discards an unobservably long interval while preparing only a fresh anchor', () => {
		const document = createMockActiveStatisticsDocument();
		const nowEpochMilliseconds = 100_000 + MaximumFocusedObservationGapMilliseconds + 1;
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: document,
			statisticsSession: createSession( 100_000 ),
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: nowEpochMilliseconds,
			nowEpochMilliseconds,
		} );

		expect( prepared.writeAheadSession ).toBeUndefined();
		expect( prepared.statisticsDocument ).toEqual( document );
		expect( prepared.shouldSaveStatistics ).toBe( false );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			focusedAtEpochMilliseconds: nowEpochMilliseconds,
		} );
	} );

	it( 'does not rewrite absent session state after expiry-only local work', () => {
		const preparedAbsent = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: null,
			focusedAllowance: null,
			focusedAtEpochMilliseconds: 400_000,
			nowEpochMilliseconds: 400_000,
		} );
		const preparedStoredEmpty = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: StatisticsSessionDocumentSchema.parse( { schemaVersion: 1 } ),
			focusedAllowance: null,
			focusedAtEpochMilliseconds: 400_000,
			nowEpochMilliseconds: 400_000,
		} );

		expect( preparedAbsent.shouldSaveStatistics ).toBe( true );
		expect( preparedAbsent.shouldPersistFinalSession ).toBe( false );
		expect( preparedStoredEmpty.shouldPersistFinalSession ).toBe( true );
	} );

	it( 'rejects a checkpoint until previously frozen work is replayed', () => {
		expect( () => prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession( 150_000, 200_000 ),
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} ) ).toThrow( 'Statistics checkpoint requires pending work to be replayed first.' );
	} );

	it( 'charges a prior anchor through an exact browser boundary before starting the next epoch', () => {
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(
				StatisticsFocusObservationMode.BOUNDARY,
				TEST_FOCUS_EPOCH_ID,
				TEST_NEXT_FOCUS_EPOCH_ID,
			),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession( 150_000 ),
			focusedAllowance: null,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession?.pendingInterval ).toMatchObject( {
			startedAtEpochMilliseconds: 150_000,
			endedAtEpochMilliseconds: 200_000,
		} );
		expect( prepared.finalSession ).toBeNull();
	} );

	it( 'closes at event ingress and opens only after asynchronous focus inspection', () => {
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(
				StatisticsFocusObservationMode.BOUNDARY,
				TEST_FOCUS_EPOCH_ID,
				TEST_NEXT_FOCUS_EPOCH_ID,
			),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession( 150_000 ),
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 230_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession?.pendingInterval ).toMatchObject( {
			startedAtEpochMilliseconds: 150_000,
			endedAtEpochMilliseconds: 200_000,
		} );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			focusEpochId: TEST_NEXT_FOCUS_EPOCH_ID,
			focusedAtEpochMilliseconds: 230_000,
		} );
	} );

	it( 'rejects a focus timestamp that predates its event boundary', () => {
		expect( () => prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: null,
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 199_999,
			nowEpochMilliseconds: 200_000,
		} ) ).toThrow( 'Statistics focus cannot begin before its checkpoint boundary.' );
	} );

	it( 'preserves a compatible anchor across startup without charging the activation gap', () => {
		const document = createMockActiveStatisticsDocument();
		const session = createSession( 150_000 );
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(
				StatisticsFocusObservationMode.STARTUP,
				null,
				TEST_FOCUS_EPOCH_ID,
			),
			statisticsDocument: document,
			statisticsSession: session,
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession ).toBeUndefined();
		expect( prepared.statisticsDocument ).toEqual( document );
		expect( prepared.finalSession ).toEqual( session );
		expect( prepared.shouldSaveStatistics ).toBe( false );
	} );

	it( 'does not charge a sample when focus no longer matches the prior anchor', () => {
		const document = createMockActiveStatisticsDocument();
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: document,
			statisticsSession: createSession( 150_000 ),
			focusedAllowance: null,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession ).toBeUndefined();
		expect( prepared.statisticsDocument ).toEqual( document );
		expect( prepared.finalSession ).toBeNull();
	} );

	it.each( [
		{
			name: 'browser session',
			session: createSession( 150_000, undefined, SessionContinuityIdSchema.parse( 'session_previous' ) ),
		},
		{
			name: 'focus epoch',
			session: createSession(
				150_000,
				undefined,
				TEST_SESSION_CONTINUITY_ID,
				StatisticsFocusEpochIdSchema.parse( 'focus_epoch_previous' ),
			),
		},
	] )( 'does not charge a sample from another $name', ( { session } ) => {
		const document = createMockActiveStatisticsDocument();
		const prepared = prepareStatisticsCheckpoint( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochTransition: createFocusEpochTransition(),
			statisticsDocument: document,
			statisticsSession: session,
			focusedAllowance: TEST_FOCUSED_ALLOWANCE,
			focusedAtEpochMilliseconds: 200_000,
			nowEpochMilliseconds: 200_000,
		} );

		expect( prepared.writeAheadSession ).toBeUndefined();
		expect( prepared.statisticsDocument ).toEqual( document );
		expect( prepared.finalSession?.focusAnchor ).toMatchObject( {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochId: TEST_FOCUS_EPOCH_ID,
			focusedAtEpochMilliseconds: 200_000,
		} );
	} );
} );

describe( 'prepare statistics pending replay', () => {
	it( 'applies frozen work and retains only the captured next anchor', () => {
		const prepared = prepareStatisticsPendingReplay( {
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession( 150_000, 200_000 ),
		} );

		expect(
			prepared.statisticsDocument.scopes.scope_default?.activeAllowance,
		).toMatchObject( { confirmedFocusedUseMilliseconds: 50_000 } );
		expect( prepared.statisticsSession ).toEqual( createSession( 150_000 ) );
		expect( prepared.statisticsSession?.pendingInterval ).toBeUndefined();
	} );

	it( 'rejects replay state without a frozen interval', () => {
		expect( () => prepareStatisticsPendingReplay( {
			statisticsDocument: createMockActiveStatisticsDocument(),
			statisticsSession: createSession( 150_000 ),
		} ) ).toThrow( 'Statistics pending replay requires a frozen interval.' );
	} );
} );
