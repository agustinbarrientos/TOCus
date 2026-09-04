import { describe, expect, it } from 'vitest';
import { createMockActiveStatisticsDocument } from '../../types/__fixtures__';
import { restoreStatisticsSession } from './index';

/**
 * Browser-session continuity used by compatible session fixtures.
 * @since 0.1.0 Initial implementation.
 */
const TEST_SESSION_CONTINUITY_ID = 'session_current';

/**
 * Focus epoch used by compatible session fixtures.
 * @since 0.1.0 Initial implementation.
 */
const TEST_FOCUS_EPOCH_ID = 'focus_epoch_current';

/**
 * Creates one compatible session document with a focus anchor.
 * @return Session document fixture.
 * @since 0.1.0 Initial implementation.
 */
function createSessionDocument(): Record<string, unknown> {
	return {
		schemaVersion: 1,
		focusAnchor: {
			sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
			focusEpochId: TEST_FOCUS_EPOCH_ID,
			generationId: 'generation_1',
			scopeId: 'scope_default',
			measurementRevision: 'revision_1',
			allowanceId: 'allowance_1',
			focusedAtEpochMilliseconds: 200_000,
		},
	};
}

describe( 'restoreStatisticsSession', () => {
	it( 'restores a session whose work matches the active allowance', () => {
		expect( restoreStatisticsSession(
			createSessionDocument(),
			createMockActiveStatisticsDocument(),
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		) ).toEqual( createSessionDocument() );
	} );

	it.each( [
		null,
		{},
		{ ...createSessionDocument(), schemaVersion: 2 },
	] )( 'returns null for absent, malformed, or future session input', ( input ) => {
		expect( restoreStatisticsSession(
			input,
			createMockActiveStatisticsDocument(),
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		) ).toBeNull();
	} );

	it.each( [
		{ generationId: 'generation_old' },
		{ scopeId: 'scope_missing' },
		{ measurementRevision: 'revision_old' },
		{ allowanceId: 'allowance_missing' },
		{ focusedAtEpochMilliseconds: 99_999 },
		{ focusedAtEpochMilliseconds: 400_001 },
	] )( 'returns null for incompatible focus work $generationId$scopeId$measurementRevision$allowanceId$focusedAtEpochMilliseconds', ( override ) => {
		const session = createSessionDocument();
		const focusAnchor = session.focusAnchor;

		if ( typeof focusAnchor !== 'object' || focusAnchor === null ) {
			throw new Error( 'Expected a focus anchor fixture.' );
		}

		expect( restoreStatisticsSession( {
			...session,
			focusAnchor: { ...focusAnchor, ...override },
		}, createMockActiveStatisticsDocument(), TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID ) ).toBeNull();
	} );

	it( 'drops a live focus anchor created by another browser session', () => {
		const session = createSessionDocument();
		const focusAnchor = session.focusAnchor;

		if ( typeof focusAnchor !== 'object' || focusAnchor === null ) {
			throw new Error( 'Expected a focus anchor fixture.' );
		}

		expect( restoreStatisticsSession( {
			...session,
			focusAnchor: { ...focusAnchor, sessionContinuityId: 'session_previous' },
		}, createMockActiveStatisticsDocument(), TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID ) ).toBeNull();
	} );

	it( 'drops a live focus anchor created before an unobserved focus boundary', () => {
		const session = createSessionDocument();
		const focusAnchor = session.focusAnchor;

		if ( typeof focusAnchor !== 'object' || focusAnchor === null ) {
			throw new Error( 'Expected a focus anchor fixture.' );
		}

		expect( restoreStatisticsSession( {
			...session,
			focusAnchor: { ...focusAnchor, focusEpochId: 'focus_epoch_previous' },
		}, createMockActiveStatisticsDocument(), TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID ) ).toBeNull();
	} );

	it( 'restores a compatible pending interval without changing its bounds', () => {
		const session = {
			schemaVersion: 1,
			pendingInterval: {
				generationId: 'generation_1',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_1',
				startedAtEpochMilliseconds: 50_000,
				endedAtEpochMilliseconds: 450_000,
			},
		};

		expect( restoreStatisticsSession(
			session,
			createMockActiveStatisticsDocument(),
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		) ).toEqual( session );
	} );

	it( 'returns null when a pending interval no longer matches an active allowance', () => {
		const session = {
			schemaVersion: 1,
			pendingInterval: {
				generationId: 'generation_1',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_missing',
				startedAtEpochMilliseconds: 100_000,
				endedAtEpochMilliseconds: 150_000,
			},
		};

		expect( restoreStatisticsSession(
			session,
			createMockActiveStatisticsDocument(),
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		) ).toBeNull();
	} );

	it( 'retains a compatible pending interval when the focus anchor is stale', () => {
		const session = {
			schemaVersion: 1,
			focusAnchor: {
				sessionContinuityId: TEST_SESSION_CONTINUITY_ID,
				focusEpochId: TEST_FOCUS_EPOCH_ID,
				generationId: 'generation_old',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_1',
				focusedAtEpochMilliseconds: 200_000,
			},
			pendingInterval: {
				generationId: 'generation_1',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_1',
				startedAtEpochMilliseconds: 150_000,
				endedAtEpochMilliseconds: 200_000,
			},
		};

		expect( restoreStatisticsSession(
			session,
			createMockActiveStatisticsDocument(),
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		) ).toEqual( {
			schemaVersion: 1,
			pendingInterval: session.pendingInterval,
		} );
	} );

	it( 'retains a compatible focus anchor when the pending interval is stale', () => {
		const session = createSessionDocument();

		expect( restoreStatisticsSession( {
			...session,
			pendingInterval: {
				generationId: 'generation_old',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_1',
				startedAtEpochMilliseconds: 150_000,
				endedAtEpochMilliseconds: 200_000,
			},
		}, createMockActiveStatisticsDocument(), TEST_SESSION_CONTINUITY_ID, TEST_FOCUS_EPOCH_ID ) ).toEqual( session );
	} );

	it( 'keeps frozen work while dropping an anchor from another browser session', () => {
		const session = {
			schemaVersion: 1,
			focusAnchor: {
				sessionContinuityId: 'session_previous',
				focusEpochId: TEST_FOCUS_EPOCH_ID,
				generationId: 'generation_1',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_1',
				focusedAtEpochMilliseconds: 200_000,
			},
			pendingInterval: {
				generationId: 'generation_1',
				scopeId: 'scope_default',
				measurementRevision: 'revision_1',
				allowanceId: 'allowance_1',
				startedAtEpochMilliseconds: 150_000,
				endedAtEpochMilliseconds: 200_000,
			},
		};

		expect( restoreStatisticsSession(
			session,
			createMockActiveStatisticsDocument(),
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		) ).toEqual( {
			schemaVersion: 1,
			pendingInterval: session.pendingInterval,
		} );
	} );

	it( 'does not mutate session or local persistence inputs', () => {
		const session = createSessionDocument();
		const document = createMockActiveStatisticsDocument();
		const sessionBefore = structuredClone( session );
		const documentBefore = structuredClone( document );

		restoreStatisticsSession(
			session,
			document,
			TEST_SESSION_CONTINUITY_ID,
			TEST_FOCUS_EPOCH_ID,
		);

		expect( session ).toEqual( sessionBefore );
		expect( document ).toEqual( documentBefore );
	} );
} );
