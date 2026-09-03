import { describe, expect, it, vi } from 'vitest';
import {
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

/** Extension-owned interruption URL used by page-projector tests. */
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
} );
