import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type OnboardingPageOptions } from '../../features/onboarding/services/onboarding-page/types';

/**
 * Hoisted dependencies used by onboarding entrypoint composition tests.
 * @since 0.1.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal onboarding shell recognized by the composition root.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestOnboardingShell extends EventTarget {}

	return {
		ComponentOnboardingShell: TestOnboardingShell,
		closeWindow: vi.fn(),
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		loadLocalizationBundle: vi.fn(),
		matchMedia: vi.fn().mockReturnValue( {} ),
		openOptionsPage: vi.fn().mockResolvedValue( undefined ),
		permissions: {},
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		runtime: { openOptionsPage: vi.fn() },
		bootstrapOnboardingPage: vi.fn<( options: OnboardingPageOptions ) => Promise<void>>(),
		storageArea: {},
		storageChanges: {},
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( 'wxt/browser', () => ( {
	browser: {
		i18n: { getUILanguage: entrypointMocks.getUILanguage },
		permissions: entrypointMocks.permissions,
		runtime: entrypointMocks.runtime,
		storage: {
			local: entrypointMocks.storageArea,
			onChanged: entrypointMocks.storageChanges,
		},
	},
} ) );
vi.mock( '../../domains/preferences/utils', () => ( {
	resolveLanguage: entrypointMocks.resolveLanguage,
} ) );
vi.mock( '../../features/onboarding/components/shell', () => ( {
	ComponentOnboardingShell: entrypointMocks.ComponentOnboardingShell,
} ) );
vi.mock( '../../features/onboarding/services/onboarding-page', () => ( {
	bootstrapOnboardingPage: entrypointMocks.bootstrapOnboardingPage,
} ) );
vi.mock( '../../localization', () => ( {
	loadLocalizationBundle: entrypointMocks.loadLocalizationBundle,
} ) );

describe( 'onboarding entrypoint', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		entrypointMocks.runtime.openOptionsPage = entrypointMocks.openOptionsPage;
		entrypointMocks.bootstrapOnboardingPage.mockResolvedValue( undefined );
		vi.stubGlobal( 'crypto', { randomUUID: vi.fn().mockReturnValue( 'fixture-id' ) } );
		vi.stubGlobal( 'navigator', { locks: {} } );
		vi.stubGlobal( 'window', {
			close: entrypointMocks.closeWindow,
			matchMedia: entrypointMocks.matchMedia,
		} );
	} );

	afterEach( () => {
		vi.unstubAllGlobals();
	} );

	it( 'starts onboarding with browser and document dependencies', async () => {
		const shell = new entrypointMocks.ComponentOnboardingShell();
		const removeProperty = vi.fn();
		const documentTarget = {
			documentElement: {
				setAttribute: vi.fn(),
				style: { removeProperty },
			},
			querySelector: vi.fn().mockReturnValue( shell ),
			title: 'TOCus',
		};

		vi.stubGlobal( 'document', documentTarget );
		await import( './index' );

		expect( entrypointMocks.bootstrapOnboardingPage ).toHaveBeenCalledOnce();
		const options = entrypointMocks.bootstrapOnboardingPage.mock.calls[ 0 ]?.[ 0 ];

		if ( options === undefined ) {
			throw new TypeError( 'Expected onboarding page options.' );
		}

		expect( options.shell ).toBe( shell );
		expect( options.browserLanguage ).toBe( 'es-vos' );
		expect( options.loadLocalization ).toBe( entrypointMocks.loadLocalizationBundle );
		expect( options.cryptography ).toBe( crypto );
		expect( options.document ).toBe( documentTarget );
		expect( options.pageWindow ).toBe( window );
		await options.openSettings();
		expect( entrypointMocks.openOptionsPage ).toHaveBeenCalledOnce();
		expect( removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'fails clearly when the onboarding shell is missing', async () => {
		vi.stubGlobal( 'document', { querySelector: vi.fn().mockReturnValue( null ) } );

		await expect( import( './index' ) ).rejects.toThrow(
			'Expected the onboarding page to contain the onboarding shell.',
		);
		expect( entrypointMocks.bootstrapOnboardingPage ).not.toHaveBeenCalled();
	} );
} );
