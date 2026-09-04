import { describe, expect, it, vi } from 'vitest';
import {
	createAllowanceState,
	createAllowanceExpiryParticipant,
	createWaitingState,
	TestEmptyProtectionConfiguration,
} from '../../../../domains/protection/types/__fixtures__';
import { ProtectionDecisionType } from '../../../../domains/protection/types/protection-decision';
import { ProtectionParticipantOrigin } from '../../../../domains/protection/types/protection-participant';
import { type ProtectionCoordinatorStateSnapshot } from '../../../../domains/protection/services/protection-coordinator';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ProtectedPageMessageType } from '../../types/protected-page-message';
import { createProtectionPageProjector } from './index';

/**
 * Extension-owned interruption URL used by page-projector tests.
 * @since 0.1.0 Initial implementation.
 */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

describe( 'createProtectionPageProjector', () => {
	it( 'dismisses an orphaned standalone interruption page', async () => {
		const dismissInterruption = vi.fn().mockResolvedValue( undefined );
		const updateProtectedPagePresentation = vi.fn().mockResolvedValue( undefined );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption,
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [ {
					id: 21,
					url: INTERRUPTION_PAGE_URL,
				} ] ),
				navigateTab: vi.fn().mockResolvedValue( undefined ),
				updateProtectedPagePresentation,
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );

		await projector.releaseInterruptionPresentation( 21 );

		expect( dismissInterruption ).toHaveBeenCalledWith( 21 );
		expect( updateProtectedPagePresentation ).not.toHaveBeenCalled();
	} );

	it( 'removes an orphaned interruption layer from its live page', async () => {
		const dismissInterruption = vi.fn().mockResolvedValue( undefined );
		const updateProtectedPagePresentation = vi.fn().mockResolvedValue( undefined );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption,
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [ {
					id: 21,
					url: 'https://example.com/',
				} ] ),
				navigateTab: vi.fn().mockResolvedValue( undefined ),
				updateProtectedPagePresentation,
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );

		await projector.releaseInterruptionPresentation( 21 );

		expect( updateProtectedPagePresentation ).toHaveBeenCalledWith( 21, {
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		} );
		expect( dismissInterruption ).not.toHaveBeenCalled();
	} );

	it( 'ignores an orphaned presentation after its tab has closed', async () => {
		const dismissInterruption = vi.fn().mockResolvedValue( undefined );
		const updateProtectedPagePresentation = vi.fn().mockResolvedValue( undefined );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption,
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [] ),
				navigateTab: vi.fn().mockResolvedValue( undefined ),
				updateProtectedPagePresentation,
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );

		await projector.releaseInterruptionPresentation( 21 );

		expect( dismissInterruption ).not.toHaveBeenCalled();
		expect( updateProtectedPagePresentation ).not.toHaveBeenCalled();
	} );

	it( 'presents expiry-origin waiting over the live document without navigating it', async () => {
		const participant = createAllowanceExpiryParticipant(
			'participant-expiry',
			'page_tab_21_expiry',
			true,
			0,
		);
		const waiting = createWaitingState();
		waiting.scopeId = DefaultProtectionScopeId;
		waiting.participants = [ participant ];
		waiting.ownerParticipantId = participant.participantId;
		const states: ProtectionCoordinatorStateSnapshot = { [ DefaultProtectionScopeId ]: waiting };
		const updateProtectedPagePresentation = vi.fn().mockResolvedValue( undefined );
		const navigateTab = vi.fn().mockResolvedValue( undefined );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption: vi.fn().mockResolvedValue( undefined ),
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [ {
					id: 21,
					incognito: false,
					url: 'https://example.com/unfinished-form',
				} ] ),
				navigateTab,
				updateProtectedPagePresentation,
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );

		await projector.applyDecisions( [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: participant.participantId,
			pageId: participant.pageId,
			waitId: waiting.waitId,
		} ], {
			...TestEmptyProtectionConfiguration,
			sites: [ {
				identityHost: 'example.com',
				rule: {
					host: 'example.com',
					includeSubdomains: true,
					scopeId: DefaultProtectionScopeId,
				},
			} ],
		}, states );

		expect( participant.origin ).toBe( ProtectionParticipantOrigin.ALLOWANCE_EXPIRY );
		expect( navigateTab ).not.toHaveBeenCalled();
		expect( updateProtectedPagePresentation ).toHaveBeenCalledWith( 21, {
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		} );
	} );

	it( 'propagates a failed waiting presentation while its protected page remains live', async () => {
		const participant = createAllowanceExpiryParticipant(
			'participant-expiry',
			'page_tab_21_expiry',
			true,
			0,
		);
		const waiting = createWaitingState();
		waiting.scopeId = DefaultProtectionScopeId;
		waiting.participants = [ participant ];
		waiting.ownerParticipantId = participant.participantId;
		const states: ProtectionCoordinatorStateSnapshot = { [ DefaultProtectionScopeId ]: waiting };
		const error = new Error( 'Waiting presentation unavailable.' );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption: vi.fn().mockResolvedValue( undefined ),
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [ {
					id: 21,
					incognito: false,
					url: 'https://example.com/unfinished-form',
				} ] ),
				navigateTab: vi.fn().mockResolvedValue( undefined ),
				updateProtectedPagePresentation: vi.fn().mockRejectedValue( error ),
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );
		const configuration = {
			...TestEmptyProtectionConfiguration,
			sites: [ {
				identityHost: 'example.com',
				rule: {
					host: 'example.com',
					includeSubdomains: true,
					scopeId: DefaultProtectionScopeId,
				},
			} ],
		};

		await expect( projector.applyDecisions( [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: participant.participantId,
			pageId: participant.pageId,
			waitId: waiting.waitId,
		} ], configuration, states ) ).rejects.toBe( error );
	} );

	it( 'propagates a failed Ready presentation while its protected page remains live', async () => {
		const participant = createAllowanceExpiryParticipant(
			'participant-expiry',
			'page_tab_21_expiry',
			true,
			0,
		);
		const allowance = createAllowanceState();
		allowance.scopeId = DefaultProtectionScopeId;
		allowance.readyParticipants = [ participant ];
		const states: ProtectionCoordinatorStateSnapshot = {
			[ DefaultProtectionScopeId ]: allowance,
		};
		const error = new Error( 'Ready presentation unavailable.' );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption: vi.fn().mockResolvedValue( undefined ),
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [ {
					id: 21,
					incognito: false,
					url: 'https://example.com/unfinished-form',
				} ] ),
				navigateTab: vi.fn().mockResolvedValue( undefined ),
				updateProtectedPagePresentation: vi.fn().mockRejectedValue( error ),
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );
		const configuration = {
			...TestEmptyProtectionConfiguration,
			sites: [ {
				identityHost: 'example.com',
				rule: {
					host: 'example.com',
					includeSubdomains: true,
					scopeId: DefaultProtectionScopeId,
				},
			} ],
		};

		await expect( projector.applyDecisions( [ {
			type: ProtectionDecisionType.PRESENT_READY,
			participantId: participant.participantId,
			pageId: participant.pageId,
			allowanceId: allowance.allowanceId,
		} ], configuration, states ) ).rejects.toBe( error );
	} );

	it.each( [
		[ 'private tab', true ],
		[ 'tab with unknown privacy', undefined ],
	] )( 'does not present an interruption on a %s', async ( _label, incognito ) => {
		const participant = createAllowanceExpiryParticipant(
			'participant-expiry',
			'page_tab_21_expiry',
			true,
			0,
		);
		const waiting = createWaitingState();
		waiting.scopeId = DefaultProtectionScopeId;
		waiting.participants = [ participant ];
		waiting.ownerParticipantId = participant.participantId;
		const states: ProtectionCoordinatorStateSnapshot = { [ DefaultProtectionScopeId ]: waiting };
		const updateProtectedPagePresentation = vi.fn().mockResolvedValue( undefined );
		const navigateTab = vi.fn().mockResolvedValue( undefined );
		const projector = createProtectionPageProjector( {
			browser: {
				dismissInterruption: vi.fn().mockResolvedValue( undefined ),
				getProtectedPagePresentation: vi.fn().mockResolvedValue( null ),
				listTabs: vi.fn().mockResolvedValue( [ {
					id: 21,
					url: 'https://example.com/private',
					...( incognito === undefined ? {} : { incognito } ),
				} ] ),
				navigateTab,
				updateProtectedPagePresentation,
			},
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
		} );

		await projector.applyDecisions( [ {
			type: ProtectionDecisionType.PRESENT_WAITING,
			participantId: participant.participantId,
			pageId: participant.pageId,
			waitId: waiting.waitId,
		} ], {
			...TestEmptyProtectionConfiguration,
			sites: [ {
				identityHost: 'example.com',
				rule: {
					host: 'example.com',
					includeSubdomains: true,
					scopeId: DefaultProtectionScopeId,
				},
			} ],
		}, states );

		expect( navigateTab ).not.toHaveBeenCalled();
		expect( updateProtectedPagePresentation ).not.toHaveBeenCalled();
	} );
} );
