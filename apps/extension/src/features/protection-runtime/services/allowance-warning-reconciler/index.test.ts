import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	AllowanceProtectionStateSchema,
	ProtectionStateType,
} from '../../../../domains/protection/types/protection-state';
import {
	AllowanceIdSchema,
	DefaultProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import {
	ProtectedPageMessageType,
	type ProtectedPageMessage,
	type ProtectedPagePresentationStatus,
} from '../../types/protected-page-message';
import { type ProtectionRuntimeTab } from '../../types/browser-runtime';
import {
	createAllowanceWarningReconciler,
	type AllowanceWarningReconciler,
} from './index';

/**
 * Fixed allowance expiry used by warning reconciliation fixtures.
 * @since 0.1.0 Initial implementation.
 */
const ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS = 300_001;

/**
 * Fixed warning-window start used by warning reconciliation fixtures.
 * @since 0.1.0 Initial implementation.
 */
const WARNING_START_EPOCH_MILLISECONDS = ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS - 10_000;

/**
 * Configuration containing one protected host in the default scope.
 * @since 0.1.0 Initial implementation.
 */
const CONFIGURATION: ProtectionConfigurationDocument = {
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

/**
 * Active allowance used by warning reconciliation tests.
 * @since 0.1.0 Initial implementation.
 */
const ALLOWANCE_STATE = AllowanceProtectionStateSchema.parse( {
	type: ProtectionStateType.ALLOWANCE,
	scopeId: DefaultProtectionScopeId,
	allowanceId: 'allowance_a',
	completedWaitId: null,
	startedAtEpochMilliseconds: 1,
	expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
	readyParticipants: [],
	ladder: { completedWaits: 1, greatestObservedLocalDate: '2026-09-02' },
} );

afterEach( () => {
	vi.restoreAllMocks();
} );

/**
 * Observable browser boundary used by allowance-warning tests.
 * @since 0.1.0 Initial implementation.
 */
class AllowanceWarningBrowserFixture {
	focusedTabId: number | null = 7;

	nowEpochMilliseconds = WARNING_START_EPOCH_MILLISECONDS;

	presentationReads: number[] = [];

	presentations = new Map<number, ProtectedPagePresentationStatus | null>();

	tabs: ProtectionRuntimeTab[] = [ {
		id: 7,
		incognito: false,
		url: 'https://example.com/watch',
	} ];

	updates: Array<{ message: ProtectedPageMessage; tabId: number }> = [];

	/**
	 * Returns the focused test tab identifier.
	 * @return Focused tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedTabId = (): Promise<number | null> => Promise.resolve( this.focusedTabId );

	/**
	 * Returns the current presentation for one test tab.
	 * @param tabId - Browser tab identifier.
	 * @return Current protected-page presentation.
	 * @since 0.1.0 Initial implementation.
	 */
	getProtectedPagePresentation = (
		tabId: number,
	): Promise<ProtectedPagePresentationStatus | null> => {
		this.presentationReads.push( tabId );

		return Promise.resolve( this.presentations.get( tabId ) ?? null );
	};

	/**
	 * Returns the test browser tabs.
	 * @return Current browser tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	listTabs = (): Promise<ReadonlyArray<ProtectionRuntimeTab>> => Promise.resolve( this.tabs );

	/**
	 * Captures one protected-page presentation command.
	 * @param tabId - Browser tab identifier.
	 * @param message - Protected-page command.
	 * @return Resolved browser operation.
	 * @since 0.1.0 Initial implementation.
	 */
	updateProtectedPagePresentation = (
		tabId: number,
		message: ProtectedPageMessage,
	): Promise<void> => {
		this.updates.push( { message, tabId } );

		return Promise.resolve();
	};
}

/**
 * Creates a warning reconciler around one observable browser fixture.
 * @param browser - Browser fixture receiving presentation effects.
 * @param getTimeZone - Time-zone provider override.
 * @return Allowance-warning reconciler under test.
 * @since 0.1.0 Initial implementation.
 */
function createFixtureReconciler(
	browser: AllowanceWarningBrowserFixture,
	getTimeZone: () => string = () => 'UTC',
): AllowanceWarningReconciler {
	return createAllowanceWarningReconciler( {
		browser,
		getTimeZone,
		/**
		 * Returns the fixture's current epoch time.
		 * @return Current epoch milliseconds.
		 * @since 0.1.0 Initial implementation.
		 */
		now: () => browser.nowEpochMilliseconds,
	} );
}

describe( 'createAllowanceWarningReconciler', () => {
	it( 'bounds a focused local warning by a custom schedule end', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		const state = AllowanceProtectionStateSchema.parse( {
			...ALLOWANCE_STATE,
			startedAtEpochMilliseconds: 5_000,
			expiresAtEpochMilliseconds: 305_000,
		} );
		const configuration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: 'custom',
					windows: [ { weekday: 'Thursday', startMinute: 0, endMinute: 5 } ],
				},
			},
		};
		browser.nowEpochMilliseconds = 295_000;
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( configuration, { scope_default: state } );

		expect( browser.updates[ 0 ] ).toEqual( {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
				allowanceId: 'allowance_a',
				expiresAtEpochMilliseconds: 305_000,
				warningStartsAtEpochMilliseconds: 295_000,
				warningEndsAtEpochMilliseconds: 300_000,
			},
		} );
	} );

	it( 'pre-arms a focused local warning for a custom schedule start', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		const state = AllowanceProtectionStateSchema.parse( {
			...ALLOWANCE_STATE,
			startedAtEpochMilliseconds: 5_000,
			expiresAtEpochMilliseconds: 305_000,
		} );
		const configuration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: 'custom',
					windows: [ { weekday: 'Thursday', startMinute: 5, endMinute: 6 } ],
				},
			},
		};
		browser.nowEpochMilliseconds = 295_000;
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( configuration, { scope_default: state } );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
				allowanceId: 'allowance_a',
				expiresAtEpochMilliseconds: 305_000,
				warningStartsAtEpochMilliseconds: 300_000,
				warningEndsAtEpochMilliseconds: 305_000,
			},
		} ] );
	} );

	it( 'does not present a warning after its exact guard synchronization fails', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		const update = vi.fn( browser.updateProtectedPagePresentation );

		update.mockRejectedValueOnce( new Error( 'Guard synchronization failed.' ) );
		browser.updateProtectedPagePresentation = update;
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( update ).toHaveBeenCalledOnce();
		expect( update ).toHaveBeenCalledWith( 7, expect.objectContaining( {
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
		} ) );
	} );

	it( 'does not arm a local warning when its schedule stays inactive through expiry', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		const configuration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: 'custom',
					windows: [ { weekday: 'Friday', startMinute: 0, endMinute: 60 } ],
				},
			},
		};
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( configuration, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
				allowanceId: 'allowance_a',
				expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				warningStartsAtEpochMilliseconds: null,
				warningEndsAtEpochMilliseconds: null,
			},
		} ] );
	} );

	it( 'reuses a fixed custom-schedule warning interval across frequent reconciliations', async () => {
		const NativeDateTimeFormat = Intl.DateTimeFormat;
		const formatterSpy = vi.spyOn( Intl, 'DateTimeFormat' ).mockImplementation(
			/**
			 * Creates a native formatter while retaining a named constructor-compatible test double.
			 * @param locales - Requested locales.
			 * @param options - Requested date-time format options.
			 * @return Native date-time formatter.
			 */
			function DateTimeFormat( locales, options ) {
				return new NativeDateTimeFormat( locales, options );
			},
		);
		const browser = new AllowanceWarningBrowserFixture();
		const configuration: ProtectionConfigurationDocument = {
			...CONFIGURATION,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: 'custom',
					windows: [ { weekday: 'Friday', startMinute: 0, endMinute: 60 } ],
				},
			},
		};
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( configuration, { scope_default: ALLOWANCE_STATE } );
		const firstReconciliationFormatterCount = formatterSpy.mock.calls.length;
		await reconciler.reconcile( configuration, { scope_default: ALLOWANCE_STATE } );

		expect( firstReconciliationFormatterCount ).toBe( 3 );
		expect( formatterSpy ).toHaveBeenCalledTimes( 4 );
	} );

	it( 'arms every protected page while warning only the focused page at the inclusive boundary', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.tabs = [
			{ id: 7, incognito: false, url: 'https://example.com/watch' },
			{ id: 8, incognito: false, url: 'https://example.com/other' },
		];
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toHaveLength( 3 );
		expect( browser.updates ).toEqual( expect.arrayContaining( [
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
					allowanceId: 'allowance_a',
					expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
					warningStartsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
					warningEndsAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				},
			},
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
					allowanceId: 'allowance_a',
					expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				},
			},
			{
				tabId: 8,
				message: {
					type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
					allowanceId: 'allowance_a',
					expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
					warningStartsAtEpochMilliseconds: null,
					warningEndsAtEpochMilliseconds: null,
				},
			},
		] ) );
	} );

	it( 'arms every live protected page before its warning window begins', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.nowEpochMilliseconds = WARNING_START_EPOCH_MILLISECONDS - 30_000;
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
				allowanceId: 'allowance_a',
				expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				warningStartsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
				warningEndsAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
			},
		} ] );
	} );

	it( 'does not repeat an already current warning while refreshing its expiry guard', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
				allowanceId: 'allowance_a',
				expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				warningStartsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
				warningEndsAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
			},
		} ] );
	} );

	it( 'removes the warning as soon as its page loses browser focus', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.focusedTabId = null;
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
					allowanceId: 'allowance_a',
					expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
					warningStartsAtEpochMilliseconds: null,
					warningEndsAtEpochMilliseconds: null,
				},
			},
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
					allowanceId: 'allowance_a',
				},
			},
		] );
	} );

	it( 'replaces a stale warning identity with the current allowance warning', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.presentations.set( 7, {
			allowanceWarningId: AllowanceIdSchema.parse( 'allowance_stale' ),
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
					allowanceId: 'allowance_a',
					expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
					warningStartsAtEpochMilliseconds: WARNING_START_EPOCH_MILLISECONDS,
					warningEndsAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				},
			},
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
					allowanceId: 'allowance_stale',
				},
			},
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
					allowanceId: 'allowance_a',
					expiresAtEpochMilliseconds: ALLOWANCE_EXPIRY_EPOCH_MILLISECONDS,
				},
			},
		] );
	} );

	it( 'removes a warning when the schedule cannot be evaluated safely', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser, () => 'Not/A_Zone' );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toHaveLength( 2 );
		expect( browser.updates[ 1 ]?.message.type ).toBe(
			ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
		);
	} );

	it( 'clears allowance effects without inspecting page state when configuration is unavailable', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.tabs = [ { id: 7, incognito: false } ];
		browser.getProtectedPagePresentation = () => Promise.reject( new Error( 'Host access unavailable.' ) );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( null, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: { type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD },
		} ] );
	} );

	it( 'removes an existing warning after its tab leaves every protected host', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.tabs = [ { id: 7, incognito: false, url: 'https://unrelated.example/' } ];
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates[ 0 ]?.message.type ).toBe(
			ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
		);
	} );

	it( 'clears a tab guard without inspecting page state when its URL is hidden', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.tabs = [ { id: 7, incognito: false } ];
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.presentationReads ).toEqual( [] );
		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'does not inject into an outgoing document for a protected pending URL', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.tabs = [ {
			id: 7,
			incognito: false,
			pendingUrl: 'https://example.com/watch',
			url: 'https://unrelated.example/',
		} ];
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'removes an existing warning after its protected scope stops carrying an allowance', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, {} );

		expect( browser.updates[ 0 ]?.message.type ).toBe(
			ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
		);
	} );

	it( 'clears an invisible expiry guard after its protected scope stops carrying an allowance', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.presentations.set( 7, {
			allowanceWarningId: null,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, {} );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'clears a local expiry guard when its presentation status cannot be observed', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, {} );

		expect( browser.updates ).toEqual( [ {
			tabId: 7,
			message: {
				type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
			},
		} ] );
	} );

	it( 'isolates one page effect failure from every other warning cleanup', async () => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.focusedTabId = null;
		browser.tabs = [
			{ id: 7, incognito: false, url: 'https://example.com/' },
			{ id: 8, incognito: false, url: 'https://example.com/other' },
		];
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		browser.presentations.set( 8, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const update = vi.fn( browser.updateProtectedPagePresentation );
		update.mockRejectedValueOnce( new Error( 'Tab raced.' ) );
		browser.updateProtectedPagePresentation = update;
		const reconciler = createFixtureReconciler( browser );

		await expect(
			reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } ),
		).resolves.toBeUndefined();

		expect( update ).toHaveBeenCalledTimes( 4 );
	} );

	it.each( [
		[ 'private tab', true ],
		[ 'tab with unknown privacy', undefined ],
	] )( 'removes allowance effects without arming a guard on a %s', async (
		_label,
		incognito,
	) => {
		const browser = new AllowanceWarningBrowserFixture();
		browser.tabs = [ {
			id: 7,
			url: 'https://example.com/private',
			...( incognito === undefined ? {} : { incognito } ),
		} ];
		browser.presentations.set( 7, {
			allowanceWarningId: ALLOWANCE_STATE.allowanceId,
			interruptionLayerPresented: false,
		} );
		const reconciler = createFixtureReconciler( browser );

		await reconciler.reconcile( CONFIGURATION, { scope_default: ALLOWANCE_STATE } );

		expect( browser.updates ).toEqual( [
			{
				tabId: 7,
				message: {
					type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
					allowanceId: ALLOWANCE_STATE.allowanceId,
				},
			},
			{
				tabId: 7,
				message: { type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD },
			},
			{
				tabId: 7,
				message: { type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER },
			},
		] );
	} );
} );
