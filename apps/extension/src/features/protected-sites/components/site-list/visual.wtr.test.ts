import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import './index';
import { type ComponentProtectedSiteList } from './index';

/**
 * Shared and independent protected sites rendered by focused visual fixtures.
 * @since 0.1.0 Initial implementation.
 */
const VISUAL_SITES: ReadonlyArray<ProtectedSiteConfiguration> = [
	{
		identityHost: 'youtube.com',
		rule: {
			host: 'youtube.com',
			includeSubdomains: true,
			scopeId: DefaultProtectionScopeId,
		},
	},
	{
		identityHost: 'x.com',
		rule: {
			host: 'x.com',
			includeSubdomains: true,
			scopeId: ProtectionScopeIdSchema.parse( 'scope_x' ),
		},
	},
];

/**
 * Granted browser-access state rendered by focused visual fixtures.
 * @since 0.1.0 Initial implementation.
 */
const VISUAL_ACCESS_BY_IDENTITY_HOST: ReadonlyMap<string, boolean> = new Map( [
	[ 'youtube.com', true ],
	[ 'x.com', true ],
] );

/**
 * Configures one deterministic explicit appearance for a visual case.
 * @param theme - Explicit light or dark appearance.
 * @return Promise resolved after browser media emulation is applied.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance( theme: 'light' | 'dark' ): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	await emulateMedia( {
		colorScheme: theme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-protected-site-list visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load(
			'600 1rem "Fredoka Variable"',
			'Shared protection Independent sites YouTube X',
		);

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
	} );

	for ( const theme of [ 'light', 'dark' ] as const ) {
		it( `matches grouped protected sites in the ${ theme } appearance`, async () => {
			await configureAppearance( theme );
			const element = await fixture<ComponentProtectedSiteList>( html`
				<tocus-f-protected-site-list
			.copy=${ TestEnglishLocalizationBundle.protectedSiteList }
			.itemCopy=${ TestEnglishLocalizationBundle.protectedSiteItem }
					style="width: 46rem;"
					.sites=${ VISUAL_SITES }
					.accessByIdentityHost=${ VISUAL_ACCESS_BY_IDENTITY_HOST }
				></tocus-f-protected-site-list>
			` );

			assert.isTrue( element.isConnected );
			await visualDiff( element, `protected-site-list-${ theme }` );
		} );
	}
} );
