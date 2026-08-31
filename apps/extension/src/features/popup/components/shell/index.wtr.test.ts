import { expect, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { ComponentPopupShell } from './index';

const APPEARANCE_PALETTES = [ 'brown', 'green', 'blue', 'purple', 'pink', 'orange' ] as const;
const APPEARANCE_THEMES = [ 'light', 'dark' ] as const;
const FULL_SCENE_COLOR_TOKENS = [
	'--tocus-color-stage-start',
	'--tocus-color-stage-middle',
	'--tocus-color-stage-end',
	'--tocus-color-stage-glow',
	'--tocus-color-breathing-sphere',
	'--tocus-color-breathing-sphere-highlight',
	'--tocus-color-breathing-sphere-shadow',
	'--tocus-color-breathing-sphere-contour',
	'--tocus-color-shadow-depth',
	'--tocus-color-on-stage',
	'--tocus-color-on-stage-muted',
	'--tocus-color-surface',
	'--tocus-color-on-surface-muted',
	'--tocus-color-surface-container',
	'--tocus-color-glass-surface',
	'--tocus-color-glass-border',
	'--tocus-color-primary',
	'--tocus-color-on-primary',
	'--tocus-color-focus-ring',
	'--tocus-color-icon-accent',
	'--tocus-color-action',
	'--tocus-color-on-action',
	'--tocus-color-surface-lowest',
	'--tocus-color-on-surface',
	'--tocus-color-outline',
] as const;

describe( 'tocus-f-popup-shell', () => {
	it( 'registers the exported component class', () => {
		expect( customElements.get( 'tocus-f-popup-shell' ) ).to.equal( ComponentPopupShell );
	} );

	it( 'renders the product status with accessible label relationships', async () => {
		const element = await fixture<ComponentPopupShell>( html`<tocus-f-popup-shell></tocus-f-popup-shell>` );
		const shadowRoot = element.shadowRoot;

		expect( shadowRoot ).not.to.equal( null );
		if ( shadowRoot === null ) {
			throw new Error( 'Expected the popup shell to render a shadow root.' );
		}

		const main = shadowRoot.querySelector( 'main' );
		const heading = shadowRoot.querySelector( 'h1' );
		const status = shadowRoot.querySelector( '.status' );
		const summary = shadowRoot.querySelector( '#popup-summary' );
		const foundationNote = shadowRoot.querySelector( '#foundation-note' );

		expect( main?.getAttribute( 'aria-labelledby' ) ).to.equal( 'popup-title' );
		expect( main?.getAttribute( 'aria-describedby' ) ).to.equal( 'popup-summary foundation-note' );
		expect( heading?.textContent ).to.equal( 'TOCus' );
		expect( status?.textContent.trim() ).to.equal( 'Early development' );
		expect( summary?.textContent.trim() ).to.equal(
			'A gentle pause before distracting websites, designed to help you return to your intentions.',
		);
		expect( foundationNote?.textContent.trim() ).to.equal(
			'This source build includes only the extension foundation. Protection and pause features are still being developed.',
		);
	} );

	it( 'has no automatically detectable accessibility violations in the light theme', async () => {
		await emulateMedia( { colorScheme: 'light' } );
		const lightFrame = await fixture<HTMLElement>(
			html`<div class="tocus-test-frame">
				<tocus-f-popup-shell></tocus-f-popup-shell>
			</div>`,
		);

		await expect( lightFrame ).to.be.accessible();
	} );

	it( 'has no automatically detectable accessibility violations in the dark theme', async () => {
		await emulateMedia( { colorScheme: 'dark' } );
		const darkFrame = await fixture<HTMLElement>(
			html`<div class="tocus-test-frame">
				<tocus-f-popup-shell></tocus-f-popup-shell>
			</div>`,
		);

		await expect( darkFrame ).to.be.accessible();
	} );

	it( 'follows the operating-system appearance when the theme is system', async () => {
		const root = document.documentElement;
		const originalPalette = root.getAttribute( 'data-tocus-palette' );
		const originalTheme = root.getAttribute( 'data-tocus-theme' );
		const colorProbe = document.createElement( 'span' );
		colorProbe.hidden = true;
		colorProbe.style.color = 'var(--tocus-color-stage-start)';
		document.body.append( colorProbe );

		try {
			root.setAttribute( 'data-tocus-palette', 'brown' );
			await emulateMedia( { colorScheme: 'light' } );
			root.setAttribute( 'data-tocus-theme', 'system' );
			const systemLightColor = getComputedStyle( colorProbe ).color;
			root.setAttribute( 'data-tocus-theme', 'light' );
			const explicitLightColor = getComputedStyle( colorProbe ).color;

			await emulateMedia( { colorScheme: 'dark' } );
			root.setAttribute( 'data-tocus-theme', 'system' );
			const systemDarkColor = getComputedStyle( colorProbe ).color;
			root.setAttribute( 'data-tocus-theme', 'dark' );
			const explicitDarkColor = getComputedStyle( colorProbe ).color;

			expect( systemLightColor ).to.equal( explicitLightColor );
			expect( systemDarkColor ).to.equal( explicitDarkColor );
			expect( systemLightColor ).not.to.equal( systemDarkColor );
		} finally {
			if ( originalPalette === null ) {
				root.removeAttribute( 'data-tocus-palette' );
			} else {
				root.setAttribute( 'data-tocus-palette', originalPalette );
			}
			if ( originalTheme === null ) {
				root.removeAttribute( 'data-tocus-theme' );
			} else {
				root.setAttribute( 'data-tocus-theme', originalTheme );
			}
			colorProbe.remove();
			await emulateMedia( { colorScheme: 'light' } );
		}
	} );

	it( 'provides a complete and distinct scene for every palette and theme', () => {
		const root = document.documentElement;
		const originalPalette = root.getAttribute( 'data-tocus-palette' );
		const originalTheme = root.getAttribute( 'data-tocus-theme' );
		const appearances = new Set<string>();
		const firstProbeContainer = document.createElement( 'div' );
		const secondProbeContainer = document.createElement( 'div' );
		const firstColorProbe = document.createElement( 'span' );
		const secondColorProbe = document.createElement( 'span' );
		firstProbeContainer.style.color = 'rgb(1, 2, 3)';
		secondProbeContainer.style.color = 'rgb(4, 5, 6)';
		firstProbeContainer.append( firstColorProbe );
		secondProbeContainer.append( secondColorProbe );
		document.body.append( firstProbeContainer, secondProbeContainer );

		try {
			for ( const palette of APPEARANCE_PALETTES ) {
				for ( const theme of APPEARANCE_THEMES ) {
					root.setAttribute( 'data-tocus-palette', palette );
					root.setAttribute( 'data-tocus-theme', theme );
					const styles = getComputedStyle( root );
					const definitions = FULL_SCENE_COLOR_TOKENS.map( ( token ) =>
						styles.getPropertyValue( token ).trim(),
					);
					const firstColors = FULL_SCENE_COLOR_TOKENS.map( ( token ) => {
						firstColorProbe.style.color = `var(${ token })`;
						return getComputedStyle( firstColorProbe ).color;
					} );
					const secondColors = FULL_SCENE_COLOR_TOKENS.map( ( token ) => {
						secondColorProbe.style.color = `var(${ token })`;
						return getComputedStyle( secondColorProbe ).color;
					} );

					expect( definitions.every( ( definition ) => definition.length > 0 ) ).to.equal( true );
					expect( firstColors ).to.deep.equal( secondColors );
					appearances.add( firstColors.join( '|' ) );
				}
			}

			expect( appearances.size ).to.equal( APPEARANCE_PALETTES.length * APPEARANCE_THEMES.length );
		} finally {
			if ( originalPalette === null ) {
				root.removeAttribute( 'data-tocus-palette' );
			} else {
				root.setAttribute( 'data-tocus-palette', originalPalette );
			}
			if ( originalTheme === null ) {
				root.removeAttribute( 'data-tocus-theme' );
			} else {
				root.setAttribute( 'data-tocus-theme', originalTheme );
			}
			firstProbeContainer.remove();
			secondProbeContainer.remove();
		}
	} );
} );
