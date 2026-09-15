import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from './icons';
import * as contracts from './types';

describe( 'shape-named icon catalog', () => {
	it( 'keeps theme color inheritance and the secondary layer in the supplied duotone artwork', () => {
		for ( const name of Object.values( contracts.IconName ) ) {
			if ( name === contracts.IconName.CAPYBARA || name === contracts.IconName.CIRCLE_CHECK
				|| name === contracts.IconName.CIRCLE_QUESTION ) {
				continue;
			}
			const rendered = renderToStaticMarkup( createElement( Icon, { name } ) );
			expect( rendered, name ).toContain( 'fill="currentColor"' );
			expect( rendered, name ).toContain( 'opacity=".4"' );
		}
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
			const asset = name === contracts.IconName.CAPYBARA ? '../../theme/assets/icon.svg' : `../../theme/assets/icons/${ name }.svg`;
			const artwork = readFileSync( new URL( asset, import.meta.url ), 'utf8' ).trim();
			const rendered = renderToStaticMarkup( createElement( Icon, { name } ) );
			expect( rendered ).toContain( artwork );
			expect( rendered ).toContain( 'aria-hidden="true"' );
			renderedShapes.add( artwork );
		}
		expect( renderedShapes.size ).toBe( Object.values( contracts.IconName ).length );
	} );
} );
