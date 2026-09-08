import { describe, expect, it } from 'vitest';
import { isInterruptionDocumentUrl } from './index';

describe( 'isInterruptionDocumentUrl', () => {
	it.each( [ 'chrome-extension:', 'moz-extension:', 'safari-web-extension:' ] )( 'recognizes exact current and legacy documents for %s without trusting other contexts', ( protocol ) => {
		const base = `${ protocol }//extension-id`;
		const currentUrl = `${ base }/pause.html`;

		expect( isInterruptionDocumentUrl( currentUrl, currentUrl ) ).toBe( true );
		expect( isInterruptionDocumentUrl( `${ base }/interruption.html`, currentUrl ) ).toBe( true );
		for ( const candidate of [
			undefined,
			'',
			`${ protocol }//another-extension/interruption.html`,
			`${ protocol }//another-extension/pause.html`,
			`${ base }/options.html`,
			`${ base }/folder/interruption.html`,
			`${ base }/interruption.html?website=example.test`,
			`${ base }/interruption.html#fragment`,
			`${ base }/pause.html?website=example.test`,
			`${ base }/pause.html#fragment`,
			'https://example.test/interruption.html',
		] ) {
			expect( isInterruptionDocumentUrl( candidate, currentUrl ), candidate ).toBe( false );
		}
	} );

	it( 'does not invent a legacy sibling for a different configured document', () => {
		const currentUrl = 'chrome-extension://extension-id/custom.html';

		expect( isInterruptionDocumentUrl( currentUrl, currentUrl ) ).toBe( true );
		expect( isInterruptionDocumentUrl( 'chrome-extension://extension-id/interruption.html', currentUrl ) ).toBe( false );
	} );

	it( 'rejects an unavailable candidate or malformed configured base without throwing', () => {
		expect( isInterruptionDocumentUrl( undefined, 'not a URL/pause.html' ) ).toBe( false );
	} );
} );
