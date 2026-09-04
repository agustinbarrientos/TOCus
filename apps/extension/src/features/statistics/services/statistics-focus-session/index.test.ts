import { describe, expect, it } from 'vitest';
import {
	TEST_SESSION_CONTINUITY_ID,
	createActiveStatisticsDocument,
	createFocusSession,
	createPendingSession,
} from '../statistics-runtime/__fixtures__/documents';
import {
	MemoryStatisticsSessionStorage,
	MemoryStatisticsStorage,
} from '../statistics-runtime/__fixtures__/persistence';
import { createStatisticsFocusSession } from './index';

/**
 * Returns the stable browser-session continuity used by service tests.
 * @return Current fixture continuity identifier.
 * @since 0.1.0 Initial implementation.
 */
function getSessionContinuityId(): typeof TEST_SESSION_CONTINUITY_ID {
	return TEST_SESSION_CONTINUITY_ID;
}

describe( 'statistics focus session', () => {
	it( 'initializes a healthy empty focus session before enabling measurement', async () => {
		const document = createActiveStatisticsDocument();
		const storage = new MemoryStatisticsStorage( document );
		const sessionStorage = new MemoryStatisticsSessionStorage();
		const session = createStatisticsFocusSession( {
			storage,
			sessionStorage,
			getSessionContinuityId,
		} );

		expect( session.isStateKnown() ).toBe( false );
		expect( session.isAvailable() ).toBe( false );
		await expect( session.initialize( document ) ).resolves.toEqual( document );
		expect( session.isStateKnown() ).toBe( true );
		expect( session.isAvailable() ).toBe( true );
	} );

	it( 'replays frozen focus work before enabling another measurement', async () => {
		const startedAtEpochMilliseconds = 1_800_000_100_000;
		const endedAtEpochMilliseconds = 1_800_000_140_000;
		const document = createActiveStatisticsDocument(
			'scope_default',
			'revision_current',
			'allowance_current',
			startedAtEpochMilliseconds - 20_000,
		);
		const storage = new MemoryStatisticsStorage( document );
		const sessionStorage = new MemoryStatisticsSessionStorage(
			createPendingSession(
				startedAtEpochMilliseconds,
				endedAtEpochMilliseconds,
				null,
			),
		);
		const session = createStatisticsFocusSession( {
			storage,
			sessionStorage,
			getSessionContinuityId,
		} );

		const initialized = await session.initialize( document );

		expect( initialized.scopes.scope_default?.activeAllowance ).toMatchObject( {
			confirmedFocusedUseMilliseconds: 40_000,
		} );
		expect( storage.savedDocuments ).toHaveLength( 1 );
		expect( sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( session.isAvailable() ).toBe( true );
	} );

	it( 'discards an unsafe retained anchor before reinitializing', async () => {
		const document = createActiveStatisticsDocument();
		const storage = new MemoryStatisticsStorage( document );
		const sessionStorage = new MemoryStatisticsSessionStorage(
			createFocusSession( 1_800_000_100_000 ),
		);
		const session = createStatisticsFocusSession( {
			storage,
			sessionStorage,
			getSessionContinuityId,
		} );

		session.markUnavailable();
		await expect( session.initialize( document ) ).resolves.toEqual( document );
		expect( sessionStorage.removedDocuments ).toHaveLength( 1 );
		expect( session.isStateKnown() ).toBe( true );
		expect( session.isAvailable() ).toBe( true );
	} );
} );
