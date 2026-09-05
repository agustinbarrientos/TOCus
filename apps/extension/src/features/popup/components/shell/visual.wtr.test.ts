import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import './index';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';

describe( 'tocus-f-popup-shell visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	it( 'matches the light appearance', async () => {
		await emulateMedia( { colorScheme: 'light' } );
		const frame = await fixture<HTMLElement>(
			html`<div class="tocus-test-frame">
				<tocus-f-popup-shell .copy=${ TestEnglishLocalizationBundle.popup }></tocus-f-popup-shell>
			</div>`,
		);

		assert.isTrue( frame.isConnected );
		await visualDiff( frame, 'popup-shell-light' );
	} );

	it( 'matches the dark appearance', async () => {
		await emulateMedia( { colorScheme: 'dark' } );
		const frame = await fixture<HTMLElement>(
			html`<div class="tocus-test-frame">
				<tocus-f-popup-shell .copy=${ TestEnglishLocalizationBundle.popup }></tocus-f-popup-shell>
			</div>`,
		);

		assert.isTrue( frame.isConnected );
		await visualDiff( frame, 'popup-shell-dark' );
	} );
} );
