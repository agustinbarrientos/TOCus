import { assert, expect, fixture, html } from '@open-wc/testing';
import { emulateMedia, sendKeys, setViewport } from '@web/test-runner-commands';
import { createTestI18n } from '../../../../localization/__fixtures__';
import { createAboutScreenCopy } from '../../../../localization/utils/create-about-screen-copy';
import './index';
import { type ComponentAboutScreen } from './index';

/**
 * English copy produced by the localized About-screen boundary.
 * @since 0.1.0 Initial implementation.
 */
const ABOUT_COPY = createAboutScreenCopy( createTestI18n() );

describe( 'tocus-f-about-screen', () => {
	afterEach( async () => {
		await setViewport( { height: 600, width: 800 } );
		await emulateMedia( { forcedColors: 'none' } );
	} );

	it( 'does not show untranslated content before copy is available', async () => {
		const element = await fixture<ComponentAboutScreen>( html`<tocus-f-about-screen></tocus-f-about-screen>` );

		assert.isNull( element.shadowRoot?.querySelector( 'main' ) );
	} );

	it( 'shows the shared brand and supplied extension version', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY } .version=${ '2.3.4' }></tocus-f-about-screen>
		` );

		assert.equal( element.shadowRoot?.querySelector( 'h1' )?.textContent, 'TOCus' );
		assert.include( element.shadowRoot?.textContent, 'Version 2.3.4' );
		assert.exists( element.shadowRoot?.querySelector( '[aria-hidden="true"] svg' ) );
		assert.include( element.shadowRoot.textContent, 'Free and open source. Your settings and statistics stay on this device.' );
		await expect( element ).to.be.accessible();
	} );

	it( 'does not invent a version before the runtime supplies one', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );

		assert.notInclude( element.shadowRoot?.textContent, 'Version' );
		element.version = '2.3.5';
		await element.updateComplete;
		assert.include( element.shadowRoot?.textContent, 'Version 2.3.5' );
	} );

	it( 'uses the selected palette for the shared icon', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY } style="--tocus-color-action: rgb(180, 160, 210);"></tocus-f-about-screen>
		` );
		const icon = element.shadowRoot?.querySelector( 'svg' );

		assert.exists( icon );
		assert.equal( getComputedStyle( icon ).color, 'rgb(180, 160, 210)' );
	} );

	it( 'offers only explicit source, license, and contribution links', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );
		const links = Array.from( element.shadowRoot?.querySelectorAll<HTMLAnchorElement>( 'a' ) ?? [] );

		assert.deepEqual( links.map( ( link ) => [ link.textContent.trim(), link.href ] ), [
			[ 'Source code', 'https://github.com/agustinbarrientos/TOCus' ],
			[ 'MIT license', 'https://github.com/agustinbarrientos/TOCus/blob/main/LICENSE' ],
			[ 'Contribute', 'https://github.com/agustinbarrientos/TOCus/blob/main/CONTRIBUTING.md' ],
		] );
		for ( const link of links ) {
			assert.equal( link.target, '_blank' );
			assert.isTrue( link.relList.contains( 'noopener' ) );
			assert.isTrue( link.relList.contains( 'noreferrer' ) );
		}
		assert.include( element.shadowRoot?.textContent, 'These links open GitHub in a new tab.' );
	} );

	it( 'replaces visible copy without recreating the screen', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );

		element.copy = { ...ABOUT_COPY, sourceCode: 'Quellcode', linksTitle: 'Gemeinsam entwickelt' };
		await element.updateComplete;

		assert.equal( element.shadowRoot?.querySelector( 'a' )?.textContent.trim(), 'Quellcode' );
		assert.equal( element.shadowRoot?.querySelector( 'h2' )?.textContent, 'Gemeinsam entwickelt' );
	} );

	it( 'keeps links keyboard reachable in a predictable order', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );
		const links = Array.from( element.shadowRoot?.querySelectorAll<HTMLAnchorElement>( 'a' ) ?? [] );
		assert.lengthOf( links, 3 );
		links[ 0 ]?.focus();
		await sendKeys( { press: 'Tab' } );
		assert.equal( element.shadowRoot?.activeElement, links[ 1 ] );
		await sendKeys( { press: 'Tab' } );
		assert.equal( element.shadowRoot?.activeElement, links[ 2 ] );
	} );

	it( 'keeps narrow forced-color links readable and usable', async () => {
		await setViewport( { height: 900, width: 320 } );
		await emulateMedia( { forcedColors: 'active' } );
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY } .version=${ '2.3.4' }></tocus-f-about-screen>
		` );
		const main = element.shadowRoot?.querySelector( 'main' );
		assert.exists( main );
		assert.isAtMost( main.scrollWidth, main.clientWidth + 1 );
		for ( const link of element.shadowRoot?.querySelectorAll( 'a' ) ?? [] ) {
			assert.isAtLeast( link.getBoundingClientRect().height, 44 );
		}
		await expect( element ).to.be.accessible();
	} );
} );
