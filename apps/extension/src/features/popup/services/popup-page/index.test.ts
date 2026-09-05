import { afterEach, describe, expect, it, vi } from 'vitest';
import { Language } from '../../../../domains/preferences/types';
import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { createEnglishLocalizationBundle } from '../../../../localization';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import {
	PopupAddSiteRequestEventName,
	PopupOperationError,
	PopupRetryRequestEventName,
} from '../../components/shell/types';
import {
	PopupCurrentSiteAccess,
	PopupCurrentSiteStatus,
	PopupProjectionStatus,
	PopupScheduleStatus,
	PopupScopeKind,
	PopupTimerPhase,
	type PopupProjection,
} from '../../types/popup-projection';
import { bootstrapPopupPage, startPopupPage } from './index';
import { type PopupPageOptions } from './types';

const CURRENT_TAB = Object.freeze( {
	id: 17,
	incognito: false,
	url: 'https://example.com/feed',
} as const );
const EXAMPLE_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_example' );
const TEST_SITE = Object.freeze( {
	identityHost: 'example.com',
	rule: {
		host: 'example.com',
		includeSubdomains: false,
		scopeId: DefaultProtectionScopeId,
	},
} );
const UNPROTECTED_PROJECTION: PopupProjection = Object.freeze( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: 1_800_000_000_000,
	currentSite: {
		status: PopupCurrentSiteStatus.UNPROTECTED,
		identityHost: 'example.com',
	},
	activeScopes: [],
} );
const PROTECTED_PROJECTION: PopupProjection = Object.freeze( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: 1_800_000_001_000,
	currentSite: {
		status: PopupCurrentSiteStatus.PROTECTED,
		site: TEST_SITE,
		scopeId: DefaultProtectionScopeId,
		access: PopupCurrentSiteAccess.GRANTED,
		schedule: PopupScheduleStatus.ACTIVE,
		nextWaitMilliseconds: 10_000,
	},
	activeScopes: [],
} );
const ACTIVE_PROTECTED_CURRENT_SITE = Object.freeze( {
	status: PopupCurrentSiteStatus.PROTECTED,
	site: TEST_SITE,
	scopeId: DefaultProtectionScopeId,
	access: PopupCurrentSiteAccess.GRANTED,
	schedule: PopupScheduleStatus.ACTIVE,
	nextWaitMilliseconds: null,
} as const );
const UNAVAILABLE_PROJECTION: PopupProjection = Object.freeze( {
	status: PopupProjectionStatus.UNAVAILABLE,
} );

/**
 * Returns a widened default language for the mutable controller test double.
 * @return Default popup language.
 * @since 0.1.0 Initial implementation.
 */
function createDefaultLanguage(): Language {
	return Language.ENGLISH;
}

/**
 * Minimal popup shell that records page-service projections and events.
 * @since 0.1.0 Initial implementation.
 */
class TestPopupShell extends EventTarget {
	copy: PopupPageOptions[ 'fallbackLocalization' ][ 'popup' ] | null = null;

	projection: PopupProjection | null = null;

	nowEpochMilliseconds = 0;

	faviconSource: string | null = null;

	settingsPageUrl = '';

	statisticsPageUrl = '';

	adding = false;

	operationError: PopupOperationError | null = null;

	retrying = false;

	readonly focusManageAction = vi.fn().mockResolvedValue( undefined );

	readonly focusAfterRetry = vi.fn().mockResolvedValue( undefined );
}

/**
 * Creates a controllable page-window boundary for lifecycle and countdown tests.
 * @return Window boundary, captured interval callback, and lifecycle dispatcher.
 * @since 0.1.0 Initial implementation.
 */
function createPageWindowHarness() {
	const lifecycle = new EventTarget();
	let intervalCallback: ( () => void ) | null = null;
	const pageWindow = {
		addEventListener: lifecycle.addEventListener.bind( lifecycle ),
		removeEventListener: lifecycle.removeEventListener.bind( lifecycle ),
		setInterval: vi.fn( ( callback: () => void ) => {
			intervalCallback = callback;

			return 29;
		} ),
		clearInterval: vi.fn(),
	};

	return {
		pageWindow,
		/**
		 * Dispatches popup dismissal to registered lifecycle observers.
		 * @since 0.1.0 Initial implementation.
		 */
		dispatchPageHide(): void {
			lifecycle.dispatchEvent( new Event( 'pagehide' ) );
		},
		/**
		 * Invokes the currently registered countdown callback.
		 * @since 0.1.0 Initial implementation.
		 */
		tick(): void {
			if ( intervalCallback === null ) {
				throw new Error( 'Expected one active popup countdown interval.' );
			}

			intervalCallback();
		},
	};
}

/**
 * Creates one complete popup-page harness with replaceable service outcomes.
 * @param initialProjection - Initial status returned by the background client.
 * @return Popup page options and every observable dependency.
 * @since 0.1.0 Initial implementation.
 */
function createHarness( initialProjection: PopupProjection = UNPROTECTED_PROJECTION ) {
	const localization = createEnglishLocalizationBundle();
	const liveLocalization = {
		...localization,
		document: { ...localization.document, popupTitle: 'Japanese popup' },
		language: Language.JAPANESE,
		languageTag: 'ja',
	};
	let languageListener: ( ( language: Language ) => void ) | null = null;
	const shell = new TestPopupShell();
	const removeProperty = vi.fn();
	const documentTarget = {
		documentElement: {
			setAttribute: vi.fn(),
			style: { removeProperty },
		},
		title: 'TOCus',
	};
	const preferencesController = {
		language: createDefaultLanguage(),
		addLanguageChangeListener: vi.fn( ( listener: ( language: Language ) => void ) => {
			languageListener = listener;
		} ),
		removeLanguageChangeListener: vi.fn(),
		start: vi.fn().mockResolvedValue( undefined ),
		stop: vi.fn(),
	};
	const currentTabReader = { read: vi.fn().mockResolvedValue( CURRENT_TAB ) };
	const statusClient = {
		readStatus: vi.fn().mockResolvedValue( initialProjection ),
		refreshStatus: vi.fn().mockResolvedValue( PROTECTED_PROJECTION ),
	};
	const enrollment = {
		add: vi.fn<( input: unknown, independent: boolean ) => Promise<ProtectedSiteEnrollmentResult>>()
			.mockResolvedValue( {
				status: ProtectedSiteEnrollmentStatus.ADDED,
				configuration: {
					...TestEmptyProtectionConfiguration,
					sites: [ TEST_SITE ],
				},
				site: TEST_SITE,
			} ),
	};
	const faviconProvider = {
		getSource: vi.fn().mockReturnValue( 'chrome-extension://extension-id/_favicon/' ),
	};
	const loadLocalization = vi.fn( ( language: Language ) => Promise.resolve(
		language === Language.JAPANESE ? liveLocalization : localization,
	) );
	const now = vi.fn().mockReturnValue( 1_800_000_000_500 );
	const pageWindowHarness = createPageWindowHarness();
	const options: PopupPageOptions = {
		currentTabReader,
		document: documentTarget,
		enrollment,
		fallbackLocalization: localization,
		faviconProvider,
		loadLocalization,
		now,
		pageWindow: pageWindowHarness.pageWindow,
		preferencesController,
		settingsPageUrl: 'chrome-extension://extension-id/options.html#protected-sites',
		shell,
		statisticsPageUrl: 'chrome-extension://extension-id/options.html#statistics',
		statusClient,
	};

	return {
		currentTabReader,
		documentTarget,
		enrollment,
		faviconProvider,
		/**
		 * Returns the currently registered live-language observer.
		 * @return Current language observer or null before registration.
		 * @since 0.1.0 Initial implementation.
		 */
		languageListener: (): ( ( language: Language ) => void ) | null => languageListener,
		liveLocalization,
		loadLocalization,
		localization,
		now,
		options,
		pageWindowHarness,
		preferencesController,
		removeProperty,
		shell,
		statusClient,
	};
}

/**
 * Waits until queued page work reaches its next observable boundary.
 * @return Promise resolved after queued microtasks settle.
 * @since 0.1.0 Initial implementation.
 */
async function settlePageWork(): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
}

describe( 'popup page service', () => {
	afterEach( () => {
		vi.restoreAllMocks();
	} );

	it( 'keeps the popup hidden until preferences, localization, and status are ready', async () => {
		const harness = createHarness();
		const preferenceStart = Promise.withResolvers<undefined>();

		harness.preferencesController.start.mockReturnValueOnce( preferenceStart.promise );
		const start = startPopupPage( harness.options );

		expect( harness.preferencesController.start ).toHaveBeenCalledOnce();
		expect( harness.currentTabReader.read ).not.toHaveBeenCalled();
		expect( harness.removeProperty ).not.toHaveBeenCalled();

		preferenceStart.resolve( undefined );
		await start;

		expect( harness.loadLocalization ).toHaveBeenCalledWith( Language.ENGLISH );
		expect( harness.currentTabReader.read ).toHaveBeenCalledOnce();
		expect( harness.statusClient.readStatus ).toHaveBeenCalledWith( CURRENT_TAB );
		expect( harness.shell.copy ).toBe( harness.localization.popup );
		expect( harness.shell.projection ).toBe( UNPROTECTED_PROJECTION );
		expect( harness.shell.nowEpochMilliseconds ).toBe( 1_800_000_000_000 );
		expect( harness.shell.faviconSource ).toBe( 'chrome-extension://extension-id/_favicon/' );
		expect( harness.faviconProvider.getSource ).toHaveBeenCalledWith( 'example.com' );
		expect( harness.shell.settingsPageUrl ).toBe( harness.options.settingsPageUrl );
		expect( harness.shell.statisticsPageUrl ).toBe( harness.options.statisticsPageUrl );
		expect( harness.documentTarget.title ).toBe( harness.localization.document.popupTitle );
		expect( harness.removeProperty ).toHaveBeenNthCalledWith( 1, 'color-scheme' );
		expect( harness.removeProperty ).toHaveBeenNthCalledWith( 2, 'background' );
		expect( harness.removeProperty ).toHaveBeenNthCalledWith( 3, 'visibility' );
	} );

	it( 'applies live language changes and retains usable copy after a later failure', async () => {
		const harness = createHarness();

		await startPopupPage( harness.options );
		harness.languageListener()?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( harness.shell.copy ).toBe( harness.liveLocalization.popup );
		} );
		expect( harness.documentTarget.title ).toBe( 'Japanese popup' );

		harness.loadLocalization.mockRejectedValueOnce( new Error( 'Catalog unavailable.' ) );
		harness.languageListener()?.( Language.FRENCH );
		await vi.waitFor( () => {
			expect( harness.loadLocalization ).toHaveBeenCalledWith( Language.FRENCH );
		} );
		expect( harness.shell.copy ).toBe( harness.liveLocalization.popup );
	} );

	it( 'requests enrollment directly from the add event and refreshes successful status', async () => {
		const harness = createHarness();
		const enrollmentResult = Promise.withResolvers<ProtectedSiteEnrollmentResult>();

		harness.enrollment.add.mockReturnValueOnce( enrollmentResult.promise );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );

		expect( harness.shell.adding ).toBe( true );
		expect( harness.enrollment.add ).toHaveBeenCalledWith( CURRENT_TAB.url, false );
		expect( harness.statusClient.refreshStatus ).not.toHaveBeenCalled();

		enrollmentResult.resolve( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			configuration: {
				...TestEmptyProtectionConfiguration,
				sites: [ TEST_SITE ],
			},
			site: TEST_SITE,
		} );
		await vi.waitFor( () => {
			expect( harness.shell.adding ).toBe( false );
			expect( harness.shell.projection ).toBe( PROTECTED_PROJECTION );
		} );
		expect( harness.statusClient.refreshStatus ).toHaveBeenCalledWith( CURRENT_TAB );
		expect( harness.shell.operationError ).toBeNull();
		expect( harness.shell.focusManageAction ).toHaveBeenCalledOnce();
	} );

	it.each( [
		[ ProtectedSiteEnrollmentStatus.PERMISSION_DENIED, PopupOperationError.PERMISSION_DENIED ],
		[ ProtectedSiteEnrollmentStatus.PERMISSION_ERROR, PopupOperationError.PERMISSION_ERROR ],
		[ ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED, PopupOperationError.PERMISSION_RETAINED ],
		[ ProtectedSiteEnrollmentStatus.REJECTED, PopupOperationError.SAVE_ERROR ],
		[ ProtectedSiteEnrollmentStatus.SAVE_ERROR, PopupOperationError.SAVE_ERROR ],
	] as const )( 'maps %s enrollment to a recoverable popup error', async ( status, expectedError ) => {
		const harness = createHarness();
		const result = status === ProtectedSiteEnrollmentStatus.REJECTED
			? { status, reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE }
			: { status };

		harness.enrollment.add.mockResolvedValueOnce( result );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.shell.adding ).toBe( false );
		} );

		expect( harness.shell.operationError ).toBe( expectedError );
		expect( harness.statusClient.refreshStatus ).not.toHaveBeenCalled();
	} );

	it( 'refreshes status when the website was already added concurrently', async () => {
		const harness = createHarness();

		harness.enrollment.add.mockResolvedValueOnce( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.shell.adding ).toBe( false );
			expect( harness.shell.projection ).toBe( PROTECTED_PROJECTION );
		} );

		expect( harness.statusClient.refreshStatus ).toHaveBeenCalledWith( CURRENT_TAB );
		expect( harness.shell.operationError ).toBeNull();
		expect( harness.shell.focusManageAction ).toHaveBeenCalledOnce();
	} );

	it( 'ignores add requests when the cached tab is unavailable', async () => {
		const harness = createHarness( UNAVAILABLE_PROJECTION );

		harness.currentTabReader.read.mockResolvedValueOnce( null );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );

		expect( harness.enrollment.add ).not.toHaveBeenCalled();
	} );

	it( 're-reads the current tab before a user-requested status retry', async () => {
		const harness = createHarness( UNAVAILABLE_PROJECTION );
		const nextTab = { ...CURRENT_TAB, id: 19, url: 'https://next.example/' };

		harness.currentTabReader.read.mockResolvedValueOnce( null ).mockResolvedValueOnce( nextTab );
		harness.statusClient.refreshStatus.mockResolvedValueOnce( UNPROTECTED_PROJECTION );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.statusClient.refreshStatus ).toHaveBeenCalledWith( nextTab );
		} );
		expect( harness.currentTabReader.read ).toHaveBeenCalledTimes( 2 );
		expect( harness.shell.projection ).toBe( UNPROTECTED_PROJECTION );
	} );

	it( 'keeps user-requested status retries single-flight', async () => {
		const harness = createHarness( UNAVAILABLE_PROJECTION );
		const currentTab = Promise.withResolvers<typeof CURRENT_TAB>();

		await startPopupPage( harness.options );
		harness.currentTabReader.read.mockReturnValueOnce( currentTab.promise );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );

		expect( harness.shell.retrying ).toBe( true );
		expect( harness.currentTabReader.read ).toHaveBeenCalledTimes( 2 );
		currentTab.resolve( CURRENT_TAB );
		await vi.waitFor( () => {
			expect( harness.statusClient.refreshStatus ).toHaveBeenCalledOnce();
			expect( harness.shell.retrying ).toBe( false );
		} );
		expect( harness.shell.focusAfterRetry ).toHaveBeenCalledOnce();

		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.statusClient.refreshStatus ).toHaveBeenCalledTimes( 2 );
		} );
		expect( harness.shell.focusAfterRetry ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'ticks allowance time locally and refreshes once at expiry', async () => {
		const allowanceProjection: PopupProjection = {
			...PROTECTED_PROJECTION,
			currentSite: ACTIVE_PROTECTED_CURRENT_SITE,
			activeScopes: [ {
				scopeId: DefaultProtectionScopeId,
				kind: PopupScopeKind.SHARED,
				siteCount: 2,
				site: null,
				isCurrentScope: true,
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: 1_800_000_002_000,
			} ],
		};
		const harness = createHarness( allowanceProjection );

		harness.statusClient.refreshStatus.mockResolvedValueOnce( PROTECTED_PROJECTION );
		await startPopupPage( harness.options );
		expect( harness.pageWindowHarness.pageWindow.setInterval ).toHaveBeenCalledWith(
			expect.any( Function ),
			1_000,
		);

		harness.now.mockReturnValueOnce( 1_800_000_001_000 );
		harness.pageWindowHarness.tick();
		expect( harness.shell.nowEpochMilliseconds ).toBe( 1_800_000_001_000 );
		expect( harness.statusClient.refreshStatus ).not.toHaveBeenCalled();

		harness.now.mockReturnValueOnce( 1_800_000_002_000 );
		harness.pageWindowHarness.tick();
		await vi.waitFor( () => {
			expect( harness.statusClient.refreshStatus ).toHaveBeenCalledOnce();
		} );
		expect( harness.pageWindowHarness.pageWindow.clearInterval ).toHaveBeenCalledWith( 29 );
	} );

	it( 'does not create a local countdown interval for Waiting', async () => {
		const waitingProjection: PopupProjection = {
			...PROTECTED_PROJECTION,
			currentSite: ACTIVE_PROTECTED_CURRENT_SITE,
			activeScopes: [ {
				scopeId: DefaultProtectionScopeId,
				kind: PopupScopeKind.SHARED,
				siteCount: 1,
				site: null,
				isCurrentScope: true,
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 8_000,
			} ],
		};
		const harness = createHarness( waitingProjection );

		await startPopupPage( harness.options );

		expect( harness.pageWindowHarness.pageWindow.setInterval ).not.toHaveBeenCalled();
	} );

	it( 'stops observers, events, and countdown work when the popup closes', async () => {
		const allowanceProjection: PopupProjection = {
			...PROTECTED_PROJECTION,
			currentSite: ACTIVE_PROTECTED_CURRENT_SITE,
			activeScopes: [ {
				scopeId: DefaultProtectionScopeId,
				kind: PopupScopeKind.SHARED,
				siteCount: 1,
				site: null,
				isCurrentScope: true,
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: 1_800_000_020_000,
			} ],
		};
		const harness = createHarness( allowanceProjection );

		await startPopupPage( harness.options );
		harness.pageWindowHarness.dispatchPageHide();
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );

		expect( harness.preferencesController.removeLanguageChangeListener )
			.toHaveBeenCalledWith( harness.languageListener() );
		expect( harness.preferencesController.stop ).toHaveBeenCalledOnce();
		expect( harness.pageWindowHarness.pageWindow.clearInterval ).toHaveBeenCalledWith( 29 );
		expect( harness.enrollment.add ).not.toHaveBeenCalled();
	} );

	it( 'reveals a localized recovery state after terminal startup failure', async () => {
		const harness = createHarness();

		harness.preferencesController.start.mockRejectedValueOnce( new Error( 'Storage failed.' ) );
		await expect( bootstrapPopupPage( harness.options ) ).resolves.toBeUndefined();

		expect( harness.shell.copy ).toBe( harness.localization.popup );
		expect( harness.shell.projection ).toEqual( UNAVAILABLE_PROJECTION );
		expect( harness.preferencesController.stop ).toHaveBeenCalledOnce();
		expect( harness.removeProperty ).toHaveBeenCalledWith( 'visibility' );
	} );

	it( 'contains a rejected refresh without replacing the last projection', async () => {
		const harness = createHarness( UNAVAILABLE_PROJECTION );

		await startPopupPage( harness.options );
		harness.statusClient.refreshStatus.mockRejectedValueOnce( new Error( 'Background stopped.' ) );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		await settlePageWork();

		expect( harness.shell.projection ).toBe( UNAVAILABLE_PROJECTION );
		expect( harness.shell.retrying ).toBe( false );
		expect( harness.shell.focusAfterRetry ).not.toHaveBeenCalled();
	} );

	it( 'uses a monogram when the favicon provider rejects the current host', async () => {
		const harness = createHarness();

		harness.faviconProvider.getSource.mockImplementationOnce( () => {
			throw new Error( 'Cached favicon API unavailable.' );
		} );
		await startPopupPage( harness.options );

		expect( harness.shell.faviconSource ).toBeNull();
	} );

	it( 'clears the favicon when the available tab is not an ordinary website', async () => {
		const harness = createHarness( {
			status: PopupProjectionStatus.AVAILABLE,
			capturedAtEpochMilliseconds: 1_800_000_000_000,
			currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
			activeScopes: [],
		} );

		await startPopupPage( harness.options );

		expect( harness.shell.faviconSource ).toBeNull();
		expect( harness.faviconProvider.getSource ).not.toHaveBeenCalled();
	} );

	it( 'refreshes at the earliest of multiple concurrent allowance expiries', async () => {
		const harness = createHarness( {
			...PROTECTED_PROJECTION,
			currentSite: ACTIVE_PROTECTED_CURRENT_SITE,
			activeScopes: [
				{
					scopeId: DefaultProtectionScopeId,
					kind: PopupScopeKind.SHARED,
					siteCount: 2,
					site: null,
					isCurrentScope: true,
					phase: PopupTimerPhase.ALLOWANCE,
					expiresAtEpochMilliseconds: 1_800_000_010_000,
				},
				{
					scopeId: EXAMPLE_SCOPE_ID,
					kind: PopupScopeKind.INDEPENDENT,
					siteCount: 1,
					site: {
						...TEST_SITE,
						rule: { ...TEST_SITE.rule, scopeId: EXAMPLE_SCOPE_ID },
					},
					isCurrentScope: false,
					phase: PopupTimerPhase.ALLOWANCE,
					expiresAtEpochMilliseconds: 1_800_000_005_000,
				},
			],
		} );

		await startPopupPage( harness.options );
		harness.now.mockReturnValueOnce( 1_800_000_005_000 );
		harness.pageWindowHarness.tick();
		await vi.waitFor( () => {
			expect( harness.statusClient.refreshStatus ).toHaveBeenCalledOnce();
		} );
	} );

	it( 'discards stale localization while waiting for the latest selected language', async () => {
		const harness = createHarness();
		const initialLocalization = Promise.withResolvers<Readonly<typeof harness.localization>>();

		harness.loadLocalization.mockImplementation( ( language ) => language === Language.ENGLISH
			? initialLocalization.promise
			: Promise.resolve( harness.liveLocalization ) );
		const start = startPopupPage( harness.options );
		await vi.waitFor( () => {
			expect( harness.loadLocalization ).toHaveBeenCalledWith( Language.ENGLISH );
		} );

		harness.preferencesController.language = Language.JAPANESE;
		harness.languageListener()?.( Language.JAPANESE );
		await vi.waitFor( () => {
			expect( harness.shell.copy ).toBe( harness.liveLocalization.popup );
		} );
		initialLocalization.resolve( harness.localization );
		await start;

		expect( harness.shell.copy ).toBe( harness.liveLocalization.popup );
	} );

	it( 'discards a retry when the popup closes during active-tab lookup', async () => {
		const harness = createHarness();
		const currentTab = Promise.withResolvers<typeof CURRENT_TAB>();

		await startPopupPage( harness.options );
		harness.currentTabReader.read.mockReturnValueOnce( currentTab.promise );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		harness.pageWindowHarness.dispatchPageHide();
		currentTab.resolve( CURRENT_TAB );
		await settlePageWork();

		expect( harness.statusClient.refreshStatus ).not.toHaveBeenCalled();
	} );

	it( 'discards a status result when the popup closes during background refresh', async () => {
		const harness = createHarness();
		const refreshedStatus = Promise.withResolvers<PopupProjection>();

		await startPopupPage( harness.options );
		harness.statusClient.refreshStatus.mockReturnValueOnce( refreshedStatus.promise );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.statusClient.refreshStatus ).toHaveBeenCalledOnce();
		} );
		harness.pageWindowHarness.dispatchPageHide();
		refreshedStatus.resolve( PROTECTED_PROJECTION );
		await settlePageWork();

		expect( harness.shell.projection ).toBe( UNPROTECTED_PROJECTION );
	} );

	it( 'does not finish enrollment after the popup has closed', async () => {
		const harness = createHarness();
		const enrollmentResult = Promise.withResolvers<ProtectedSiteEnrollmentResult>();

		harness.enrollment.add.mockReturnValueOnce( enrollmentResult.promise );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		harness.pageWindowHarness.dispatchPageHide();
		enrollmentResult.resolve( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			configuration: TestEmptyProtectionConfiguration,
			site: TEST_SITE,
		} );
		await settlePageWork();

		expect( harness.statusClient.refreshStatus ).not.toHaveBeenCalled();
	} );

	it( 'discards an enrollment failure after the popup has closed', async () => {
		const harness = createHarness();
		const enrollmentResult = Promise.withResolvers<ProtectedSiteEnrollmentResult>();

		harness.enrollment.add.mockReturnValueOnce( enrollmentResult.promise );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		harness.pageWindowHarness.dispatchPageHide();
		enrollmentResult.reject( new Error( 'Enrollment failed after dismissal.' ) );
		await settlePageWork();

		expect( harness.shell.operationError ).toBeNull();
	} );

	it( 'shows a save recovery when asynchronous enrollment rejects', async () => {
		const harness = createHarness();

		harness.enrollment.add.mockRejectedValueOnce( new Error( 'Enrollment failed.' ) );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.shell.adding ).toBe( false );
		} );

		expect( harness.shell.operationError ).toBe( PopupOperationError.SAVE_ERROR );
	} );

	it( 'shows a save recovery when enrollment cannot start synchronously', async () => {
		const harness = createHarness();

		harness.enrollment.add.mockImplementationOnce( () => {
			throw new Error( 'Enrollment could not start.' );
		} );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );

		expect( harness.shell.adding ).toBe( false );
		expect( harness.shell.operationError ).toBe( PopupOperationError.SAVE_ERROR );
	} );

	it( 'does not move focus when successful enrollment status cannot refresh', async () => {
		const harness = createHarness();

		harness.statusClient.refreshStatus.mockRejectedValueOnce( new Error( 'Refresh failed.' ) );
		await startPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		await vi.waitFor( () => {
			expect( harness.shell.adding ).toBe( false );
		} );

		expect( harness.shell.focusManageAction ).not.toHaveBeenCalled();
	} );

	it( 'keeps terminal cleanup idempotent when startup rejects after dismissal', async () => {
		const harness = createHarness();
		const preferenceStart = Promise.withResolvers<undefined>();

		harness.preferencesController.start.mockReturnValueOnce( preferenceStart.promise );
		const start = startPopupPage( harness.options );
		harness.pageWindowHarness.dispatchPageHide();
		preferenceStart.reject( new Error( 'Popup dismissed.' ) );
		await expect( start ).rejects.toThrow( 'Popup dismissed.' );

		expect( harness.preferencesController.stop ).toHaveBeenCalledOnce();
	} );

	it( 'stops startup after preferences settle following popup dismissal', async () => {
		const harness = createHarness();
		const preferenceStart = Promise.withResolvers<undefined>();

		harness.preferencesController.start.mockReturnValueOnce( preferenceStart.promise );
		const start = startPopupPage( harness.options );
		harness.pageWindowHarness.dispatchPageHide();
		preferenceStart.resolve( undefined );
		await start;

		expect( harness.loadLocalization ).not.toHaveBeenCalled();
		expect( harness.currentTabReader.read ).not.toHaveBeenCalled();
		expect( harness.statusClient.readStatus ).not.toHaveBeenCalled();
		expect( harness.removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'stops startup after localization settles following popup dismissal', async () => {
		const harness = createHarness();
		const localization = Promise.withResolvers<Readonly<typeof harness.localization>>();

		harness.loadLocalization.mockReturnValueOnce( localization.promise );
		const start = startPopupPage( harness.options );
		await vi.waitFor( () => {
			expect( harness.loadLocalization ).toHaveBeenCalledOnce();
		} );
		harness.pageWindowHarness.dispatchPageHide();
		localization.resolve( harness.localization );
		await start;

		expect( harness.currentTabReader.read ).not.toHaveBeenCalled();
		expect( harness.statusClient.readStatus ).not.toHaveBeenCalled();
		expect( harness.removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'stops startup after active-tab lookup settles following popup dismissal', async () => {
		const harness = createHarness();
		const currentTab = Promise.withResolvers<typeof CURRENT_TAB>();

		harness.currentTabReader.read.mockReturnValueOnce( currentTab.promise );
		const start = startPopupPage( harness.options );
		await vi.waitFor( () => {
			expect( harness.currentTabReader.read ).toHaveBeenCalledOnce();
		} );
		harness.pageWindowHarness.dispatchPageHide();
		currentTab.resolve( CURRENT_TAB );
		await start;

		expect( harness.statusClient.readStatus ).not.toHaveBeenCalled();
		expect( harness.removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'does not reveal status that resolves after popup dismissal', async () => {
		const harness = createHarness();
		const initialStatus = Promise.withResolvers<PopupProjection>();

		harness.statusClient.readStatus.mockReturnValueOnce( initialStatus.promise );
		const start = startPopupPage( harness.options );
		await vi.waitFor( () => {
			expect( harness.statusClient.readStatus ).toHaveBeenCalledOnce();
		} );
		harness.pageWindowHarness.dispatchPageHide();
		initialStatus.resolve( UNPROTECTED_PROJECTION );
		await start;

		expect( harness.shell.projection ).toBeNull();
		expect( harness.removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'restarts complete popup startup from terminal recovery', async () => {
		const harness = createHarness();

		harness.preferencesController.start.mockRejectedValueOnce( new Error( 'Storage failed.' ) );
		await bootstrapPopupPage( harness.options );
		harness.shell.dispatchEvent( new Event( PopupRetryRequestEventName ) );
		expect( harness.shell.retrying ).toBe( true );
		await vi.waitFor( () => {
			expect( harness.preferencesController.start ).toHaveBeenCalledTimes( 2 );
			expect( harness.shell.projection ).toBe( UNPROTECTED_PROJECTION );
			expect( harness.shell.retrying ).toBe( false );
		} );
		expect( harness.shell.focusAfterRetry ).toHaveBeenCalledOnce();
	} );
} );
