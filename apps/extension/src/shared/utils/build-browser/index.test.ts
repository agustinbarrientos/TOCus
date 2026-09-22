import { describe, expect, it } from 'vitest';
import { isChromiumBuild } from './index';
import { ExtensionBuildBrowser } from './types';

describe( 'isChromiumBuild', () => {
	it.each( [
		[ ExtensionBuildBrowser.CHROME, true ],
		[ ExtensionBuildBrowser.EDGE, true ],
		[ ExtensionBuildBrowser.FIREFOX, false ],
		[ ExtensionBuildBrowser.SAFARI, false ],
		[ 'unknown-browser', false ],
	] )( 'classifies %s as Chromium: %s', ( browser, expected ) => {
		expect( isChromiumBuild( browser ) ).toBe( expected );
	} );
} );
