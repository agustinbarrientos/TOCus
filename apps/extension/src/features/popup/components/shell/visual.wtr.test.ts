import { expect, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import './index';

describe( 'tocus-f-popup-shell visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

		expect( loadedFonts.length ).to.be.greaterThan( 0 );
	} );

	it( 'matches the light appearance', async () => {
		await emulateMedia( { colorScheme: 'light' } );
		const frame = await fixture<HTMLElement>(
			html`<div class="tocus-test-frame">
				<tocus-f-popup-shell></tocus-f-popup-shell>
			</div>`,
		);

		expect( frame.isConnected ).to.equal( true );
		await visualDiff( frame, 'popup-shell-light' );
	} );

	it( 'matches the dark appearance', async () => {
		await emulateMedia( { colorScheme: 'dark' } );
		const frame = await fixture<HTMLElement>(
			html`<div class="tocus-test-frame">
				<tocus-f-popup-shell></tocus-f-popup-shell>
			</div>`,
		);

		expect( frame.isConnected ).to.equal( true );
		await visualDiff( frame, 'popup-shell-dark' );
	} );
} );
