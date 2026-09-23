import { Language } from '../../domains/preferences/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OnboardingPageOptions } from '../../features/onboarding/services/onboarding-page/types';
import { LocalDataGenerationStorageKey } from '../../domains/local-data/services/local-data-generation';

/**
 * Hoisted dependencies used by onboarding entrypoint composition tests.
 * @since 1.0.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal onboarding shell recognized by the composition root.
	 * @since 1.0.0 Initial implementation.
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
		storageArea: { get: vi.fn() },
		storageChanges: {},
	};
} );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( '@tocus/ui/styles.scss', () => ( {} ) );
vi.mock( '@tocus/ui/notifications.scss', () => ( {} ) );
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
vi.mock( '../../features/onboarding/services/onboarding-presentation', () => ( {
	mountOnboarding: vi.fn( ( container: unknown ) => container ),
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
		entrypointMocks.storageArea.get.mockResolvedValue( {} );
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
			getElementById: vi.fn().mockReturnValue( shell ),
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
		expect( options.browserLanguage ).toBe( Language.SPANISH_VOS );
		expect( options.loadLocalization ).toBe( entrypointMocks.loadLocalizationBundle );
		expect( options.cryptography ).toBe( crypto );
		expect( options.document ).toBe( documentTarget );
		expect( options.pageWindow ).toBe( window );
		await options.openSettings();
		expect( entrypointMocks.openOptionsPage ).toHaveBeenCalledOnce();
		expect( removeProperty ).not.toHaveBeenCalled();
	} );

	it.each( [
		{ marker: { generation: 'complete', pending: false, needsOnboarding: false }, expected: true },
		{ marker: { generation: 'complete', pending: true, needsOnboarding: true }, expected: false },
		{ marker: { generation: 'older', pending: false, needsOnboarding: false }, expected: false },
		{ marker: undefined, expected: false },
		{ marker: { generation: 'complete', pending: 'invalid' }, expected: false },
	] )( 'announces only a matching completed generation: $marker', async ( { marker, expected } ) => {
		const location = { href: 'chrome-extension://test/onboarding.html?reset=complete&keep=yes#step' };
		const history = { state: { existing: true }, replaceState: vi.fn( ( _state, _unused, url: string ) => {
			location.href = url;
		} ) };
		vi.stubGlobal( 'window', { location, history } );
		vi.stubGlobal( 'document', { getElementById: vi.fn().mockReturnValue( new entrypointMocks.ComponentOnboardingShell() ) } );
		entrypointMocks.storageArea.get.mockResolvedValue( { [ LocalDataGenerationStorageKey ]: marker } );
		await import( './index' );
		const options = entrypointMocks.bootstrapOnboardingPage.mock.calls[ 0 ]?.[ 0 ];
		expect( await options?.readResetCompletion?.() ).toBe( expected );
		expect( location.href ).toBe( 'chrome-extension://test/onboarding.html?keep=yes#step' );
		expect( await options?.readResetCompletion?.() ).toBe( false );
	} );

	it( 'does not announce a reset for ordinary first-install onboarding', async () => {
		const history = { state: null, replaceState: vi.fn() };
		vi.stubGlobal( 'window', { location: { href: 'chrome-extension://test/onboarding.html' }, history } );
		vi.stubGlobal( 'document', { getElementById: vi.fn().mockReturnValue( new entrypointMocks.ComponentOnboardingShell() ) } );
		await import( './index' );
		const options = entrypointMocks.bootstrapOnboardingPage.mock.calls[ 0 ]?.[ 0 ];
		expect( await options?.readResetCompletion?.() ).toBe( false );
		expect( history.replaceState ).not.toHaveBeenCalled();
		expect( entrypointMocks.storageArea.get ).not.toHaveBeenCalled();
	} );

	it.each( [ '?reset=', '?reset=complete&reset=other' ] )( 'consumes invalid reset handoffs without reading data: %s',
		async ( query ) => {
			const location = { href: `chrome-extension://test/onboarding.html${ query }` };
			const history = { state: null, replaceState: vi.fn( ( _state, _unused, url: string ) => {
				location.href = url;
			} ) };
			vi.stubGlobal( 'window', { location, history } );
			vi.stubGlobal( 'document', { getElementById: vi.fn().mockReturnValue( new entrypointMocks.ComponentOnboardingShell() ) } );
			await import( './index' );
			const options = entrypointMocks.bootstrapOnboardingPage.mock.calls[ 0 ]?.[ 0 ];
			expect( await options?.readResetCompletion?.() ).toBe( false );
			expect( location.href ).toBe( 'chrome-extension://test/onboarding.html' );
			expect( entrypointMocks.storageArea.get ).not.toHaveBeenCalled();
		} );

	it( 'fails clearly when the onboarding shell is missing', async () => {
		vi.stubGlobal( 'document', { getElementById: vi.fn().mockReturnValue( null ) } );

		await expect( import( './index' ) ).rejects.toThrow(
			'Expected the onboarding page to contain the onboarding shell.',
		);
		expect( entrypointMocks.bootstrapOnboardingPage ).not.toHaveBeenCalled();
	} );
} );
