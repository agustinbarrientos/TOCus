import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const themeRoot = fileURLToPath( new URL( '.', import.meta.url ) );

describe( 'theme sizing', () => {
	it( 'compiles fractional and negative dimensions against the inherited surface unit', () => {
		const css = sass.compileString( `@use 'sizing';
.surface {
	padding: sizing.size(0.75) sizing.size(2);
	outline-offset: sizing.size(-0.3125);
}`, { loadPaths: [ themeRoot ] } ).css;

		expect( css ).toContain( 'padding: calc(var(--tocus-size-unit) * 0.75) calc(var(--tocus-size-unit) * 2);' );
		expect( css ).toContain( 'outline-offset: calc(var(--tocus-size-unit) * -0.3125);' );
	} );

	it( 'emits typography and geometry through the same default unit without changing colors or timing', () => {
		const css = sass.compileString( "@use 'tokens';", { loadPaths: [ themeRoot ] } ).css;

		expect( css ).toContain( '--tocus-size-unit: 1rem;' );
		expect( css ).toContain( '--tocus-space-6: calc(var(--tocus-size-unit) * 2);' );
		expect( css ).toContain( '--tocus-radius-small: calc(var(--tocus-size-unit) * 0.75);' );
		expect( css ).toContain( '--tocus-typography-body-small-font-size: calc(var(--tocus-size-unit) * 0.8625);' );
		expect( css ).toContain( '--tocus-shadow-soft: 0 calc(var(--tocus-size-unit) * 1.25) calc(var(--tocus-size-unit) * 3.75) rgb(0 0 0 / 18%);' );
		expect( css ).toContain( '--tocus-color-stage-start: #fff8f0;' );
		expect( css ).toContain( '--tocus-transition-fast: 160ms ease;' );
		expect( css ).toContain( '--tocus-typography-body-small-font-weight: 400;' );
	} );
} );
