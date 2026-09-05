import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPlatform } from '../../features/settings/components/shell/types';
import { type SettingsPageOptions } from '../../features/settings/services/settings-page/types';

/**
 * Hoisted dependencies used by settings entrypoint composition tests.
 * @since 0.1.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	/**
	 * Minimal settings shell recognized by the composition root.
	 * @since 0.1.0 Initial implementation.
	 */
	class TestSettingsShell {
		/** Stable fixture marker preventing an empty test class. */
		readonly fixture = true;
	}

	return {
		ComponentSettingsShell: TestSettingsShell,
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		loadLocalizationBundle: vi.fn(),
		matchMedia: vi.fn().mockReturnValue( {} ),
		permissions: {},
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		runtime: { getURL: vi.fn().mockReturnValue( 'chrome-extension://extension-id/' ) },
		bootstrapSettingsPage: vi.fn<( options: SettingsPageOptions ) => Promise<void>>(),
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
vi.mock( '../../features/settings/components/shell', () => ( {
	ComponentSettingsShell: entrypointMocks.ComponentSettingsShell,
} ) );
vi.mock( '../../features/settings/services/settings-page', () => ( {
	bootstrapSettingsPage: entrypointMocks.bootstrapSettingsPage,
} ) );
vi.mock( '../../localization', () => ( {
	loadLocalizationBundle: entrypointMocks.loadLocalizationBundle,
} ) );

/**
 * Imports the settings entrypoint for one browser environment.
 * @param environment - Browser build flags exposed by WXT.
 * @return Promise resolved after entrypoint evaluation.
 * @since 0.1.0 Initial implementation.
 */
async function importSettingsEntrypoint(
	environment: Readonly<{ CHROME?: string; FIREFOX?: string; SAFARI?: string }> = {},
): Promise<void> {
	for ( const [ name, value ] of Object.entries( environment ) ) {
		vi.stubEnv( name, value );
	}

	await import( './index' );
}

describe( 'settings entrypoint', () => {
	beforeEach( () => {
		vi.resetModules();
		vi.clearAllMocks();
		entrypointMocks.bootstrapSettingsPage.mockResolvedValue( undefined );
		vi.stubGlobal( 'crypto', { randomUUID: vi.fn().mockReturnValue( 'fixture-id' ) } );
		vi.stubGlobal( 'navigator', { locks: {} } );
		vi.stubGlobal( 'window', { matchMedia: entrypointMocks.matchMedia } );
	} );

	afterEach( () => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	} );

	it( 'starts Chrome settings with browser and document dependencies', async () => {
		const shell = new entrypointMocks.ComponentSettingsShell();
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
		await importSettingsEntrypoint( { CHROME: 'true', FIREFOX: '', SAFARI: '' } );

		expect( entrypointMocks.bootstrapSettingsPage ).toHaveBeenCalledOnce();
		const options = entrypointMocks.bootstrapSettingsPage.mock.calls[ 0 ]?.[ 0 ];

		if ( options === undefined ) {
			throw new TypeError( 'Expected settings page options.' );
		}

		expect( options.shell ).toBe( shell );
		expect( options.browserLanguage ).toBe( 'es-vos' );
		expect( options.platform ).toBe( SettingsPlatform.CHROME );
		expect( options.supportsCachedFavicons ).toBeTruthy();
		expect( options.extensionRootUrl ).toBe( 'chrome-extension://extension-id/' );
		expect( options.cryptography ).toBe( crypto );
		expect( options.document ).toBe( documentTarget );
		expect( options.pageWindow ).toBe( window );
		expect( removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'selects the Firefox settings platform', async () => {
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: vi.fn() } },
			querySelector: vi.fn().mockReturnValue( new entrypointMocks.ComponentSettingsShell() ),
		} );

		await importSettingsEntrypoint( { CHROME: '', FIREFOX: 'true', SAFARI: '' } );

		expect( entrypointMocks.bootstrapSettingsPage.mock.calls[ 0 ]?.[ 0 ].platform )
			.toBe( SettingsPlatform.FIREFOX );
	} );

	it( 'selects the Safari settings platform', async () => {
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: vi.fn() } },
			querySelector: vi.fn().mockReturnValue( new entrypointMocks.ComponentSettingsShell() ),
		} );

		await importSettingsEntrypoint( { CHROME: '', FIREFOX: '', SAFARI: 'true' } );

		expect( entrypointMocks.bootstrapSettingsPage.mock.calls[ 0 ]?.[ 0 ].platform )
			.toBe( SettingsPlatform.SAFARI );
	} );

	it( 'fails clearly when the settings shell is missing', async () => {
		vi.stubGlobal( 'document', { querySelector: vi.fn().mockReturnValue( null ) } );

		await expect( importSettingsEntrypoint() ).rejects.toThrow(
			'Expected the options page to contain the settings shell.',
		);
		expect( entrypointMocks.bootstrapSettingsPage ).not.toHaveBeenCalled();
	} );
} );
