import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from './icons';
import * as contracts from './types';

describe( 'shape-named icon catalog', () => {
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
