import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { TestEmptyProtectionConfiguration } from '../../domains/protection/types/__fixtures__';
import { TestInstant } from '../../domains/protection/types/__fixtures__/protection-event';
import { type BrowserProtectionRuntimeOptions } from '../../features/protection-runtime/services/browser-protection-runtime';
import { type ProtectionBackgroundControllerOptions } from '../../features/protection-runtime/services/protection-background-controller';
import { type StatisticsRuntimeOptions } from '../../features/statistics/services/statistics-runtime';

/**
 * Provides isolated constructor and startup doubles for the background entrypoint.
 * @since 0.1.0 Initial implementation.
 */
const backgroundMocks = vi.hoisted( () => ( {
	createBrowserProtectionAdapter: vi.fn(),
	createBrowserProtectionRuntime: vi.fn(),
	createProtectionBackgroundController: vi.fn(),
	createProtectionConfigurationStorageService: vi.fn(),
	createProtectionCoordinator: vi.fn(),
	createProtectionStorageService: vi.fn(),
	createSitePermissionManager: vi.fn(),
	createStatisticsRuntime: vi.fn(),
	createStatisticsSessionStorageService: vi.fn(),
	createStatisticsStorageService: vi.fn(),
	filterConfiguration: vi.fn(),
	start: vi.fn(),
} ) );

vi.mock( 'wxt/browser', async () => {
	const { fakeBrowser: mockedBrowser } = await import( 'wxt/testing/fake-browser' );

	return { browser: mockedBrowser };
} );

vi.mock( '../../domains/protection', () => ( {
	createProtectionConfigurationStorageService: backgroundMocks.createProtectionConfigurationStorageService,
	createProtectionCoordinator: backgroundMocks.createProtectionCoordinator,
	createProtectionStorageService: backgroundMocks.createProtectionStorageService,
} ) );

vi.mock( '../../domains/statistics', () => ( {
	createStatisticsSessionStorageService: backgroundMocks.createStatisticsSessionStorageService,
	createStatisticsStorageService: backgroundMocks.createStatisticsStorageService,
} ) );

vi.mock( '../../features/protection-runtime/services/browser-protection-adapter', () => ( {
	createBrowserProtectionAdapter: backgroundMocks.createBrowserProtectionAdapter,
} ) );

vi.mock( '../../features/protection-runtime/services/browser-protection-runtime', () => ( {
	createBrowserProtectionRuntime: backgroundMocks.createBrowserProtectionRuntime,
} ) );

vi.mock( '../../features/protection-runtime/services/protection-background-controller', () => ( {
	createProtectionBackgroundController: backgroundMocks.createProtectionBackgroundController,
} ) );

vi.mock( '../../features/statistics/services/statistics-runtime', () => ( {
	createStatisticsRuntime: backgroundMocks.createStatisticsRuntime,
} ) );

vi.mock( '../../features/protected-sites/services/site-permission-manager', () => ( {
	createSitePermissionManager: backgroundMocks.createSitePermissionManager,
} ) );

import backgroundDefinition from './index';

describe( 'protection background entrypoint', () => {
	beforeEach( () => {
		fakeBrowser.reset();
		vi.clearAllMocks();
		vi.spyOn( Date, 'now' ).mockReturnValue( TestInstant );
	} );

	afterEach( () => {
		vi.restoreAllMocks();
	} );

	it( 'registers browser protection before asynchronous restoration begins', async () => {
		const storage = {
			load: vi.fn(),
			save: vi.fn(),
		};
		const configurationStorage = {
			load: vi.fn(),
			save: vi.fn(),
		};
		const coordinator = {
			acknowledgeStatisticsDeliveryBatch: vi.fn(),
			dispatch: vi.fn(),
			getStatisticsDelivery: vi.fn(),
			getStates: vi.fn(),
			initialize: vi.fn(),
			resetStatisticsDelivery: vi.fn(),
		};
		const browserAdapter = { adapter: true };
		const permissionManager = { filterConfiguration: backgroundMocks.filterConfiguration };
		const statisticsStorage = { localStatistics: true };
		const statisticsSessionStorage = { sessionStatistics: true };
		const statisticsRuntime = { statisticsRuntime: true };
		const runtime = { runtime: true };
		const controller = { start: backgroundMocks.start };

		backgroundMocks.createProtectionStorageService.mockReturnValue( storage );
		backgroundMocks.createProtectionConfigurationStorageService.mockReturnValue( configurationStorage );
		backgroundMocks.createProtectionCoordinator.mockReturnValue( coordinator );
		backgroundMocks.createBrowserProtectionAdapter.mockReturnValue( browserAdapter );
		backgroundMocks.createSitePermissionManager.mockReturnValue( permissionManager );
		backgroundMocks.createStatisticsStorageService.mockReturnValue( statisticsStorage );
		backgroundMocks.createStatisticsSessionStorageService.mockReturnValue( statisticsSessionStorage );
		backgroundMocks.createStatisticsRuntime.mockReturnValue( statisticsRuntime );
		backgroundMocks.createBrowserProtectionRuntime.mockReturnValue( runtime );
		backgroundMocks.createProtectionBackgroundController.mockReturnValue( controller );

		const runBackground: () => void = backgroundDefinition.main.bind( backgroundDefinition );
		runBackground();

		expect( backgroundMocks.createProtectionStorageService ).toHaveBeenCalledOnce();
		expect( backgroundMocks.createProtectionConfigurationStorageService ).toHaveBeenCalledWith( {
			area: fakeBrowser.storage.local,
		} );
		expect( backgroundMocks.createProtectionCoordinator ).toHaveBeenCalledOnce();

		const storageOptions: unknown = backgroundMocks.createProtectionStorageService.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof storageOptions !== 'object' ||
			storageOptions === null ||
			! ( 'durableArea' in storageOptions ) ||
			! ( 'sessionArea' in storageOptions ) ||
			! ( 'createSnapshotId' in storageOptions )
		) {
			throw new TypeError( 'Expected complete protection storage options.' );
		}

		expect( storageOptions.durableArea ).toBe( fakeBrowser.storage.local );
		expect( storageOptions.sessionArea ).toBe( fakeBrowser.storage.session );
		expect( typeof storageOptions.createSnapshotId ).toBe( 'function' );

		const coordinatorOptions: unknown = backgroundMocks.createProtectionCoordinator.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof coordinatorOptions !== 'object' ||
			coordinatorOptions === null ||
			! ( 'storage' in coordinatorOptions ) ||
			! ( 'createSessionContinuityId' in coordinatorOptions ) ||
			! ( 'createProtectionFactBatchId' in coordinatorOptions )
		) {
			throw new TypeError( 'Expected complete protection coordinator options.' );
		}

		expect( coordinatorOptions.storage ).toBe( storage );
		expect( typeof coordinatorOptions.createSessionContinuityId ).toBe( 'function' );
		expect( typeof coordinatorOptions.createProtectionFactBatchId ).toBe( 'function' );
		expect( backgroundMocks.createBrowserProtectionAdapter ).toHaveBeenCalledWith( fakeBrowser );
		expect( backgroundMocks.createBrowserProtectionAdapter ).toHaveBeenCalledOnce();
		expect( backgroundMocks.createSitePermissionManager ).toHaveBeenCalledWith( {
			permissions: fakeBrowser.permissions,
		} );
		expect( backgroundMocks.createStatisticsStorageService ).toHaveBeenCalledOnce();
		expect( backgroundMocks.createStatisticsSessionStorageService ).toHaveBeenCalledOnce();
		const statisticsSessionStorageOptions: unknown =
			backgroundMocks.createStatisticsSessionStorageService.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof statisticsSessionStorageOptions !== 'object' ||
			statisticsSessionStorageOptions === null ||
			! ( 'area' in statisticsSessionStorageOptions ) ||
			! ( 'createFocusEpochId' in statisticsSessionStorageOptions )
		) {
			throw new TypeError( 'Expected complete statistics session storage options.' );
		}

		expect( statisticsSessionStorageOptions.area ).toBe( fakeBrowser.storage.session );
		expect( typeof statisticsSessionStorageOptions.createFocusEpochId ).toBe( 'function' );
		const statisticsStorageOptions: unknown = backgroundMocks.createStatisticsStorageService.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof statisticsStorageOptions !== 'object' ||
			statisticsStorageOptions === null ||
			! ( 'area' in statisticsStorageOptions ) ||
			! ( 'createGenerationId' in statisticsStorageOptions )
		) {
			throw new TypeError( 'Expected complete statistics storage options.' );
		}

		expect( statisticsStorageOptions.area ).toBe( fakeBrowser.storage.local );
		expect( typeof statisticsStorageOptions.createGenerationId ).toBe( 'function' );
		expect( backgroundMocks.createStatisticsRuntime ).toHaveBeenCalledWith( expect.objectContaining( {
			coordinator,
			sessionStorage: statisticsSessionStorage,
			storage: statisticsStorage,
		} ) );
		const statisticsRuntimeOptions: unknown = backgroundMocks.createStatisticsRuntime.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof statisticsRuntimeOptions !== 'object' ||
			statisticsRuntimeOptions === null ||
			! ( 'createGenerationId' in statisticsRuntimeOptions ) ||
			typeof statisticsRuntimeOptions.createGenerationId !== 'function'
		) {
			throw new TypeError( 'Expected a complete statistics runtime configuration.' );
		}

		const typedStatisticsRuntimeOptions = statisticsRuntimeOptions as StatisticsRuntimeOptions;
		expect( typedStatisticsRuntimeOptions.createGenerationId() ).toEqual( expect.any( String ) );
		expect( statisticsRuntimeOptions ).not.toHaveProperty( 'continuityId' );
		expect( backgroundMocks.createBrowserProtectionRuntime ).toHaveBeenCalledWith( expect.objectContaining( {
			browser: browserAdapter,
			configurationStorage,
			coordinator,
			statisticsRuntime,
		} ) );
		const runtimeOptions: unknown = backgroundMocks.createBrowserProtectionRuntime.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof runtimeOptions !== 'object' ||
			runtimeOptions === null ||
			! ( 'interruptionPageUrl' in runtimeOptions ) ||
			typeof runtimeOptions.interruptionPageUrl !== 'string' ||
			! ( 'filterConfiguration' in runtimeOptions ) ||
			typeof runtimeOptions.filterConfiguration !== 'function'
		) {
			throw new TypeError( 'Expected a complete browser protection runtime configuration.' );
		}

		expect( runtimeOptions.interruptionPageUrl ).toContain( 'interruption.html' );
		expect( typeof runtimeOptions.filterConfiguration ).toBe( 'function' );
		const typedRuntimeOptions = runtimeOptions as BrowserProtectionRuntimeOptions;

		backgroundMocks.filterConfiguration.mockResolvedValue( TestEmptyProtectionConfiguration );
		await expect(
			typedRuntimeOptions.filterConfiguration( TestEmptyProtectionConfiguration ),
		).resolves.toBe( TestEmptyProtectionConfiguration );
		expect( backgroundMocks.filterConfiguration ).toHaveBeenCalledWith( TestEmptyProtectionConfiguration );
		expect( typedRuntimeOptions.createStableId() ).toEqual( expect.any( String ) );
		expect( typedRuntimeOptions.now() ).toBe( TestInstant );
		expect( typedRuntimeOptions.getTimeZone() ).toEqual( expect.any( String ) );
		expect( backgroundMocks.createProtectionBackgroundController ).toHaveBeenCalledOnce();
		const backgroundControllerOptions: unknown =
			backgroundMocks.createProtectionBackgroundController.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof backgroundControllerOptions !== 'object' ||
			backgroundControllerOptions === null ||
			! ( 'browser' in backgroundControllerOptions ) ||
			! ( 'interruptionPageUrl' in backgroundControllerOptions ) ||
			! ( 'optionsPageUrl' in backgroundControllerOptions ) ||
			! ( 'runtime' in backgroundControllerOptions )
		) {
			throw new TypeError( 'Expected complete protection background controller options.' );
		}

		const typedBackgroundControllerOptions =
			backgroundControllerOptions as ProtectionBackgroundControllerOptions;

		expect( typedBackgroundControllerOptions.browser ).toBe( fakeBrowser );
		expect( typedBackgroundControllerOptions.interruptionPageUrl ).toBe(
			runtimeOptions.interruptionPageUrl,
		);
		expect( typedBackgroundControllerOptions.optionsPageUrl ).toContain( 'options.html' );
		expect( typedBackgroundControllerOptions.runtime ).toBe( runtime );
		expect( backgroundMocks.start ).toHaveBeenCalledOnce();
	} );
} );
