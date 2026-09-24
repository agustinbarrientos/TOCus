import { Language } from '../../../domains/preferences/types';
import { describe, expect, it } from 'vitest';
import { ExtensionBuildBrowser } from '../build-browser/types';
import { getExtensionReviewUrl } from './index';

describe( 'getExtensionReviewUrl', () => {
	it.each( [
		[ ExtensionBuildBrowser.CHROME, 'https://chromewebstore.google.com/detail/test/chrome-id/reviews?hl=en' ],
		[ ExtensionBuildBrowser.EDGE, 'https://microsoftedge.microsoft.com/addons/detail/test/edge-id?hl=en-US' ],
		[ ExtensionBuildBrowser.FIREFOX, 'https://addons.mozilla.org/en-US/firefox/addon/test/reviews/' ],
		[ ExtensionBuildBrowser.SAFARI, 'https://apps.apple.com/app/id123?action=write-review' ],
	] )( 'uses the %s build store without falling back to another browser', ( browser, expected ) => {
		expect( getExtensionReviewUrl( browser, {
			chrome: 'https://chromewebstore.google.com/detail/test/chrome-id/reviews',
			edge: 'https://microsoftedge.microsoft.com/addons/detail/test/edge-id',
			firefox: 'https://addons.mozilla.org/firefox/addon/test/reviews/',
			safari: 'https://apps.apple.com/app/id123?action=write-review',
		} ) ).toBe( expected );
	} );

	it.each( [ ExtensionBuildBrowser.EDGE, 'unsupported', 'toString' ] )(
		'hides the invitation when %s has no configured listing', ( browser ) => {
			expect( getExtensionReviewUrl( browser, {
				chrome: 'https://chromewebstore.google.com/detail/test/chrome-id/reviews',
				edge: null, firefox: null, safari: null,
			} ) ).toBeNull();
		},
	);
} );

describe( 'localized review destinations', () => {
	it.each( [
		[ Language.ENGLISH, 'en', 'en-US', 'en-US' ],
		[ Language.SPANISH_TU, 'es', 'es-ES', 'es-ES' ],
		[ Language.SPANISH_VOS, 'es-419', 'es-MX', 'es-AR' ],
		[ Language.PORTUGUESE_BRAZIL, 'pt-BR', 'pt-BR', 'pt-BR' ],
		[ Language.PORTUGUESE_PORTUGAL, 'pt-PT', 'pt-PT', 'pt-PT' ],
		[ Language.ITALIAN, 'it', 'it-IT', 'it' ],
		[ Language.FRENCH, 'fr', 'fr-FR', 'fr' ],
		[ Language.GERMAN, 'de', 'de-DE', 'de' ],
		[ Language.JAPANESE, 'ja', 'ja-JP', 'ja' ],
		[ Language.RUSSIAN, 'ru', 'ru-RU', 'ru' ],
	] )( 'opens all three stores in the selected %s language', ( language, chromeLocale, edgeLocale, firefoxLocale ) => {
		const links = {
			chrome: 'https://chromewebstore.google.com/detail/test/chrome-id/reviews?hl=de&source=review#feedback',
			edge: 'https://microsoftedge.microsoft.com/addons/detail/edge-id?hl=de-DE&source=review',
			firefox: 'https://addons.mozilla.org/de/firefox/addon/tocus/reviews/?source=review', safari: null,
		};
		expect( getExtensionReviewUrl( ExtensionBuildBrowser.CHROME, links, language ) ).toBe(
			`https://chromewebstore.google.com/detail/test/chrome-id/reviews?hl=${ chromeLocale }&source=review#feedback`,
		);
		expect( getExtensionReviewUrl( ExtensionBuildBrowser.FIREFOX, links, language ) ).toBe(
			`https://addons.mozilla.org/${ firefoxLocale }/firefox/addon/tocus/reviews/?source=review`,
		);
		expect( getExtensionReviewUrl( ExtensionBuildBrowser.EDGE, links, language ) ).toBe(
			`https://microsoftedge.microsoft.com/addons/detail/edge-id?hl=${ edgeLocale }&source=review`,
		);
	} );
} );
