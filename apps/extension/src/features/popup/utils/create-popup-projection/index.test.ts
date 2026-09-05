import { describe, expect, it } from 'vitest';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';
import {
	ProtectionStateSchema,
	ProtectionStateType,
	type ProtectionState,
} from '../../../../domains/protection/types/protection-state';
import { DefaultTimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	PopupCurrentSiteAccess,
	PopupCurrentSiteStatus,
	PopupProjectionStatus,
	PopupScheduleStatus,
	PopupScopeKind,
	PopupTimerPhase,
} from '../../types/popup-projection';
import { createPopupProjection } from './index';

const NOW = 1_800_000_000_000;
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';
const CHESS_SCOPE_ID = 'scope_chess';
const TWITCH_SCOPE_ID = 'scope_twitch';

/**
 * Creates one deterministic site configuration used by popup projection tests.
 * @param identityHost - Exact website identity host.
 * @param host - Whole-domain protection boundary.
 * @param scopeId - Scope that owns the website timing state.
 * @return Valid site configuration input.
 * @since 0.1.0 Initial implementation.
 */
function createSite( identityHost: string, host: string, scopeId: string ) {
	return {
		identityHost,
		rule: {
			host,
			includeSubdomains: true,
			scopeId,
		},
	};
}

/**
 * Creates the complete persisted configuration used by popup projection tests.
 * @param inactiveDefaultSchedule - Whether shared timing is inactive at the fixture instant.
 * @return Validated protection configuration.
 * @since 0.1.0 Initial implementation.
 */
function createConfiguration( inactiveDefaultSchedule = false ): ProtectionConfigurationDocument {
	return ProtectionConfigurationDocumentSchema.parse( {
		schemaVersion: 3,
		sites: [
			createSite( 'www.instagram.com', 'instagram.com', DefaultProtectionScopeId ),
			createSite( 'youtube.com', 'youtube.com', DefaultProtectionScopeId ),
			createSite( 'chess.com', 'chess.com', CHESS_SCOPE_ID ),
			createSite( 'twitch.tv', 'twitch.tv', TWITCH_SCOPE_ID ),
		],
		timingConfiguration: DefaultTimingConfiguration,
		schedulesByScope: {
			[ DefaultProtectionScopeId ]: inactiveDefaultSchedule
				? {
					mode: ScheduleMode.CUSTOM,
					windows: [ { weekday: 'Monday', startMinute: 0, endMinute: 1 } ],
				}
				: { mode: ScheduleMode.ALWAYS },
			[ CHESS_SCOPE_ID ]: { mode: ScheduleMode.ALWAYS },
			[ TWITCH_SCOPE_ID ]: { mode: ScheduleMode.ALWAYS },
		},
		measurementRevisionsByScope: {
			[ DefaultProtectionScopeId ]: 'revision_shared',
			[ CHESS_SCOPE_ID ]: 'revision_chess',
			[ TWITCH_SCOPE_ID ]: 'revision_twitch',
		},
	} );
}

/**
 * Creates one validated protection state with deterministic fixture identifiers.
 * @param input - State input accepted by the protection schema.
 * @return Validated protection state.
 * @since 0.1.0 Initial implementation.
 */
function createState( input: unknown ): ProtectionState {
	return ProtectionStateSchema.parse( input );
}

/**
 * Creates an Idle state for one scope.
 * @param scopeId - Scope identifier owned by the state.
 * @param completedWaits - Completed waits in the current daily ladder.
 * @return Validated Idle state.
 * @since 0.1.0 Initial implementation.
 */
function createIdleState( scopeId: string, completedWaits = 0 ): ProtectionState {
	return createState( {
		type: ProtectionStateType.IDLE,
		scopeId,
		ladder: {
			completedWaits,
			greatestObservedLocalDate: '2027-01-15',
		},
	} );
}

/**
 * Creates a Waiting state for one scope and browser tab.
 * @param scopeId - Scope identifier owned by the state.
 * @param tabId - Browser tab retained by the waiting participant.
 * @param destination - Intended protected destination retained by the participant.
 * @return Validated Waiting state.
 * @since 0.1.0 Initial implementation.
 */
function createWaitingState( scopeId: string, tabId: number, destination: string ): ProtectionState {
	return createState( {
		type: ProtectionStateType.WAITING,
		scopeId,
		waitId: `wait_${ scopeId }`,
		capturedWaitDurationMilliseconds: 10_000,
		confirmedFocusedDurationMilliseconds: 2_000,
		participants: [ {
			origin: 'navigation',
			participantId: `participant_${ scopeId }`,
			pageId: `page_tab_${ String( tabId ) }_fixture`,
			retainedDestination: destination,
			focusEligible: true,
			statisticsEligible: true,
			joinSequence: 0,
		} ],
		ownerParticipantId: `participant_${ scopeId }`,
		ownerEpoch: 1,
		checkpointHighWaterMilliseconds: 2_000,
		completionStatisticsEligible: true,
		ladder: {
			completedWaits: 0,
			greatestObservedLocalDate: '2027-01-15',
		},
	} );
}

/**
 * Creates an active Allowance state for one scope.
 * @param scopeId - Scope identifier owned by the state.
 * @param remainingMilliseconds - Remaining wall-clock allowance duration.
 * @return Validated Allowance state.
 * @since 0.1.0 Initial implementation.
 */
function createAllowanceState( scopeId: string, remainingMilliseconds: number ): ProtectionState {
	return createState( {
		type: ProtectionStateType.ALLOWANCE,
		scopeId,
		allowanceId: `allowance_${ scopeId }`,
		completedWaitId: `wait_${ scopeId }`,
		startedAtEpochMilliseconds: NOW + remainingMilliseconds - 300_000,
		expiresAtEpochMilliseconds: NOW + remainingMilliseconds,
		readyParticipants: [],
		ladder: {
			completedWaits: 1,
			greatestObservedLocalDate: '2027-01-15',
		},
	} );
}

/**
 * Creates a complete runtime snapshot for popup projection tests.
 * @param states - Current protection states indexed by scope.
 * @param configuration - Persisted configuration visible to Settings.
 * @param activeConfiguration - Permission-filtered configuration active in the runtime.
 * @return Complete runtime snapshot.
 * @since 0.1.0 Initial implementation.
 */
function createSnapshot(
	states: Readonly<Record<string, ProtectionState>>,
	configuration = createConfiguration(),
	activeConfiguration: ProtectionConfigurationDocument | null = configuration,
) {
	return {
		configuration,
		activeConfiguration,
		statesByScope: states,
		capturedAtEpochMilliseconds: NOW,
		timeZone: 'America/New_York',
	};
}

describe( 'createPopupProjection', () => {
	it( 'returns an unavailable marker when runtime state is unavailable', () => {
		expect( createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: null,
		} ) ).toEqual( { status: PopupProjectionStatus.UNAVAILABLE } );
	} );

	it( 'keeps active scopes visible when current-tab metadata is unavailable', () => {
		const projection = createPopupProjection( {
			currentTab: null,
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createWaitingState(
					DefaultProtectionScopeId,
					11,
					'https://instagram.com/',
				),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: { status: PopupCurrentSiteStatus.UNAVAILABLE },
			activeScopes: [ {
				kind: PopupScopeKind.SHARED,
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 8_000,
				siteCount: 2,
			} ],
		} );
	} );

	it( 'marks browser-controlled pages as unsupported without offering website metadata', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'chrome://extensions/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
		} );
	} );

	it( 'treats private-tab metadata as unsupported even when a URL is present', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: true, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
		} );
	} );

	it( 'returns validated local site metadata for an unconfigured website', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://calm-place.test/articles' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.UNPROTECTED,
				identityHost: 'calm-place.test',
			},
		} );
	} );

	it( 'keeps a configured website managed when browser access is missing', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://www.instagram.com/reels/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot(
				{ [ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId ) },
				createConfiguration(),
				ProtectionConfigurationDocumentSchema.parse( {
					...createConfiguration(),
					sites: [],
					schedulesByScope: {
						[ DefaultProtectionScopeId ]: { mode: ScheduleMode.ALWAYS },
					},
					measurementRevisionsByScope: {
						[ DefaultProtectionScopeId ]: 'revision_shared',
					},
				} ),
			),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				access: PopupCurrentSiteAccess.MISSING,
				site: { identityHost: 'www.instagram.com' },
				scopeId: DefaultProtectionScopeId,
			},
		} );
	} );

	it( 'keeps a configured website managed before navigation capability is granted', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://www.instagram.com/reels/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot(
				{},
				createConfiguration(),
				null,
			),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				access: PopupCurrentSiteAccess.MISSING,
				schedule: PopupScheduleStatus.UNAVAILABLE,
			},
			activeScopes: [],
		} );
	} );

	it( 'reports unavailable schedule state when the runtime time zone is invalid', () => {
		const snapshot = createSnapshot( {} );
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: { ...snapshot, timeZone: 'Not/A_Time_Zone' },
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				schedule: PopupScheduleStatus.UNAVAILABLE,
				nextWaitMilliseconds: null,
			},
		} );
	} );

	it( 'reports when the configured website schedule is inactive', () => {
		const configuration = createConfiguration( true );
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId ),
			}, configuration ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				access: PopupCurrentSiteAccess.GRANTED,
				schedule: PopupScheduleStatus.INACTIVE,
				nextWaitMilliseconds: null,
			},
		} );
	} );

	it( 'reports the next wait for an active idle website scope', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId, 2 ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				access: PopupCurrentSiteAccess.GRANTED,
				schedule: PopupScheduleStatus.ACTIVE,
				nextWaitMilliseconds: 20_000,
			},
		} );
	} );

	it( 'uses the initial wait when a configured scope has not created runtime state yet', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				nextWaitMilliseconds: 10_000,
			},
		} );
	} );

	it( 'resets yesterday\'s ladder before projecting the next wait', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createState( {
					type: ProtectionStateType.IDLE,
					scopeId: DefaultProtectionScopeId,
					ladder: {
						completedWaits: 7,
						greatestObservedLocalDate: '2027-01-14',
					},
				} ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				nextWaitMilliseconds: 10_000,
			},
		} );
	} );

	it( 'shows one shared allowance for every configured website in that scope', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createAllowanceState( DefaultProtectionScopeId, 240_000 ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				scopeId: DefaultProtectionScopeId,
			},
			activeScopes: [ {
				kind: PopupScopeKind.SHARED,
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: NOW + 240_000,
			} ],
		} );
	} );

	it( 'keeps an unexpired allowance visible while its schedule is inactive', () => {
		const configuration = createConfiguration( true );
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createAllowanceState( DefaultProtectionScopeId, 240_000 ),
			}, configuration ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				schedule: PopupScheduleStatus.INACTIVE,
			},
			activeScopes: [ {
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: NOW + 240_000,
			} ],
		} );
	} );

	it( 'treats an expired allowance as the next idle wait instead of an active timer', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://instagram.com/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createAllowanceState( DefaultProtectionScopeId, 0 ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				nextWaitMilliseconds: 15_000,
			},
			activeScopes: [],
		} );
	} );

	it( 'orders the current scope first, then shared timing, then configured independent scopes', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 21, incognito: false, url: 'https://chess.com/play' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createWaitingState(
					DefaultProtectionScopeId,
					11,
					'https://instagram.com/',
				),
				[ TWITCH_SCOPE_ID ]: createAllowanceState( TWITCH_SCOPE_ID, 90_000 ),
				[ CHESS_SCOPE_ID ]: createAllowanceState( CHESS_SCOPE_ID, 120_000 ),
			} ),
		} );

		if ( projection.status !== PopupProjectionStatus.AVAILABLE ) {
			throw new Error( 'Expected an available popup projection.' );
		}

		expect( projection.activeScopes.map( ( scope ) => scope.scopeId ) ).toEqual( [
			CHESS_SCOPE_ID,
			DefaultProtectionScopeId,
			TWITCH_SCOPE_ID,
		] );
		expect( projection.activeScopes[ 0 ] ).toMatchObject( {
			kind: PopupScopeKind.INDEPENDENT,
			site: { identityHost: 'chess.com' },
		} );
	} );

	it( 'recovers the intended website from an interruption-page participant', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 11, incognito: false, url: INTERRUPTION_PAGE_URL },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ DefaultProtectionScopeId ]: createWaitingState(
					DefaultProtectionScopeId,
					11,
					'https://www.instagram.com/reels/',
				),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: {
				status: PopupCurrentSiteStatus.PROTECTED,
				site: {
					identityHost: 'www.instagram.com',
				},
			},
		} );
	} );

	it( 'treats an interruption page without a retained participant as unsupported', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 11, incognito: false, url: INTERRUPTION_PAGE_URL },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
		} );
	} );

	it( 'counts every website intentionally sharing one independent timing scope', () => {
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...createConfiguration(),
			sites: [
				createSite( 'chess.com', 'chess.com', CHESS_SCOPE_ID ),
				createSite( 'lichess.org', 'lichess.org', CHESS_SCOPE_ID ),
			],
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: { mode: ScheduleMode.ALWAYS },
				[ CHESS_SCOPE_ID ]: { mode: ScheduleMode.ALWAYS },
			},
			measurementRevisionsByScope: {
				[ DefaultProtectionScopeId ]: 'revision_shared',
				[ CHESS_SCOPE_ID ]: 'revision_chess',
			},
		} );
		const projection = createPopupProjection( {
			currentTab: { id: 21, incognito: false, url: 'https://chess.com/play' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				[ CHESS_SCOPE_ID ]: createAllowanceState( CHESS_SCOPE_ID, 120_000 ),
			}, configuration ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			activeScopes: [ {
				kind: PopupScopeKind.INDEPENDENT,
				siteCount: 2,
			} ],
		} );
	} );

	it( 'ignores active states that do not belong to the active runtime configuration', () => {
		const projection = createPopupProjection( {
			currentTab: { id: 4, incognito: false, url: 'https://calm-place.test/' },
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			snapshot: createSnapshot( {
				orphaned: createWaitingState( 'scope_orphaned', 31, 'https://orphaned.test/' ),
				[ DefaultProtectionScopeId ]: createIdleState( DefaultProtectionScopeId ),
			} ),
		} );

		expect( projection ).toMatchObject( {
			status: PopupProjectionStatus.AVAILABLE,
			activeScopes: [],
		} );
	} );
} );
