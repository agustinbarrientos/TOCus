import { Language } from '../../domains/preferences/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPlatform } from '../../features/settings/components/shell/types';
import type { SettingsPageOptions } from '../../features/settings/services/settings-page/types';

/**
 * Hoisted dependencies used by settings entrypoint composition tests.
 * @since 0.1.0 Initial implementation.
 */
const entrypointMocks = vi.hoisted( () => {
	const shell = { fixture: true };

	return {
		container: { id: 'settings-root' },
		shell,
		mountSettings: vi.fn().mockReturnValue( shell ),
		getUILanguage: vi.fn().mockReturnValue( 'es-AR' ),
		loadLocalizationBundle: vi.fn(),
		matchMedia: vi.fn().mockReturnValue( {} ),
		permissions: {},
		resolveLanguage: vi.fn().mockReturnValue( 'es-vos' ),
		runtime: {
			getURL: vi.fn().mockReturnValue( 'chrome-extension://extension-id/' ),
			getManifest: vi.fn().mockReturnValue( { version: '2.3.4' } ),
		},
		bootstrapSettingsPage: vi.fn<( options: SettingsPageOptions ) => Promise<void>>(),
		storageArea: {},
		storageChanges: {},
	};
} );

vi.mock( '@tocus/ui/styles.scss', () => ( {} ) );
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
vi.mock( '../../features/settings/services/settings-presentation', () => ( {
	mountSettings: entrypointMocks.mountSettings,
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
		const removeProperty = vi.fn();
		const documentTarget = {
			documentElement: {
				setAttribute: vi.fn(),
				style: { removeProperty },
			},
			getElementById: vi.fn().mockReturnValue( entrypointMocks.container ),
			title: 'TOCus',
		};

		vi.stubGlobal( 'document', documentTarget );
		await importSettingsEntrypoint( { CHROME: 'true', FIREFOX: '', SAFARI: '' } );

		expect( entrypointMocks.bootstrapSettingsPage ).toHaveBeenCalledOnce();
		const options = entrypointMocks.bootstrapSettingsPage.mock.calls[ 0 ]?.[ 0 ];

		if ( options === undefined ) {
			throw new TypeError( 'Expected settings page options.' );
		}

		expect( documentTarget.getElementById ).toHaveBeenCalledWith( 'settings-root' );
		expect( entrypointMocks.mountSettings ).toHaveBeenCalledWith( entrypointMocks.container );
		expect( options.shell ).toBe( entrypointMocks.shell );
		expect( options.browserLanguage ).toBe( Language.SPANISH_VOS );
		expect( options.platform ).toBe( SettingsPlatform.CHROME );
		expect( options.supportsCachedFavicons ).toBeTruthy();
		expect( options.extensionRootUrl ).toBe( 'chrome-extension://extension-id/' );
		expect( options.version ).toBe( '2.3.4' );
		expect( options.cryptography ).toBe( crypto );
		expect( options.document ).toBe( documentTarget );
		expect( options.pageWindow ).toBe( window );
		expect( removeProperty ).not.toHaveBeenCalled();
	} );

	it( 'selects the Firefox settings platform', async () => {
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: vi.fn() } },
			getElementById: vi.fn().mockReturnValue( entrypointMocks.container ),
		} );

		await importSettingsEntrypoint( { CHROME: '', FIREFOX: 'true', SAFARI: '' } );

		expect( entrypointMocks.bootstrapSettingsPage.mock.calls[ 0 ]?.[ 0 ].platform )
			.toBe( SettingsPlatform.FIREFOX );
	} );

	it( 'selects the Safari settings platform', async () => {
		vi.stubGlobal( 'document', {
			documentElement: { style: { removeProperty: vi.fn() } },
			getElementById: vi.fn().mockReturnValue( entrypointMocks.container ),
		} );

		await importSettingsEntrypoint( { CHROME: '', FIREFOX: '', SAFARI: 'true' } );

		expect( entrypointMocks.bootstrapSettingsPage.mock.calls[ 0 ]?.[ 0 ].platform )
			.toBe( SettingsPlatform.SAFARI );
	} );

	it( 'fails clearly when the settings shell is missing', async () => {
		vi.stubGlobal( 'document', { getElementById: vi.fn().mockReturnValue( null ) } );

		await expect( importSettingsEntrypoint() ).rejects.toThrow(
			'Expected the options page to contain the settings shell.',
		);
		expect( entrypointMocks.bootstrapSettingsPage ).not.toHaveBeenCalled();
		expect( entrypointMocks.mountSettings ).not.toHaveBeenCalled();
	} );
} );
