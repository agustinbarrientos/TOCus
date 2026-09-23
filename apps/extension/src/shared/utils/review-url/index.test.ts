import { describe, expect, it } from 'vitest';
import { ExtensionBuildBrowser } from '../build-browser/types';
import { getExtensionReviewUrl } from './index';

describe( 'getExtensionReviewUrl', () => {
	it.each( [
		[ ExtensionBuildBrowser.CHROME, 'https://chromewebstore.google.com/detail/test/chrome-id/reviews' ],
		[ ExtensionBuildBrowser.EDGE, 'https://microsoftedge.microsoft.com/addons/detail/test/edge-id' ],
		[ ExtensionBuildBrowser.FIREFOX, 'https://addons.mozilla.org/firefox/addon/test/reviews/' ],
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
