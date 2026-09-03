import { describe, expect, it, vi } from 'vitest';
import {
	createAllowanceExpiryParticipant,
	createNavigationParticipant,
	createWaitingState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type ProtectionParticipant } from '../../../../domains/protection/types/protection-participant';
import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { ProtectionScopeIdSchema } from '../../../../domains/protection/types/protection-value';
import { createProtectionFocusReconciler } from './index';
import { type ProtectionFocusReconcilerOptions } from './types';

/** Extension-owned interruption page used by focus tests. */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/** Protection scope used by focus tests. */
const TEST_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope-default' );

/** Protected-site configuration used by focus tests. */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: TEST_SCOPE_ID,
		},
	} ],
	schedulesByScope: { [ TEST_SCOPE_ID ]: { mode: 'always' } },
};

/**
 * Creates one Waiting state snapshot with the supplied participant.
 * @param participant - Participant retained by the Waiting state.
 * @return Current Waiting state snapshot.
 * @since 0.1.0 Initial implementation.
 */
function createSnapshot(
	participant: ProtectionParticipant,
): ProtectionCoordinatorStateSnapshot {
	const waiting = createWaitingState();
	waiting.participants = [ participant ];

	return { [ TEST_SCOPE_ID ]: waiting };
}

describe( 'createProtectionFocusReconciler', () => {
	it( 'synchronizes a navigation participant while its interruption page remains live', async () => {
		const states = createSnapshot( createNavigationParticipant(
			'participant-navigation',
			'page_tab_7_navigation',
			true,
			0,
			'https://example.com/',
		) );
		const synchronizeParticipantFocus = vi.fn<
			ProtectionFocusReconcilerOptions[ 'synchronizeParticipantFocus' ]
		>().mockResolvedValue( undefined );
		const refreshFocusEffects = vi.fn<
			ProtectionFocusReconcilerOptions[ 'refreshFocusEffects' ]
		>().mockResolvedValue( undefined );
		const reconciler = createProtectionFocusReconciler( {
			browser: { listTabs: vi.fn().mockResolvedValue( [ { id: 7, url: INTERRUPTION_PAGE_URL } ] ) },
			coordinator: { getStates: vi.fn().mockResolvedValue( states ) },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			loadConfiguration: vi.fn().mockResolvedValue( CONFIGURATION ),
			reconcileExpiredAllowances: vi.fn().mockResolvedValue( undefined ),
			reconcileParticipants: vi.fn().mockResolvedValue( undefined ),
			reconcileSchedules: vi.fn().mockResolvedValue( undefined ),
			reconcileUnavailableConfiguration: vi.fn().mockResolvedValue( undefined ),
			refreshFocusEffects,
			synchronizeParticipantFocus,
		} );

		await reconciler.reconcile();

		const call = synchronizeParticipantFocus.mock.calls[ 0 ];

		expect( call?.[ 0 ].participant.participantId ).toBe( 'participant-navigation' );
		expect( call?.[ 1 ] ).toBe( true );
		expect( call?.[ 2 ] ).toBe( CONFIGURATION );
		expect( refreshFocusEffects ).toHaveBeenCalledWith( CONFIGURATION, states );
	} );

	it( 'keeps an allowance-expiry participant available on a protected page in its scope', async () => {
		const states = createSnapshot( createAllowanceExpiryParticipant(
			'participant-expiry',
			'page_tab_7_expiry',
			true,
			0,
		) );
		const synchronizeParticipantFocus = vi.fn<
			ProtectionFocusReconcilerOptions[ 'synchronizeParticipantFocus' ]
		>().mockResolvedValue( undefined );
		const reconciler = createProtectionFocusReconciler( {
			browser: { listTabs: vi.fn().mockResolvedValue( [ { id: 7, url: 'https://example.com/feed' } ] ) },
			coordinator: { getStates: vi.fn().mockResolvedValue( states ) },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			loadConfiguration: vi.fn().mockResolvedValue( CONFIGURATION ),
			reconcileExpiredAllowances: vi.fn().mockResolvedValue( undefined ),
			reconcileParticipants: vi.fn().mockResolvedValue( undefined ),
			reconcileSchedules: vi.fn().mockResolvedValue( undefined ),
			reconcileUnavailableConfiguration: vi.fn().mockResolvedValue( undefined ),
			refreshFocusEffects: vi.fn().mockResolvedValue( undefined ),
			synchronizeParticipantFocus,
		} );

		await reconciler.reconcile();

		expect( synchronizeParticipantFocus ).toHaveBeenCalledWith(
			expect.anything(),
			true,
			CONFIGURATION,
		);
	} );

	it( 'fails open when current configuration is unavailable', async () => {
		const reconcileUnavailableConfiguration = vi.fn().mockResolvedValue( undefined );
		const reconciler = createProtectionFocusReconciler( {
			browser: { listTabs: vi.fn() },
			coordinator: { getStates: vi.fn() },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			loadConfiguration: vi.fn().mockResolvedValue( null ),
			reconcileExpiredAllowances: vi.fn(),
			reconcileParticipants: vi.fn(),
			reconcileSchedules: vi.fn(),
			reconcileUnavailableConfiguration,
			refreshFocusEffects: vi.fn(),
			synchronizeParticipantFocus: vi.fn(),
		} );

		await reconciler.reconcile();

		expect( reconcileUnavailableConfiguration ).toHaveBeenCalledOnce();
	} );
} );
