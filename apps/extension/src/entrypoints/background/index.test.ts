import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { TestEmptyProtectionConfiguration } from '../../domains/protection/types/__fixtures__';
import { TestInstant } from '../../domains/protection/types/__fixtures__/protection-event';
import { type BrowserProtectionRuntimeOptions } from '../../features/protection-runtime/services/browser-protection-runtime';

const backgroundMocks = vi.hoisted( () => ( {
	createBrowserProtectionAdapter: vi.fn(),
	createBrowserProtectionRuntime: vi.fn(),
	createProtectionBackgroundController: vi.fn(),
	createProtectionConfigurationStorageService: vi.fn(),
	createProtectionCoordinator: vi.fn(),
	createProtectionStorageService: vi.fn(),
	createSitePermissionManager: vi.fn(),
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

vi.mock( '../../features/protection-runtime/services/browser-protection-adapter', () => ( {
	createBrowserProtectionAdapter: backgroundMocks.createBrowserProtectionAdapter,
} ) );

vi.mock( '../../features/protection-runtime/services/browser-protection-runtime', () => ( {
	createBrowserProtectionRuntime: backgroundMocks.createBrowserProtectionRuntime,
} ) );

vi.mock( '../../features/protection-runtime/services/protection-background-controller', () => ( {
	createProtectionBackgroundController: backgroundMocks.createProtectionBackgroundController,
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
			dispatch: vi.fn(),
			getStates: vi.fn(),
			initialize: vi.fn(),
		};
		const browserAdapter = { adapter: true };
		const permissionManager = { filterConfiguration: backgroundMocks.filterConfiguration };
		const runtime = { runtime: true };
		const controller = { start: backgroundMocks.start };

		backgroundMocks.createProtectionStorageService.mockReturnValue( storage );
		backgroundMocks.createProtectionConfigurationStorageService.mockReturnValue( configurationStorage );
		backgroundMocks.createProtectionCoordinator.mockReturnValue( coordinator );
		backgroundMocks.createBrowserProtectionAdapter.mockReturnValue( browserAdapter );
		backgroundMocks.createSitePermissionManager.mockReturnValue( permissionManager );
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
			! ( 'createSessionContinuityId' in coordinatorOptions )
		) {
			throw new TypeError( 'Expected complete protection coordinator options.' );
		}

		expect( coordinatorOptions.storage ).toBe( storage );
		expect( typeof coordinatorOptions.createSessionContinuityId ).toBe( 'function' );
		expect( backgroundMocks.createBrowserProtectionAdapter ).toHaveBeenCalledWith( fakeBrowser );
		expect( backgroundMocks.createSitePermissionManager ).toHaveBeenCalledWith( {
			permissions: fakeBrowser.permissions,
		} );
		expect( backgroundMocks.createBrowserProtectionRuntime ).toHaveBeenCalledWith( expect.objectContaining( {
			browser: browserAdapter,
			configurationStorage,
			coordinator,
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
		expect( backgroundMocks.createProtectionBackgroundController ).toHaveBeenCalledWith( {
			browser: fakeBrowser,
			interruptionPageUrl: runtimeOptions.interruptionPageUrl,
			runtime,
		} );
		expect( backgroundMocks.start ).toHaveBeenCalledOnce();
	} );
} );
