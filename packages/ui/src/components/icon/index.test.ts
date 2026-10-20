import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from './index';
import * as contracts from './types';

describe( 'shape-named icon catalog', () => {
	it( 'keeps theme color inheritance and the secondary layer in the supplied duotone artwork', () => {
		for ( const name of Object.values( contracts.IconName ) ) {
			if ( name === contracts.IconName.CAPYBARA || name === contracts.IconName.CIRCLE_CHECK
				|| name === contracts.IconName.CIRCLE_QUESTION || name.startsWith( 'arrow-trend-' )
				|| name === 'arrow-turn-down-right' || name === 'chevrons-right' ) {
				continue;
			}
			const rendered = renderToStaticMarkup( createElement( Icon, { name } ) );
			expect( rendered, name ).toContain( 'fill="currentColor"' );
			expect( rendered, name ).toContain( 'opacity=".4"' );
		}
	} );
	it.each( [
		[ 'ARROW_TURN_DOWN_RIGHT', 'arrow-turn-down-right', 'M112 152C112 138.7 101.3 128 88 128C74.7 128 64 138.7 64 152L64 248C64 301 107 344 160 344L494.1 344L399.1 439C389.7 448.4 389.7 463.6 399.1 472.9C408.5 482.2 423.7 482.3 433 472.9L569 337C573.5 332.5 576 326.4 576 320C576 313.6 573.5 307.5 569 303L433 167C423.6 157.6 408.4 157.6 399.1 167C389.8 176.4 389.7 191.6 399.1 200.9L494.1 295.9L160 295.9C133.5 295.9 112 274.4 112 247.9L112 151.9z' ],
		[ 'CHEVRONS_RIGHT', 'chevrons-right', 'M47 167C56.4 157.6 71.6 157.6 80.9 167L216.9 303L218.6 304.8C226.3 314.2 225.7 328.1 216.9 336.9L80.9 472.9L79.1 474.6C69.7 482.3 55.8 481.7 47 472.9C38.2 464.1 37.7 450.2 45.3 440.8L47 439L166.1 320L47 201C37.6 191.6 37.6 176.4 47 167.1zM239 167C248.4 157.6 263.6 157.6 272.9 167L408.9 303L410.6 304.8C418.3 314.2 417.7 328.1 408.9 336.9L272.9 472.9L271.1 474.6C261.7 482.3 247.8 481.7 239 472.9C230.2 464.1 229.7 450.2 237.3 440.8L239 439L358 320L239 201C229.6 191.6 229.6 176.4 239 167.1zM431 167C440.4 157.6 455.6 157.6 464.9 167L600.9 303L602.6 304.8C610.3 314.2 609.7 328.1 600.9 336.9L464.9 472.9L463.1 474.6C453.7 482.3 439.8 481.7 431 472.9C422.2 464.1 421.7 450.2 429.3 440.8L431 439L550 320L431 201C421.6 191.6 421.6 176.4 431 167.1z' ],
	] )( 'preserves the supplied single-path %s artwork', ( key, filename, path ) => {
		expect( contracts.IconName ).toHaveProperty( key );
		const name = contracts.IconName[ key as keyof typeof contracts.IconName ];
		const artwork = readFileSync( new URL( `../../../../theme/assets/icons/${ filename }.svg`, import.meta.url ), 'utf8' ).trim();
		const rendered = renderToStaticMarkup( createElement( Icon, { name } ) );
		expect( artwork ).toContain( `d="${ path }"` );
		expect( artwork ).toContain( 'viewBox="0 0 640 640"' );
		expect( artwork ).toContain( 'Font Awesome Pro v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2026 Fonticons, Inc.' );
		expect( artwork ).toContain( 'fill="currentColor"' );
		expect( rendered ).toContain( artwork );
		expect( rendered.match( /<path\b/g ) ).toHaveLength( 1 );
		expect( rendered ).not.toContain( 'opacity=' );
	} );
	it.each( [ 'ARROW_TREND_UP', 'ARROW_TREND_DOWN' ] )( 'uses the supplied single-path %s artwork', ( key ) => {
		expect( contracts.IconName ).toHaveProperty( key );
		const name = contracts.IconName[ key as keyof typeof contracts.IconName ];
		const rendered = renderToStaticMarkup( createElement( Icon, { name } ) );
		expect( rendered.match( /<path\b/g ) ).toHaveLength( 1 );
		expect( rendered ).toContain( 'Font Awesome Pro v7.3.1' );
		expect( rendered ).not.toContain( 'opacity=".4"' );
		expect( rendered ).toContain( 'fill="currentColor"' );
	} );
	it( 'keeps the supplied single-path question circle separate from informational feedback', () => {
		expect( contracts.IconName ).toHaveProperty( 'CIRCLE_QUESTION' );
		const rendered = renderToStaticMarkup( createElement( Icon, { name: contracts.IconName.CIRCLE_QUESTION } ) );
		expect( rendered.match( /<path\b/g ) ).toHaveLength( 1 );
		expect( rendered ).toContain( 'Font Awesome Free v7.3.1' );
		expect( rendered ).toContain( 'fill="currentColor"' );
		expect( rendered ).not.toContain( 'opacity=".4"' );
		const information = renderToStaticMarkup( createElement( Icon, { name: contracts.IconName.CIRCLE_INFO } ) );
		expect( rendered ).not.toBe( information );
	} );
	it( 'includes the supplied user and lock artwork used by onboarding privacy', () => {
		expect( contracts.IconName ).toHaveProperty( 'USER_LOCK' );
		expect( contracts.IconName ).toHaveProperty( 'CAPYBARA' );
	} );
	it( 'renders every catalog entry from its matching supplied shape asset', () => {
		expect( contracts ).toHaveProperty( 'IconName' );
		const renderedShapes = new Set<string>();
		for ( const name of Object.values( contracts.IconName ) ) {
			const asset = name === contracts.IconName.CAPYBARA ? '../../../../theme/assets/icon.svg' : `../../../../theme/assets/icons/${ name }.svg`;
			const artwork = readFileSync( new URL( asset, import.meta.url ), 'utf8' ).trim();
			const rendered = renderToStaticMarkup( createElement( Icon, { name } ) );
			expect( rendered ).toContain( artwork );
			expect( rendered ).toContain( 'aria-hidden="true"' );
			renderedShapes.add( artwork );
		}
		expect( renderedShapes.size ).toBe( Object.values( contracts.IconName ).length );
	} );
} );
