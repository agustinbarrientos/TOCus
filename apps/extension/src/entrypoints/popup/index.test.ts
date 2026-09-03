import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const entrypointMocks = vi.hoisted( () => {
	const preferencesController = {
		apply: vi.fn(),
		start: vi.fn().mockResolvedValue( undefined ),
		stop: vi.fn(),
	};
	const preferencesStorage = {};
	const removeDocumentVisibility = vi.fn();
	const storageArea = {};
	const storageChanges = {};

	return {
		createPreferencesController: vi.fn().mockReturnValue( preferencesController ),
		createPreferencesStorage: vi.fn().mockReturnValue( preferencesStorage ),
		preferencesController,
		preferencesStorage,
		removeDocumentVisibility,
		storageArea,
		storageChanges,
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( '../../features/popup/components/shell', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		storage: {
			local: entrypointMocks.storageArea,
			onChanged: entrypointMocks.storageChanges,
		},
	},
} ) );
vi.mock( '../../domains/preferences/services', () => ( {
	createPreferencesStorageService: entrypointMocks.createPreferencesStorage,
} ) );
vi.mock( '../../features/preferences/services/preferences-controller', () => ( {
	createPreferencesController: entrypointMocks.createPreferencesController,
} ) );

/**
 * Provides an inert callback before a pending preference start captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignorePreferencesStartResolution(): undefined {
	return undefined;
}

describe( 'popup entrypoint', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		entrypointMocks.preferencesController.start.mockResolvedValue( undefined );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
	} );

	it( 'projects local appearance preferences into the popup document', async () => {
		const appearanceTarget = {
			style: { removeProperty: entrypointMocks.removeDocumentVisibility },
		};
		const motionPreference = {};
		const windowTarget = {
			matchMedia: vi.fn().mockReturnValue( motionPreference ),
		};
		let completePreferencesStart: ( value?: void | PromiseLike<void> ) => void =
			ignorePreferencesStartResolution;

		entrypointMocks.preferencesController.start.mockReturnValueOnce( new Promise<void>( ( resolve ) => {
			completePreferencesStart = resolve;
		} ) );
		vi.stubGlobal( 'document', {
			documentElement: appearanceTarget,
		} );
		vi.stubGlobal( 'window', windowTarget );
		await import( './index' );

		expect( entrypointMocks.createPreferencesStorage ).toHaveBeenCalledWith( {
			area: entrypointMocks.storageArea,
		} );
		expect( entrypointMocks.createPreferencesController ).toHaveBeenCalledWith( {
			appearanceTarget,
			storage: entrypointMocks.preferencesStorage,
			storageChanges: entrypointMocks.storageChanges,
			systemMotionPreference: motionPreference,
		} );
		expect( entrypointMocks.preferencesController.start ).toHaveBeenCalledOnce();
		expect( entrypointMocks.removeDocumentVisibility ).not.toHaveBeenCalled();
		completePreferencesStart();
		await vi.waitFor( () => {
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				1,
				'color-scheme',
			);
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				2,
				'background',
			);
			expect( entrypointMocks.removeDocumentVisibility ).toHaveBeenNthCalledWith(
				3,
				'visibility',
			);
		} );
	} );
} );
