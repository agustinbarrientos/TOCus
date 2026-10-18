import { describe, expect, it, vi } from 'vitest';
import { DefaultPreferencesDocument, type PreferencesDocument } from '../../../../domains/preferences/types';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { ProtectionFactType } from '../../../../domains/protection/types/protection-fact';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { InterruptionPageRequestType, InterruptionPageResponseState } from '../../types/runtime-message';
import { ProtectionRuntimeNavigationPhase } from '../../types/browser-runtime';
import {
	DeferredPromise, EXAMPLE_CONFIGURATION, MemoryConfigurationStorage, MemoryRuntimeBrowser,
	completeFocusedPause, createRuntime, presentAllowanceExpiryInterruption,
} from './__fixtures__';

const FOCUS_LINK = { id: 'focus_link_reading', label: 'Read a chapter', url: 'https://reading.test/book?private=1#chapter' };
const REQUEST = { type: 'open-focus-link', focusLinkId: FOCUS_LINK.id, documentVisible: true };

/**
 * Creates authoritative runtime state with locally configured focus links.
 * @param preferences - Local preferences document returned by storage.
 * @param automatic - Whether pause completion normally opens the protected page automatically.
 * @return Runtime, persistence, and browser effects under test.
 * @since 1.1.0
 */
function createFocusLinkHarness( preferences: PreferencesDocument | null = {
	...DefaultPreferencesDocument, focusLinks: [ FOCUS_LINK ],
}, automatic = false ) {
	const now = { value: Date.UTC( 2026, 8, 2, 12 ) };
	const browser = new MemoryRuntimeBrowser();
	const configurationStorage = new MemoryConfigurationStorage( {
		...EXAMPLE_CONFIGURATION,
		timingConfiguration: {
			...EXAMPLE_CONFIGURATION.timingConfiguration,
			completionAction: automatic ? CompletionAction.OPEN_AUTOMATICALLY : CompletionAction.SHOW_CONTINUE,
		},
	} );
	const preferencesStorage = {
		load: vi.fn<() => Promise<PreferencesDocument | null>>().mockResolvedValue( preferences ),
	};
	const harness = createRuntime(
		now, configurationStorage, browser, undefined, undefined, undefined, undefined, preferencesStorage,
	);
	return { ...harness, now, browser, preferencesStorage };
}

/**
 * Starts one unfinished navigation-origin pause.
 * @param harness - Focus-link runtime fixture.
 * @return Promise resolved after the authoritative pause is waiting.
 * @since 1.1.0
 */
async function startWaiting( harness: ReturnType<typeof createFocusLinkHarness> ): Promise<void> {
	await harness.runtime.start();
	await harness.runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/' } );
	harness.browser.navigations = [];
}

/**
 * Reads reconsideration facts retained by the real protection coordinator.
 * @param harness - Focus-link runtime fixture.
 * @return Reconsidered navigation facts.
 * @since 1.1.0
 */
async function readReconsiderations( harness: ReturnType<typeof createFocusLinkHarness> ) {
	const delivery = await harness.coordinator.getStatisticsDelivery();
	if ( delivery === null ) {
		throw new Error( 'Expected trustworthy statistics delivery.' );
	}
	return delivery.outbox.flatMap( ( batch ) => batch.facts )
		.filter( ( fact ) => fact.type === ProtectionFactType.RECONSIDERED_VISIT );
}

describe( 'configured focus-link navigation', () => {
	it.each( [ false, true ] )( 'leaves an unfinished pause without completing or granting in automatic mode %s', async ( automatic ) => {
		const harness = createFocusLinkHarness( undefined, automatic );
		await startWaiting( harness );
		const result = await harness.runtime.handlePageRequest( REQUEST, 7, true );
		expect( result ).toEqual( { state: InterruptionPageResponseState.RELEASED } );
		expect( harness.browser.navigations ).toEqual( [ { tabId: 7, url: FOCUS_LINK.url } ] );
		expect( ( await harness.coordinator.getStates() )?.scope_default )
			.toMatchObject( { type: ProtectionStateType.IDLE } );
		expect( await readReconsiderations( harness ) ).toHaveLength( 1 );
		await harness.runtime.handlePageRequest( REQUEST, 7, true );
		expect( harness.browser.navigations ).toHaveLength( 1 );
		expect( await readReconsiderations( harness ) ).toHaveLength( 1 );
	} );

	it( 'keeps another participant and its confirmed progress when the current participant leaves', async () => {
		const harness = createFocusLinkHarness();
		await startWaiting( harness );
		harness.browser.tabs.push( { id: 8, incognito: false, url: 'https://example.com/other' } );
		await harness.runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://example.com/other' } );
		await harness.runtime.handlePageRequest( { type: InterruptionPageRequestType.CHECKPOINT,
			documentVisible: true, displayedFocusedDurationMilliseconds: 2_000 }, 7, true );
		await harness.runtime.handlePageRequest( REQUEST, 7, true );
		expect( ( await harness.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.WAITING, confirmedFocusedDurationMilliseconds: 2_000,
			participants: [ { retainedDestination: 'https://example.com/other' } ],
		} );
		expect( await readReconsiderations( harness ) ).toHaveLength( 1 );
	} );

	it.each( [ 'ready', 'expiry' ] )( 'preserves existing statistics semantics from %s', async ( origin ) => {
		const harness = createFocusLinkHarness();
		if ( origin === 'expiry' ) {
			await presentAllowanceExpiryInterruption( harness.runtime, harness.now );
		} else {
			await startWaiting( harness );
			await completeFocusedPause( harness.runtime, 7 );
		}
		harness.browser.navigations = [];
		await harness.runtime.handlePageRequest( REQUEST, 7, true );
		expect( harness.browser.navigations ).toEqual( [ { tabId: 7, url: FOCUS_LINK.url } ] );
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
		const state = ( await harness.coordinator.getStates() )?.scope_default;
		expect( state?.type ).not.toBe( ProtectionStateType.ALLOWANCE );
	} );

	it.each( [ null, { ...DefaultPreferencesDocument, focusLinks: [] } ] )( 'rejects missing or unavailable local link configuration %j', async ( preferences ) => {
		const harness = createFocusLinkHarness( preferences );
		await startWaiting( harness );
		await harness.runtime.handlePageRequest( REQUEST, 7, true );
		expect( harness.browser.navigations ).toEqual( [] );
		expect( ( await harness.coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.WAITING );
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
	} );

	it( 'rejects unknown IDs and page-supplied URLs without departing', async () => {
		const harness = createFocusLinkHarness();
		await startWaiting( harness );
		await harness.runtime.handlePageRequest( { ...REQUEST, focusLinkId: 'focus_link_unknown' }, 7, true );
		await harness.runtime.handlePageRequest( { ...REQUEST, url: 'https://untrusted.test/' }, 7, true );
		expect( harness.browser.navigations ).toEqual( [] );
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
	} );

	it( 'does not trust a request without a current ordinary participant', async () => {
		const harness = createFocusLinkHarness();
		await startWaiting( harness );
		await harness.runtime.handlePageRequest( REQUEST, null, true );
		await harness.runtime.handlePageRequest( REQUEST, 8, true );
		await harness.runtime.handlePageRequest( REQUEST, 7, false );
		expect( harness.browser.navigations ).toEqual( [] );
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
	} );

	it( 'stops authoritative progress during slow navigation and retains recoverable state after failure', async () => {
		const harness = createFocusLinkHarness( undefined, true );
		await startWaiting( harness );
		const deferred = new DeferredPromise();
		const navigate = vi.spyOn( harness.browser, 'navigateTab' ).mockImplementation( async () => {
			await deferred.promise;
			throw new Error( 'Navigation unavailable.' );
		} );
		const operation = harness.runtime.handlePageRequest( REQUEST, 7, true );
		await vi.waitFor( () => {
			expect( navigate ).toHaveBeenCalledOnce();
		} );
		harness.now.value += 60_000;
		expect( ( await harness.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.WAITING, confirmedFocusedDurationMilliseconds: 0,
			ownerParticipantId: null, participants: [ { focusEligible: false } ],
		} );
		deferred.resolve();
		await expect( operation ).resolves.toMatchObject( { state: InterruptionPageResponseState.WAITING,
			focusLinkFailed: true, progressing: false } );
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
		navigate.mockRestore();
		await harness.runtime.handlePageRequest( REQUEST, 7, true );
		expect( harness.browser.navigations ).toEqual( [ { tabId: 7, url: FOCUS_LINK.url } ] );
		expect( await readReconsiderations( harness ) ).toHaveLength( 1 );
	} );

	it( 'applies normal protection to a protected focus-link destination', async () => {
		const destination = 'https://example.com/reading';
		const harness = createFocusLinkHarness( { ...DefaultPreferencesDocument,
			focusLinks: [ { ...FOCUS_LINK, url: destination } ] } );
		await startWaiting( harness );
		await harness.runtime.handlePageRequest( REQUEST, 7, true );
		await harness.runtime.handleNavigation( { tabId: 7, frameId: 0, url: destination,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE } );
		expect( ( await harness.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.WAITING, confirmedFocusedDurationMilliseconds: 0,
			participants: [ { retainedDestination: destination } ],
		} );
		expect( harness.browser.navigations.at( -1 )?.url ).toBe( 'chrome-extension://extension-id/interruption.html' );
	} );
} );


it.each( [ 'invisible', 'unfocused', 'private', 'stale-page', 'missing-tab' ] )(
	'rejects %s focus choices', async ( condition ) => {
		const harness = createFocusLinkHarness();
		await startWaiting( harness );
		if ( condition === 'unfocused' ) {
			harness.browser.focusedTabId = 8;
		}
		if ( condition === 'private' ) {
			harness.browser.tabs = [ { id: 7, incognito: true, url: 'chrome-extension://extension-id/interruption.html' } ];
		}
		if ( condition === 'stale-page' ) {
			harness.browser.tabs = [ { id: 7, incognito: false, url: 'https://elsewhere.test/' } ];
		}
		if ( condition === 'missing-tab' ) {
			harness.browser.tabs = [];
		}
		await harness.runtime.handlePageRequest( { ...REQUEST, documentVisible: condition !== 'invisible' }, 7, true );
		expect( harness.browser.navigations ).toEqual( [] );
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
	},
);

it( 'retains preferences and configured focus links when resetting statistics', async () => {
	const harness = createFocusLinkHarness();
	await startWaiting( harness );
	const preferences = await harness.preferencesStorage.load();
	await harness.runtime.resetStatistics();
	expect( await harness.preferencesStorage.load() ).toEqual( preferences );
	await harness.runtime.handlePageRequest( REQUEST, 7, true );
	expect( harness.browser.navigations ).toEqual( [ { tabId: 7, url: FOCUS_LINK.url } ] );
} );

it( 'handles an unavailable preference read without advancing or departing the pause', async () => {
	const harness = createFocusLinkHarness();
	await startWaiting( harness );
	harness.preferencesStorage.load.mockRejectedValue( new Error( 'Storage unavailable.' ) );
	await expect( harness.runtime.handlePageRequest( REQUEST, 7, true ) ).resolves.toMatchObject( {
		state: InterruptionPageResponseState.WAITING, focusLinkFailed: true,
	} );
	expect( harness.browser.navigations ).toEqual( [] );
	expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
} );


it( 'discards a queued old completion checkpoint after an explicit focus choice', async () => {
	const harness = createFocusLinkHarness( undefined, true );
	await startWaiting( harness );
	const deferred = new DeferredPromise();
	const listTabs = vi.spyOn( harness.browser, 'listTabs' );
	let held = true;
	listTabs.mockImplementation( async () => {
		if ( held ) {
			held = false;
			await deferred.promise;
		}
		return harness.browser.tabs;
	} );
	const checkpoint = harness.runtime.handlePageRequest( {
		type: InterruptionPageRequestType.CHECKPOINT, documentVisible: true,
		displayedFocusedDurationMilliseconds: 10_000,
	}, 7, true );
	await vi.waitFor( () => {
		expect( held ).toBe( false );
	} );
	const choice = harness.runtime.handlePageRequest( REQUEST, 7, true );
	deferred.resolve();
	await Promise.all( [ checkpoint, choice ] );
	listTabs.mockRestore();
	expect( harness.browser.navigations ).toEqual( [ { tabId: 7, url: FOCUS_LINK.url } ] );
	expect( ( await harness.coordinator.getStates() )?.scope_default?.type ).toBe( ProtectionStateType.IDLE );
	expect( await readReconsiderations( harness ) ).toHaveLength( 1 );
} );


it( 'deduplicates simultaneous explicit focus choices without counting or navigating twice', async () => {
	const harness = createFocusLinkHarness();
	await startWaiting( harness );
	await Promise.all( [ harness.runtime.handlePageRequest( REQUEST, 7, true ),
		harness.runtime.handlePageRequest( REQUEST, 7, true ) ] );
	expect( harness.browser.navigations ).toEqual( [ { tabId: 7, url: FOCUS_LINK.url } ] );
	expect( await readReconsiderations( harness ) ).toHaveLength( 1 );
} );

it.each( [ 'cancel', 'cancel-redacted', 'error', 'commit', 'protected-commit', 'tab-close' ] )(
	'keeps an embedded pause blocking through accepted navigation and safely handles %s', async ( outcome ) => {
		const destination = outcome === 'protected-commit' ? 'https://example.com/reading' : FOCUS_LINK.url;
		const harness = createFocusLinkHarness( { ...DefaultPreferencesDocument,
			focusLinks: [ { ...FOCUS_LINK, url: destination } ] } );
		await presentAllowanceExpiryInterruption( harness.runtime, harness.now );
		const original = harness.browser.tabs.find( ( tab ) => tab.id === 7 )?.url;
		vi.spyOn( harness.browser, 'navigateTab' ).mockImplementation( ( tabId, url ) => {
			harness.browser.navigations.push( { tabId, url } );
			harness.browser.tabs = harness.browser.tabs.map( ( tab ) => tab.id === tabId
				? { ...tab, status: 'loading', ...( outcome === 'cancel-redacted' ? {} : { pendingUrl: url } ) } : tab );
			return Promise.resolve();
		} );
		await expect( harness.runtime.handlePageRequest( REQUEST, 7, true ) ).resolves.toMatchObject( {
			state: InterruptionPageResponseState.WAITING, progressing: false, focusLinkOpening: true,
		} );
		await harness.runtime.handleNavigation( { tabId: 7, frameId: 0, url: destination,
			phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE } );
		await harness.runtime.handleFocusChanged();
		await harness.runtime.handleClockTick();
		expect( harness.browser.protectedPagePresentations.get( 7 )?.interruptionLayerPresented ).toBe( true );
		expect( ( await harness.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.WAITING, ownerParticipantId: null,
		} );
		await expect( harness.runtime.handlePageRequest( { type: InterruptionPageRequestType.SYNCHRONIZE,
			documentVisible: true }, 7, true ) ).resolves
			.toMatchObject( { focusLinkOpening: true, progressing: false } );
		if ( outcome === 'error' ) {
			await harness.runtime.handleNavigation( { tabId: 7, frameId: 0, url: destination,
				phase: ProtectionRuntimeNavigationPhase.ERROR_OCCURRED } );
		}
		if ( outcome === 'tab-close' ) {
			harness.browser.tabs = [];
			await harness.runtime.handleTabRemoved( 7 );
			harness.browser.tabs = [ { id: 7, incognito: false, url: 'https://example.com/new' } ];
			await harness.runtime.handleNavigation( { tabId: 7, frameId: 0, url: 'https://example.com/new',
				phase: ProtectionRuntimeNavigationPhase.BEFORE_NAVIGATE } );
			expect( ( await harness.coordinator.getStates() )?.scope_default ).toMatchObject( {
				type: ProtectionStateType.WAITING, participants: [ { retainedDestination: 'https://example.com/new' } ],
			} );
		} else if ( outcome === 'cancel' || outcome === 'cancel-redacted' || outcome === 'error' ) {
			harness.browser.tabs = [ { id: 7, incognito: false, status: 'complete',
				...( original === undefined ? {} : { url: original } ) } ];
			await expect( harness.runtime.handlePageRequest( { type: InterruptionPageRequestType.SYNCHRONIZE,
				documentVisible: true }, 7, true ) ).resolves
				.toMatchObject( { focusLinkFailed: true, progressing: false } );
			await expect( harness.runtime.handlePageRequest( { type: InterruptionPageRequestType.SYNCHRONIZE,
				documentVisible: true }, 7, true ) ).resolves.toMatchObject( { progressing: true } );
			expect( harness.browser.protectedPagePresentations.get( 7 )?.interruptionLayerPresented ).toBe( true );
		} else {
			harness.browser.tabs = [ { id: 7, incognito: false, url: destination } ];
			await harness.runtime.handleNavigation( { tabId: 7, frameId: 0, url: destination,
				phase: ProtectionRuntimeNavigationPhase.COMMITTED } );
			const state = ( await harness.coordinator.getStates() )?.scope_default;
			if ( outcome === 'protected-commit' ) {
				expect( state ).toMatchObject( { type: ProtectionStateType.WAITING,
					participants: [ { retainedDestination: destination } ] } );
			} else {
				expect( state?.type ).toBe( ProtectionStateType.IDLE );
			}
		}
		expect( await readReconsiderations( harness ) ).toHaveLength( 0 );
	},
);
