import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Language } from '../../../../domains/preferences/types';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { TestInstant } from '../../../../domains/protection/types/__fixtures__/protection-event';
import { type StatisticsRuntimeOptions } from '../../../statistics/services/statistics-runtime';
import { type BrowserProtectionRuntimeOptions } from '../browser-protection-runtime';
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
	createBrowserProtectionAdapter: vi.fn(),
	createBrowserProtectionRuntime: vi.fn<( options: BrowserProtectionRuntimeOptions ) => unknown>(),
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
	startProtectionController: vi.fn(),
	startToolbarLanguage: vi.fn<( refreshToolbarBadge: ToolbarBadgeRefresh ) => void>(),
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
	} );

	it( 'constructs the browser-backed runtime and starts its synchronous controllers', async () => {
		const preferencesStorage = { load: vi.fn(), save: vi.fn() };
		const protectionStorage = { load: vi.fn(), save: vi.fn() };
		const configurationStorage = { load: vi.fn(), save: vi.fn() };
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
		};
		const protectionController = {
			start: backgroundMocks.startProtectionController,
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

		startProtectionBackgroundApplication( { browser: fakeBrowser } );

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
		expect( backgroundMocks.startProtectionController ).toHaveBeenCalledOnce();
		expect( backgroundMocks.startToolbarLanguage ).toHaveBeenCalledOnce();
		const refreshToolbarBadge = backgroundMocks.startToolbarLanguage.mock.calls[ 0 ]?.[ 0 ];

		if ( refreshToolbarBadge === undefined ) {
			throw new TypeError( 'Expected toolbar refresh operation.' );
		}

		await refreshToolbarBadge();
		expect( backgroundMocks.refreshToolbarBadge ).toHaveBeenCalledOnce();
	} );
} );
