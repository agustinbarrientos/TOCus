import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	AllowanceProtectionStateSchema,
	ProtectionStateType,
	WaitingProtectionStateSchema,
} from '../../../../domains/protection/types/protection-state';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import {
	type ToolbarBadgeCopy,
	type ToolbarBadgeProjection,
} from '../../utils/toolbar-badge-projection';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	createToolbarBadgeCoordinator,
	type ToolbarBadgeCoordinator,
	type ToolbarBadgeTab,
} from './index';

/**
 * Extension-owned interruption page used by toolbar-badge fixtures.
 * @since 0.1.0 Initial implementation.
 */
const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';

/**
 * Default-scope configuration used by toolbar-badge fixtures.
 * @since 0.1.0 Initial implementation.
 */
const CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
	} ],
};

/**
 * Waiting state used by toolbar-badge fixtures.
 * @since 0.1.0 Initial implementation.
 */
const WAITING_STATE = WaitingProtectionStateSchema.parse( {
	type: ProtectionStateType.WAITING,
	scopeId: 'scope_default',
	waitId: 'wait_a',
	capturedWaitDurationMilliseconds: 10_000,
	confirmedFocusedDurationMilliseconds: 2_000,
	participants: [ {
		origin: 'navigation',
		participantId: 'participant_a',
		pageId: 'page_tab_7_alpha',
		retainedDestination: 'https://example.com/',
		focusEligible: true,
		joinSequence: 0,
	} ],
	ownerParticipantId: 'participant_a',
	ownerEpoch: 1,
	checkpointHighWaterMilliseconds: 2_000,
	ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-09-02' },
} );

/**
 * Independent scope used by multi-scope toolbar fixtures.
 * @since 0.1.0 Initial implementation.
 */
const SECOND_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_secondary' );

/**
 * Waiting state retained by the independent toolbar-fixture scope.
 * @since 0.1.0 Initial implementation.
 */
const SECOND_WAITING_STATE = WaitingProtectionStateSchema.parse( {
	...WAITING_STATE,
	scopeId: SECOND_SCOPE_ID,
	waitId: 'wait_b',
	participants: [ {
		...WAITING_STATE.participants[ 0 ],
		participantId: 'participant_b',
		pageId: 'page_tab_8_beta',
		retainedDestination: 'https://secondary.example/',
	} ],
	ownerParticipantId: 'participant_b',
} );

/**
 * Shared and independent site configuration used by toolbar fixtures.
 * @since 0.1.0 Initial implementation.
 */
const MULTI_SCOPE_CONFIGURATION: ProtectionConfigurationDocument = {
	...CONFIGURATION,
	sites: [
		...CONFIGURATION.sites,
		{
			identityHost: 'secondary.example',
			rule: {
				host: 'secondary.example',
				includeSubdomains: true,
				scopeId: SECOND_SCOPE_ID,
			},
		},
	],
	schedulesByScope: {
		...CONFIGURATION.schedulesByScope,
		[ SECOND_SCOPE_ID ]: { mode: 'always' },
	},
	measurementRevisionsByScope: {
		...CONFIGURATION.measurementRevisionsByScope,
		[ SECOND_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse( 'revision_secondary' ),
	},
};

/**
 * Active visit allowance used by toolbar-badge fixtures.
 * @since 0.1.0 Initial implementation.
 */
const ALLOWANCE_STATE = AllowanceProtectionStateSchema.parse( {
	type: ProtectionStateType.ALLOWANCE,
	scopeId: DefaultProtectionScopeId,
	allowanceId: 'allowance_a',
	completedWaitId: null,
	startedAtEpochMilliseconds: 1,
	expiresAtEpochMilliseconds: 300_001,
	readyParticipants: [],
	ladder: { completedWaits: 1, greatestObservedLocalDate: '2026-09-02' },
} );

/**
 * In-memory browser boundary used by focused toolbar coordinator tests.
 * @since 0.1.0 Initial implementation.
 */
class ToolbarBadgeBrowserFixture {
	/** Active tab in the focused browser window. */
	focusedTabId: number | null = null;

	/** Current wall-clock epoch milliseconds. */
	nowEpochMilliseconds = 0;

	/** Latest global toolbar projection. */
	projection: ToolbarBadgeProjection | null = null;

	/** Current open browser tabs. */
	tabs: ToolbarBadgeTab[] = [];

	/**
	 * Returns the focused test tab.
	 * @return Focused tab identifier or null.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedTabId = (): Promise<number | null> => Promise.resolve( this.focusedTabId );

	/**
	 * Lists the current test tabs.
	 * @return Current open test tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs = (): Promise<ReadonlyArray<ToolbarBadgeTab>> => Promise.resolve( this.tabs );

	/**
	 * Returns the current test time.
	 * @return Current test epoch milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	now = (): number => this.nowEpochMilliseconds;

	/**
	 * Captures one global toolbar projection.
	 * @param projection - Projected toolbar badge.
	 * @return Resolved capture operation.
	 * @since 0.1.0 Initial implementation.
	 */
	updateToolbarBadge = ( projection: ToolbarBadgeProjection ): Promise<void> => {
		this.projection = projection;
		return Promise.resolve();
	};
}

/**
 * Creates a toolbar coordinator around one in-memory browser fixture.
 * @param browser - In-memory browser boundary.
 * @param copy - Optional localized toolbar copy.
 * @return Toolbar coordinator under test.
 * @since 0.1.0 Initial implementation.
 */
function createFixtureCoordinator(
	browser: ToolbarBadgeBrowserFixture,
	copy: ToolbarBadgeCopy = TestEnglishLocalizationBundle.toolbar,
): ToolbarBadgeCoordinator {
	return createToolbarBadgeCoordinator( {
		copy,
		getFocusedTabId: browser.getFocusedTabId,
		interruptionPageUrl: INTERRUPTION_PAGE_URL,
		listTabs: browser.listTabs,
		now: browser.now,
		updateToolbarBadge: browser.updateToolbarBadge,
	} );
}

describe( 'createToolbarBadgeCoordinator', () => {
	it( 'shows an unexpired global visit window and clears it exactly at expiry', async () => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.nowEpochMilliseconds = 1;
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.projection ).toMatchObject( {
			phase: 'allowance',
			text: 'V5m',
		} );

		browser.nowEpochMilliseconds = ALLOWANCE_STATE.expiresAtEpochMilliseconds;
		await coordinator.refresh( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.projection ).toMatchObject( {
			phase: 'inactive',
			text: '',
		} );
	} );

	it( 'uses a focused protected URL when the tab is not a retained participant', async () => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.focusedTabId = 99;
		browser.tabs = [ { id: 99, url: 'https://secondary.example/watch' } ];
		const focusedSecondaryState = WaitingProtectionStateSchema.parse( {
			...SECOND_WAITING_STATE,
			confirmedFocusedDurationMilliseconds: 5_000,
			checkpointHighWaterMilliseconds: 5_000,
		} );
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: focusedSecondaryState,
		} );

		expect( browser.projection ).toMatchObject( { text: 'P5s' } );
	} );

	it( 'prefers the focused pending navigation URL when selecting a protected scope', async () => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.focusedTabId = 99;
		browser.tabs = [ {
			id: 99,
			url: 'https://unrelated.example/',
			pendingUrl: 'https://secondary.example/watch',
		} ];
		const focusedSecondaryState = WaitingProtectionStateSchema.parse( {
			...SECOND_WAITING_STATE,
			confirmedFocusedDurationMilliseconds: 5_000,
			checkpointHighWaterMilliseconds: 5_000,
		} );
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: focusedSecondaryState,
		} );

		expect( browser.projection ).toMatchObject( { text: 'P5s' } );
	} );

	it( 'prefers a fresh protected pending URL over a retained participant from another scope', async () => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.focusedTabId = 7;
		browser.tabs = [ {
			id: 7,
			url: INTERRUPTION_PAGE_URL,
			pendingUrl: 'https://secondary.example/watch',
		} ];
		const focusedSecondaryState = WaitingProtectionStateSchema.parse( {
			...SECOND_WAITING_STATE,
			confirmedFocusedDurationMilliseconds: 5_000,
			checkpointHighWaterMilliseconds: 5_000,
		} );
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: focusedSecondaryState,
		} );

		expect( browser.projection ).toMatchObject( { text: 'P5s' } );
	} );

	it( 'does not use a retained participant after the focused tab reaches an unrelated URL', async () => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.focusedTabId = 7;
		browser.tabs = [ { id: 7, url: 'https://unrelated.example/' } ];
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: SECOND_WAITING_STATE,
		} );

		expect( browser.projection ).toMatchObject( { text: '2\u00d7' } );
	} );

	it.each( [
		{ tab: { id: 7, url: INTERRUPTION_PAGE_URL } },
		{ tab: { id: 7 } },
	] )( 'uses a retained participant when the focused tab is on or cannot expose the interruption page', async ( input ) => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.focusedTabId = 7;
		browser.tabs = [ input.tab ];
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: SECOND_WAITING_STATE,
		} );

		expect( browser.projection ).toMatchObject( { text: 'P8s' } );
	} );

	it.each( [
		{ tabs: [ { id: 99 } ] },
		{ tabs: [ { id: 99, url: 'https://unrelated.example/' } ] },
		{ tabs: [] },
	] )( 'shows a global summary when the focused tab does not resolve a protected scope', async ( input ) => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.focusedTabId = 99;
		browser.tabs = input.tabs;
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: SECOND_WAITING_STATE,
		} );

		expect( browser.projection ).toMatchObject( { text: '2\u00d7' } );
	} );

	it.each( [
		{
			label: 'focused-tab lookup',
			/**
			 * Makes focused-tab discovery fail for one coordinator refresh.
			 * @param browser - In-memory browser fixture to configure.
			 * @since 0.1.0 Initial implementation.
			 */
			configure: ( browser: ToolbarBadgeBrowserFixture ) => {
				browser.getFocusedTabId = () => Promise.reject( new Error( 'Window unavailable.' ) );
			},
		},
		{
			label: 'tab listing',
			/**
			 * Makes tab discovery fail for one coordinator refresh.
			 * @param browser - In-memory browser fixture to configure.
			 * @since 0.1.0 Initial implementation.
			 */
			configure: ( browser: ToolbarBadgeBrowserFixture ) => {
				browser.focusedTabId = 7;
				browser.listTabs = () => Promise.reject( new Error( 'Tabs unavailable.' ) );
			},
		},
	] )( 'falls back to the multiple-active summary when $label fails', async ( testCase ) => {
		const browser = new ToolbarBadgeBrowserFixture();
		testCase.configure( browser );
		browser.projection = {
			phase: 'waiting',
			text: 'P1s',
			title: 'Stale badge',
		};
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: SECOND_WAITING_STATE,
		} );

		expect( browser.projection ).toMatchObject( { text: '2\u00d7' } );
	} );

	it( 'falls back to the only active scope when browser context reads fail', async () => {
		const browser = new ToolbarBadgeBrowserFixture();
		browser.getFocusedTabId = () => Promise.reject( new Error( 'Window unavailable.' ) );
		browser.listTabs = () => Promise.reject( new Error( 'Tabs unavailable.' ) );
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( CONFIGURATION, { scope_default: WAITING_STATE } );

		expect( browser.projection ).toMatchObject( { text: 'P8s' } );
	} );

	it.each( [
		{ configuration: null, statesByScope: { scope_default: WAITING_STATE } },
		{ configuration: CONFIGURATION, statesByScope: null },
	] )( 'clears the global badge when authoritative input is unavailable', async ( input ) => {
		const browser = new ToolbarBadgeBrowserFixture();
		const coordinator = createFixtureCoordinator( browser );

		await coordinator.refresh( input.configuration, input.statesByScope );

		expect( browser.projection ).toMatchObject( { phase: 'inactive', text: '' } );
	} );

	it( 'projects toolbar copy supplied by the selected locale', async () => {
		let projection: ToolbarBadgeProjection | null = null;

		/**
		 * Formats one localized waiting badge fixture.
		 * @return Localized waiting badge copy.
		 * @since 0.1.0 Initial implementation.
		 */
		function formatLocalizedWaiting(): { text: string; title: string } {
			return {
				text: 'E8s',
				title: 'Espera: quedan 8 segundos',
			};
		}

		const coordinator = createToolbarBadgeCoordinator( {
			copy: {
				...TestEnglishLocalizationBundle.toolbar,
				formatWaiting: formatLocalizedWaiting,
			},

			/**
			 * Returns the focused protected tab fixture.
			 * @return Focused tab identifier.
			 * @since 0.1.0 Initial implementation.
			 */
			getFocusedTabId: () => Promise.resolve( 7 ),
			interruptionPageUrl: INTERRUPTION_PAGE_URL,

			/**
			 * Lists one protected tab fixture.
			 * @return Protected tab fixture.
			 * @since 0.1.0 Initial implementation.
			 */
			listTabs: () => Promise.resolve( [ {
				id: 7,
				url: INTERRUPTION_PAGE_URL,
			} ] ),

			/**
			 * Returns the fixed current time fixture.
			 * @return Zero epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 0,

			/**
			 * Captures one projected global badge.
			 * @param nextProjection - Projected toolbar badge.
			 * @return Resolved capture operation.
			 * @since 0.1.0 Initial implementation.
			 */
			updateToolbarBadge: ( nextProjection ) => {
				projection = nextProjection;
				return Promise.resolve();
			},
		} );

		await coordinator.refresh( CONFIGURATION, { scope_default: WAITING_STATE } );

		expect( projection ).toMatchObject( {
			text: 'E8s',
			title: 'TOCus: Espera: quedan 8 segundos',
		} );
	} );

	it( 'shows the focused protected scope through one global toolbar update', async () => {
		let projection: ToolbarBadgeProjection | null = null;
		let updateCount = 0;
		const coordinator = createToolbarBadgeCoordinator( {
			copy: TestEnglishLocalizationBundle.toolbar,
			/**
			 * Returns the focused protected tab fixture.
			 * @return Focused tab identifier.
			 * @since 0.1.0 Initial implementation.
			 */
			getFocusedTabId: () => Promise.resolve( 7 ),
			interruptionPageUrl: INTERRUPTION_PAGE_URL,

			/**
			 * Lists the open tab fixtures.
			 * @return Protected and unrelated tab fixtures.
			 * @since 0.1.0 Initial implementation.
			 */
			listTabs: () => Promise.resolve( [
				{ id: 7, url: INTERRUPTION_PAGE_URL },
				{ id: 8, url: 'https://unrelated.example/' },
			] ),

			/**
			 * Returns the fixed current time fixture.
			 * @return Zero epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 0,

			/**
			 * Captures one projected global badge.
			 * @param nextProjection - Projected toolbar badge.
			 * @return Resolved capture operation.
			 * @since 0.1.0 Initial implementation.
			 */
			updateToolbarBadge: ( nextProjection ) => {
				updateCount += 1;
				projection = nextProjection;
				return Promise.resolve();
			},
		} );

		await coordinator.refresh( CONFIGURATION, { scope_default: WAITING_STATE } );

		expect( projection ).toMatchObject( { text: 'P8s' } );
		expect( updateCount ).toBe( 1 );
	} );

	it( 'clears the global badge when no scope is active', async () => {
		let projection: ToolbarBadgeProjection | null = null;
		const coordinator = createToolbarBadgeCoordinator( {
			copy: TestEnglishLocalizationBundle.toolbar,
			/**
			 * Reports that no browser window is focused.
			 * @return Null focused-tab fixture.
			 * @since 0.1.0 Initial implementation.
			 */
			getFocusedTabId: () => Promise.resolve( null ),
			interruptionPageUrl: INTERRUPTION_PAGE_URL,

			/**
			 * Lists one open tab fixture.
			 * @return Current tab fixture.
			 * @since 0.1.0 Initial implementation.
			 */
			listTabs: () => Promise.resolve( [ { id: 7 } ] ),

			/**
			 * Returns the fixed current time fixture.
			 * @return Zero epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 0,

			/**
			 * Captures the projected toolbar badge.
			 * @param nextProjection - Projected toolbar badge.
			 * @return Resolved capture operation.
			 * @since 0.1.0 Initial implementation.
			 */
			updateToolbarBadge: ( nextProjection ) => {
				projection = nextProjection;
				return Promise.resolve();
			},
		} );

		await coordinator.refresh( CONFIGURATION, {} );

		expect( projection ).toMatchObject( { text: '', title: 'TOCus' } );
	} );

	it( 'ignores retained state for a scope no longer present in configuration', async () => {
		let projection: ToolbarBadgeProjection | null = null;
		const coordinator = createToolbarBadgeCoordinator( {
			copy: TestEnglishLocalizationBundle.toolbar,
			/**
			 * Reports that no browser window is focused.
			 * @return Null focused-tab fixture.
			 * @since 0.1.0 Initial implementation.
			 */
			getFocusedTabId: () => Promise.resolve( null ),
			interruptionPageUrl: INTERRUPTION_PAGE_URL,

			/**
			 * Lists one open tab fixture.
			 * @return Current tab fixture.
			 * @since 0.1.0 Initial implementation.
			 */
			listTabs: () => Promise.resolve( [ { id: 7 } ] ),

			/**
			 * Returns the fixed current time fixture.
			 * @return Zero epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 0,

			/**
			 * Captures the projected toolbar badge.
			 * @param nextProjection - Projected toolbar badge.
			 * @return Resolved capture operation.
			 * @since 0.1.0 Initial implementation.
			 */
			updateToolbarBadge: ( nextProjection ) => {
				projection = nextProjection;
				return Promise.resolve();
			},
		} );

		await coordinator.refresh( TestEmptyProtectionConfiguration, { scope_default: WAITING_STATE } );

		expect( projection ).toMatchObject( { text: '', title: 'TOCus' } );
	} );

	it( 'uses the only active scope when the focused tab does not identify one', async () => {
		let projection: ToolbarBadgeProjection | null = null;
		const coordinator = createToolbarBadgeCoordinator( {
			copy: TestEnglishLocalizationBundle.toolbar,
			/**
			 * Returns the focused tab fixture.
			 * @return Null because no browser window is focused.
			 * @since 0.1.0 Initial implementation.
			 */
			getFocusedTabId: () => Promise.resolve( null ),
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Lists the current tab fixtures.
			 * @return Current open tab fixtures.
			 * @since 0.1.0 Initial implementation.
			 */
			listTabs: () => Promise.resolve( [ { id: 7 } ] ),
			/**
			 * Returns the fixed current time fixture.
			 * @return Zero epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 0,
			/**
			 * Captures one projected badge.
			 * @param nextProjection - Projected toolbar badge.
			 * @return Resolved capture operation.
			 * @since 0.1.0 Initial implementation.
			 */
			updateToolbarBadge: ( nextProjection ) => {
				projection = nextProjection;
				return Promise.resolve();
			},
		} );

		await coordinator.refresh( CONFIGURATION, { scope_default: WAITING_STATE } );

		expect( projection ).toMatchObject( { text: 'P8s' } );
	} );

	it( 'shows a multiple marker when several scopes are active without a focused match', async () => {
		let projection: ToolbarBadgeProjection | null = null;
		const coordinator = createToolbarBadgeCoordinator( {
			copy: TestEnglishLocalizationBundle.toolbar,
			/**
			 * Returns the focused tab fixture.
			 * @return Null because no browser window is focused.
			 * @since 0.1.0 Initial implementation.
			 */
			getFocusedTabId: () => Promise.resolve( null ),
			interruptionPageUrl: INTERRUPTION_PAGE_URL,
			/**
			 * Lists the current tab fixtures.
			 * @return Current open tab fixtures.
			 * @since 0.1.0 Initial implementation.
			 */
			listTabs: () => Promise.resolve( [ { id: 7 }, { id: 8 } ] ),
			/**
			 * Returns the fixed current time fixture.
			 * @return Zero epoch milliseconds.
			 * @since 0.1.0 Initial implementation.
			 */
			now: () => 0,
			/**
			 * Captures one projected badge.
			 * @param nextProjection - Projected toolbar badge.
			 * @return Resolved capture operation.
			 * @since 0.1.0 Initial implementation.
			 */
			updateToolbarBadge: ( nextProjection ) => {
				projection = nextProjection;
				return Promise.resolve();
			},
		} );

		await coordinator.refresh( MULTI_SCOPE_CONFIGURATION, {
			scope_default: WAITING_STATE,
			scope_secondary: SECOND_WAITING_STATE,
		} );

		expect( projection ).toMatchObject( { text: '2\u00d7' } );
	} );
} );
