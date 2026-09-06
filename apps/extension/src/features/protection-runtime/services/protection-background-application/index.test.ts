import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Language } from '../../../../domains/preferences/types';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { TestInstant } from '../../../../domains/protection/types/__fixtures__/protection-event';
import { type StatisticsRuntimeOptions } from '../../../statistics/services/statistics-runtime';
import { type LocalDataResetOptions } from '../../../../domains/local-data/services/local-data-reset/types';
import { type LocalDataResetControllerOptions } from '../../../settings/services/local-data-reset-controller/types';
import { type PopupEnrollmentControllerOptions } from '../../../popup/services/popup-enrollment-controller/types';
import { type BrowserProtectionRuntimeOptions } from '../browser-protection-runtime';
import { type PopupBackgroundControllerOptions } from '../../../popup/services/popup-background-controller';
import { type ProtectionBackgroundControllerOptions } from '../protection-background-controller';
import {
	type ToolbarBadgeRefresh,
	type ToolbarLanguageControllerOptions,
} from '../toolbar-language-controller';
import { type ToolbarBadgeCopy } from '../../utils/toolbar-badge-projection';

/**
 * Constructor and startup doubles for the background application composition.
 * @since 0.1.0 Initial implementation.
 */
const backgroundMocks = vi.hoisted( () => ( {
	createBrowserProtectionConfigurationEditor: vi.fn().mockReturnValue( { editor: {} } ),
	createProtectedSiteEnrollmentService: vi.fn().mockReturnValue( { add: vi.fn() } ),
	createPopupEnrollmentController: vi.fn<( options: PopupEnrollmentControllerOptions ) => unknown>(),
	startPopupEnrollment: vi.fn(),
	createBrowserProtectionAdapter: vi.fn(),
	createBrowserProtectionRuntime: vi.fn<( options: BrowserProtectionRuntimeOptions ) => unknown>(),
	createPopupBackgroundController: vi.fn<( options: PopupBackgroundControllerOptions ) => unknown>(),
	createPreferencesStorageService: vi.fn(),
	createProtectionBackgroundController: vi.fn<( options: ProtectionBackgroundControllerOptions ) => unknown>(),
	createProtectionConfigurationStorageService: vi.fn(),
	createProtectionCoordinator: vi.fn(),
	createProtectionStorageService: vi.fn(),
	createSitePermissionManager: vi.fn(),
	createStatisticsRuntime: vi.fn<( options: StatisticsRuntimeOptions ) => unknown>(),
	createStatisticsSessionStorageService: vi.fn(),
	createStatisticsStorageService: vi.fn(),
	createToolbarLanguageController: vi.fn<( options: ToolbarLanguageControllerOptions ) => unknown>(),
	filterConfiguration: vi.fn(),
	openOnInstall: vi.fn(),
	refreshToolbarBadge: vi.fn(),
	refreshProtection: vi.fn(),
	waitForProtectionReady: vi.fn(),
	startProtectionController: vi.fn(),
	startPopupController: vi.fn(),
	startToolbarLanguage: vi.fn<( refreshToolbarBadge: ToolbarBadgeRefresh ) => void>(),
	createLocalDataReset: vi.fn<( options: LocalDataResetOptions ) => unknown>(),
	createLocalDataResetController: vi.fn<( options: LocalDataResetControllerOptions ) => unknown>(),
	revokeWebsiteAccess: vi.fn().mockResolvedValue( true ),
	startResetController: vi.fn(),
	suspendForDataReset: vi.fn().mockResolvedValue( undefined ),
	resumeAfterDataReset: vi.fn().mockResolvedValue( undefined ),
} ) );

vi.mock( '../../../../domains/local-data/services/local-data-reset', () => ( {
	createLocalDataReset: backgroundMocks.createLocalDataReset,
} ) );

vi.mock( '../../../settings/services/local-data-reset-controller', () => ( {
	createLocalDataResetController: backgroundMocks.createLocalDataResetController,
} ) );

vi.mock( '../../../settings/services/revoke-website-access', () => ( {
	revokeWebsiteAccess: backgroundMocks.revokeWebsiteAccess,
} ) );

vi.mock( '../../../../domains/protection/services/browser-protection-configuration-editor', () => ( {
	createBrowserProtectionConfigurationEditor: backgroundMocks.createBrowserProtectionConfigurationEditor,
} ) );

vi.mock( '../../../protected-sites/services/protected-site-enrollment', async ( importOriginal ) => ( {
	...await importOriginal<typeof import( '../../../protected-sites/services/protected-site-enrollment' )>(),
	createProtectedSiteEnrollmentService: backgroundMocks.createProtectedSiteEnrollmentService,
} ) );

vi.mock( '../../../popup/services/popup-enrollment-controller', () => ( {
	createPopupEnrollmentController: backgroundMocks.createPopupEnrollmentController,
} ) );

vi.mock( '../../../../domains/preferences/services', () => ( {
	createPreferencesStorageService: backgroundMocks.createPreferencesStorageService,
} ) );

vi.mock( '../../../../domains/protection', () => ( {
	createProtectionConfigurationStorageService: backgroundMocks.createProtectionConfigurationStorageService,
	createProtectionCoordinator: backgroundMocks.createProtectionCoordinator,
	createProtectionStorageService: backgroundMocks.createProtectionStorageService,
} ) );

vi.mock( '../../../../domains/statistics', () => ( {
	createStatisticsSessionStorageService: backgroundMocks.createStatisticsSessionStorageService,
	createStatisticsStorageService: backgroundMocks.createStatisticsStorageService,
} ) );

vi.mock( '../../../onboarding/services/open-on-install', () => ( {
	registerOnboardingOpenOnInstall: backgroundMocks.openOnInstall,
} ) );

vi.mock( '../../../protected-sites/services/site-permission-manager', () => ( {
	createSitePermissionManager: backgroundMocks.createSitePermissionManager,
} ) );

vi.mock( '../../../statistics/services/statistics-runtime', () => ( {
	createStatisticsRuntime: backgroundMocks.createStatisticsRuntime,
} ) );

vi.mock( '../browser-protection-adapter', () => ( {
	createBrowserProtectionAdapter: backgroundMocks.createBrowserProtectionAdapter,
} ) );

vi.mock( '../browser-protection-runtime', () => ( {
	createBrowserProtectionRuntime: backgroundMocks.createBrowserProtectionRuntime,
} ) );

vi.mock( '../../../popup/services/popup-background-controller', () => ( {
	createPopupBackgroundController: backgroundMocks.createPopupBackgroundController,
} ) );

vi.mock( '../protection-background-controller', () => ( {
	createProtectionBackgroundController: backgroundMocks.createProtectionBackgroundController,
} ) );

vi.mock( '../toolbar-language-controller', () => ( {
	createToolbarLanguageController: backgroundMocks.createToolbarLanguageController,
} ) );

import { startProtectionBackgroundApplication } from './index';

describe( 'startProtectionBackgroundApplication', () => {
	beforeEach( () => {
		fakeBrowser.reset();
		vi.clearAllMocks();
		vi.spyOn( Date, 'now' ).mockReturnValue( TestInstant );
		vi.spyOn( fakeBrowser.i18n, 'getUILanguage' ).mockReturnValue( 'en-US' );
	} );

	afterEach( () => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	} );

	it.each( [ true, false ] )( 'constructs the browser-backed runtime with Chrome enrollment ownership: %s', async ( isChrome ) => {
		vi.stubEnv( 'CHROME', isChrome ? 'true' : '' );
		const locks = {};
		vi.stubGlobal( 'navigator', { locks } );
		const preferencesStorage = { load: vi.fn(), save: vi.fn() };
		const protectionStorage = { load: vi.fn(), save: vi.fn() };
		const configurationStorage = { load: vi.fn(), save: vi.fn() };
		const protectionEditor = {};
		const enrollment = { add: vi.fn() };
		const coordinator = { dispatch: vi.fn() };
		const browserAdapter = { browserAdapter: true };
		const statisticsStorage = { statisticsStorage: true };
		const statisticsSessionStorage = { statisticsSessionStorage: true };
		const statisticsRuntime = { statisticsRuntime: true };
		const toolbarCopy: ToolbarBadgeCopy = {
			inactive: { text: '', title: 'TOCus' },
			formatActiveTitle: vi.fn(),
			formatAllowance: vi.fn(),
			formatMultipleActive: vi.fn(),
			formatMultipleIndicator: vi.fn(),
			formatWaiting: vi.fn(),
		};
		const toolbarLanguageController = {
			copy: toolbarCopy,
			start: backgroundMocks.startToolbarLanguage,
		};
		const runtime = {
			refreshToolbarBadge: backgroundMocks.refreshToolbarBadge,
			suspendForDataReset: backgroundMocks.suspendForDataReset,
			resumeAfterDataReset: backgroundMocks.resumeAfterDataReset,
		};
		const protectionController = {
			refresh: backgroundMocks.refreshProtection,
			start: backgroundMocks.startProtectionController,
			waitUntilReady: backgroundMocks.waitForProtectionReady,
		};
		const popupController = {
			start: backgroundMocks.startPopupController,
		};

		backgroundMocks.createPreferencesStorageService.mockReturnValue( preferencesStorage );
		backgroundMocks.createProtectionStorageService.mockReturnValue( protectionStorage );
		backgroundMocks.createProtectionConfigurationStorageService.mockReturnValue( configurationStorage );
		backgroundMocks.createProtectionCoordinator.mockReturnValue( coordinator );
		backgroundMocks.createBrowserProtectionAdapter.mockReturnValue( browserAdapter );
		backgroundMocks.createSitePermissionManager.mockReturnValue( {
			filterConfiguration: backgroundMocks.filterConfiguration,
		} );
		backgroundMocks.createStatisticsStorageService.mockReturnValue( statisticsStorage );
		backgroundMocks.createStatisticsSessionStorageService.mockReturnValue( statisticsSessionStorage );
		backgroundMocks.createStatisticsRuntime.mockReturnValue( statisticsRuntime );
		backgroundMocks.createToolbarLanguageController.mockReturnValue( toolbarLanguageController );
		backgroundMocks.createBrowserProtectionRuntime.mockReturnValue( runtime );
		backgroundMocks.createProtectionBackgroundController.mockReturnValue( protectionController );
		backgroundMocks.createPopupBackgroundController.mockReturnValue( popupController );
		backgroundMocks.createPopupEnrollmentController.mockReturnValue( {
			start: backgroundMocks.startPopupEnrollment,
		} );
		backgroundMocks.createBrowserProtectionConfigurationEditor.mockReturnValue( { editor: protectionEditor } );
		backgroundMocks.createProtectedSiteEnrollmentService.mockReturnValue( enrollment );
		const reset = { reset: vi.fn(), recover: vi.fn() };
		backgroundMocks.createLocalDataReset.mockReturnValue( reset );
		backgroundMocks.createLocalDataResetController.mockReturnValue( {
			start: backgroundMocks.startResetController,
		} );

		startProtectionBackgroundApplication( { browser: fakeBrowser } );

		if ( isChrome ) {
			expect( backgroundMocks.createBrowserProtectionConfigurationEditor ).not.toHaveBeenCalled();
			expect( backgroundMocks.createProtectedSiteEnrollmentService ).not.toHaveBeenCalled();
			const enrollmentOptions = backgroundMocks.createPopupEnrollmentController.mock.calls[ 0 ]?.[ 0 ];
			if ( enrollmentOptions === undefined ) {
				throw new TypeError( 'Expected popup enrollment options.' );
			}
			const firstResult = { status: 'save-error' as const };
			enrollment.add.mockResolvedValueOnce( firstResult );
			const firstAddition = enrollmentOptions.enrollment.add( 'github.com', false );
			expect( enrollment.add ).toHaveBeenCalledWith( 'github.com', false );
			await expect( firstAddition ).resolves.toBe( firstResult );
			expect( backgroundMocks.createBrowserProtectionConfigurationEditor ).toHaveBeenCalledWith( {
				area: fakeBrowser.storage.local,
				cryptography: crypto,
				locks,
			} );
			expect( backgroundMocks.createProtectedSiteEnrollmentService ).toHaveBeenCalledWith( {
				editor: protectionEditor,
				permissionManager: { filterConfiguration: backgroundMocks.filterConfiguration },
			} );
			expect( backgroundMocks.createPopupEnrollmentController ).toHaveBeenCalledWith( {
				enrollment: enrollmentOptions.enrollment,
				popupPageUrl: fakeBrowser.runtime.getURL( '/popup.html' ),
				runtime: fakeBrowser.runtime,
			} );
			expect( backgroundMocks.startPopupEnrollment ).toHaveBeenCalledOnce();
			const nextEditor = { editor: { fixture: 'next-generation' } };
			const nextResult = { status: 'permission-denied' as const };
			const nextEnrollment = { add: vi.fn().mockResolvedValue( nextResult ) };
			backgroundMocks.createBrowserProtectionConfigurationEditor.mockReturnValueOnce( nextEditor );
			backgroundMocks.createProtectedSiteEnrollmentService.mockReturnValueOnce( nextEnrollment );
			const nextAddition = enrollmentOptions.enrollment.add( 'youtube.com', true );
			expect( nextEnrollment.add ).toHaveBeenCalledWith( 'youtube.com', true );
			await expect( nextAddition ).resolves.toBe( nextResult );
			expect( backgroundMocks.createBrowserProtectionConfigurationEditor ).toHaveBeenCalledTimes( 2 );
			expect( backgroundMocks.createProtectedSiteEnrollmentService ).toHaveBeenLastCalledWith( {
				editor: nextEditor.editor,
				permissionManager: { filterConfiguration: backgroundMocks.filterConfiguration },
			} );
		} else {
			expect( backgroundMocks.createBrowserProtectionConfigurationEditor ).not.toHaveBeenCalled();
			expect( backgroundMocks.createPopupEnrollmentController ).not.toHaveBeenCalled();
		}

		expect( backgroundMocks.openOnInstall ).toHaveBeenCalledWith( { browser: fakeBrowser } );
		expect( backgroundMocks.createPreferencesStorageService ).toHaveBeenCalledWith( {
			area: fakeBrowser.storage.local,
		} );
		expect( backgroundMocks.createProtectionStorageService ).toHaveBeenCalledWith( expect.objectContaining( {
			durableArea: fakeBrowser.storage.local,
			sessionArea: fakeBrowser.storage.session,
		} ) );
		expect( backgroundMocks.createProtectionConfigurationStorageService ).toHaveBeenCalledWith( {
			area: fakeBrowser.storage.local,
		} );
		expect( backgroundMocks.createSitePermissionManager ).toHaveBeenCalledWith( {
			permissions: fakeBrowser.permissions,
		} );
		expect( backgroundMocks.createStatisticsStorageService ).toHaveBeenCalledWith( expect.objectContaining( {
			area: fakeBrowser.storage.local,
		} ) );
		expect( backgroundMocks.createStatisticsSessionStorageService ).toHaveBeenCalledWith( expect.objectContaining( {
			area: fakeBrowser.storage.session,
		} ) );

		const statisticsRuntimeOptions = backgroundMocks.createStatisticsRuntime.mock.calls[ 0 ]?.[ 0 ];

		if ( statisticsRuntimeOptions === undefined ) {
			throw new TypeError( 'Expected statistics runtime options.' );
		}

		expect( statisticsRuntimeOptions.coordinator ).toBe( coordinator );
		expect( statisticsRuntimeOptions.sessionStorage ).toBe( statisticsSessionStorage );
		expect( statisticsRuntimeOptions.storage ).toBe( statisticsStorage );
		expect( statisticsRuntimeOptions.createGenerationId() ).toEqual( expect.any( String ) );

		const toolbarLanguageOptions = backgroundMocks.createToolbarLanguageController.mock.calls[ 0 ]?.[ 0 ];

		if ( toolbarLanguageOptions === undefined ) {
			throw new TypeError( 'Expected toolbar language controller options.' );
		}

		expect( toolbarLanguageOptions.browserLanguage ).toBe( Language.ENGLISH );
		expect( toolbarLanguageOptions.storage ).toBe( preferencesStorage );
		expect( toolbarLanguageOptions.storageChanges ).toBe( fakeBrowser.storage.onChanged );
		expect( toolbarLanguageOptions.createToolbarCopy( Language.ENGLISH ).inactive.title ).toBe( 'TOCus' );

		const runtimeOptions = backgroundMocks.createBrowserProtectionRuntime.mock.calls[ 0 ]?.[ 0 ];

		if ( runtimeOptions === undefined ) {
			throw new TypeError( 'Expected browser protection runtime options.' );
		}

		expect( runtimeOptions.browser ).toBe( browserAdapter );
		expect( runtimeOptions.initiallySuspended ).toBe( true );
		expect( runtimeOptions.configurationStorage ).toBe( configurationStorage );
		expect( runtimeOptions.coordinator ).toBe( coordinator );
		expect( runtimeOptions.statisticsRuntime ).toBe( statisticsRuntime );
		expect( runtimeOptions.toolbarBadgeCopy ).toBe( toolbarCopy );
		expect( runtimeOptions.interruptionPageUrl ).toContain( 'interruption.html' );
		expect( runtimeOptions.createStableId() ).toEqual( expect.any( String ) );
		expect( runtimeOptions.now() ).toBe( TestInstant );
		expect( runtimeOptions.getTimeZone() ).toEqual( expect.any( String ) );
		backgroundMocks.filterConfiguration.mockResolvedValueOnce( TestEmptyProtectionConfiguration );
		await expect(
			runtimeOptions.filterConfiguration( TestEmptyProtectionConfiguration ),
		).resolves.toBe( TestEmptyProtectionConfiguration );

		const controllerOptions = backgroundMocks.createProtectionBackgroundController.mock.calls[ 0 ]?.[ 0 ];

		if ( controllerOptions === undefined ) {
			throw new TypeError( 'Expected protection background controller options.' );
		}

		expect( controllerOptions.browser ).toBe( fakeBrowser );
		expect( controllerOptions.interruptionPageUrl ).toBe( runtimeOptions.interruptionPageUrl );
		expect( controllerOptions.optionsPageUrl ).toContain( 'options.html' );
		expect( controllerOptions.runtime ).toBe( runtime );
		const popupControllerOptions = backgroundMocks.createPopupBackgroundController.mock.calls[ 0 ]?.[ 0 ];

		if ( popupControllerOptions === undefined ) {
			throw new TypeError( 'Expected popup background controller options.' );
		}

		expect( popupControllerOptions.browser ).toBe( fakeBrowser );
		expect( popupControllerOptions.configurationStorage ).toBe( configurationStorage );
		expect( popupControllerOptions.getTimeZone() ).toEqual( expect.any( String ) );
		expect( popupControllerOptions.interruptionPageUrl ).toBe( runtimeOptions.interruptionPageUrl );
		expect( popupControllerOptions.now() ).toBe( TestInstant );
		expect( popupControllerOptions.popupPageUrl ).toContain( 'popup.html' );
		await popupControllerOptions.refreshProtection();
		expect( backgroundMocks.refreshProtection ).toHaveBeenCalledOnce();
		await popupControllerOptions.waitForProtectionReady();
		expect( backgroundMocks.waitForProtectionReady ).toHaveBeenCalledOnce();
		expect( popupControllerOptions.runtime ).toBe( runtime );
		expect( backgroundMocks.startProtectionController ).toHaveBeenCalledOnce();
		expect( backgroundMocks.startPopupController ).toHaveBeenCalledOnce();
		expect( backgroundMocks.startToolbarLanguage ).toHaveBeenCalledOnce();
		const refreshToolbarBadge = backgroundMocks.startToolbarLanguage.mock.calls[ 0 ]?.[ 0 ];

		if ( refreshToolbarBadge === undefined ) {
			throw new TypeError( 'Expected toolbar refresh operation.' );
		}

		await refreshToolbarBadge();
		expect( backgroundMocks.refreshToolbarBadge ).toHaveBeenCalledOnce();

		const resetOptions = backgroundMocks.createLocalDataReset.mock.calls[ 0 ]?.[ 0 ];
		const resetControllerOptions = backgroundMocks.createLocalDataResetController.mock.calls[ 0 ]?.[ 0 ];
		if ( resetOptions === undefined || resetControllerOptions === undefined ) {
			throw new TypeError( 'Expected complete reset composition.' );
		}
		expect( resetOptions.localArea ).toBe( fakeBrowser.storage.local );
		expect( resetOptions.sessionArea ).toBe( fakeBrowser.storage.session );
		expect( resetOptions.locks ).toBe( locks );
		expect( resetOptions.createGeneration() ).toEqual( expect.any( String ) );
		await resetOptions.suspend();
		expect( backgroundMocks.suspendForDataReset ).toHaveBeenCalledOnce();
		await expect( resetOptions.revokeAccess() ).resolves.toBe( true );
		expect( backgroundMocks.revokeWebsiteAccess ).toHaveBeenCalledExactlyOnceWith( fakeBrowser.permissions );
		expect( resetControllerOptions.reset ).toBe( reset );
		expect( resetControllerOptions.localArea ).toBe( fakeBrowser.storage.local );
		expect( resetControllerOptions.onMessage ).toBe( fakeBrowser.runtime.onMessage );
		expect( resetControllerOptions.optionsPageUrl ).toBe( fakeBrowser.runtime.getURL( '/options.html' ) );
		expect( backgroundMocks.startResetController ).toHaveBeenCalledOnce();
		const resetStartOrder = backgroundMocks.startResetController.mock.invocationCallOrder[ 0 ];
		expect( resetStartOrder ).toBeGreaterThan(
			backgroundMocks.startProtectionController.mock.invocationCallOrder[ 0 ] ?? 0,
		);
		expect( resetStartOrder ).toBeGreaterThan(
			backgroundMocks.startPopupController.mock.invocationCallOrder[ 0 ] ?? 0,
		);
		expect( resetStartOrder ).toBeGreaterThan(
			backgroundMocks.startToolbarLanguage.mock.invocationCallOrder[ 0 ] ?? 0,
		);
		const resume = Promise.withResolvers<undefined>();
		backgroundMocks.resumeAfterDataReset.mockReturnValueOnce( resume.promise );
		backgroundMocks.refreshProtection.mockClear();
		const resumeOperation = resetControllerOptions.resume();
		expect( backgroundMocks.resumeAfterDataReset ).toHaveBeenCalledOnce();
		expect( backgroundMocks.refreshProtection ).not.toHaveBeenCalled();
		resume.resolve( undefined );
		await resumeOperation;
		expect( backgroundMocks.refreshProtection ).toHaveBeenCalledOnce();
		const createTab = vi.spyOn( fakeBrowser.tabs, 'create' );
		await resetControllerOptions.openOnboarding();
		expect( createTab ).toHaveBeenCalledExactlyOnceWith( {
			url: fakeBrowser.runtime.getURL( '/onboarding.html' ),
		} );
	} );
} );
