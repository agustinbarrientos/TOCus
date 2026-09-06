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

	it( 'links the creator and contribution actions to their explicit destinations', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );
		const links = Array.from( element.shadowRoot?.querySelectorAll<HTMLAnchorElement>( 'a' ) ?? [] );

		assert.deepEqual( links.map( ( link ) => [ link.textContent.trim(), link.href ] ), [
			[ 'Developed by Agustin Barrientos', 'https://agustinbarrientos.com/about/?utm_source=tocus&utm_medium=extension&utm_campaign=about' ],
			[ 'Source code', 'https://github.com/agustinbarrientos/TOCus' ],
			[ 'Suggest improvements', 'https://github.com/agustinbarrientos/TOCus/issues/new?template=feature_request.yml' ],
			[ 'Contribute', 'https://github.com/agustinbarrientos/TOCus/blob/main/CONTRIBUTING.md' ],
			[ 'Fork the project', 'https://github.com/agustinbarrientos/TOCus/fork' ],
			[ 'MIT license', 'https://github.com/agustinbarrientos/TOCus/blob/main/LICENSE' ],
		] );
		for ( const link of links ) {
			assert.equal( link.target, '_blank' );
			assert.isTrue( link.relList.contains( 'noopener' ) );
			assert.isTrue( link.relList.contains( 'noreferrer' ) );
		}
		assert.include( element.shadowRoot?.textContent, 'External links connect to their websites only when you choose to open them.' );
	} );

	it( 'replaces visible copy without recreating the screen', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );

		element.copy = { ...ABOUT_COPY, sourceCode: 'Quellcode', linksTitle: 'Gemeinsam entwickelt' };
		await element.updateComplete;

		assert.equal( element.shadowRoot?.querySelector( 'a[href="https://github.com/agustinbarrientos/TOCus"]' )?.textContent.trim(), 'Quellcode' );
		assert.equal( element.shadowRoot?.querySelector( '#links-title' )?.textContent, 'Gemeinsam entwickelt' );
	} );

	it( 'keeps links keyboard reachable in a predictable order', async () => {
		const element = await fixture<ComponentAboutScreen>( html`
			<tocus-f-about-screen .copy=${ ABOUT_COPY }></tocus-f-about-screen>
		` );
		const links = Array.from( element.shadowRoot?.querySelectorAll<HTMLAnchorElement>( 'a' ) ?? [] );
		assert.lengthOf( links, 6 );
		links[ 0 ]?.focus();
		for ( const link of links.slice( 1 ) ) {
			await sendKeys( { press: 'Tab' } );
			assert.equal( element.shadowRoot?.activeElement, link );
		}
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
