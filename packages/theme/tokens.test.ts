import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const FALLBACK_COLOR_TOKENS = [
	'--tocus-color-stage-start',
	'--tocus-color-stage-middle',
	'--tocus-color-stage-end',
	'--tocus-color-breathing-sphere',
	'--tocus-color-breathing-sphere-highlight',
	'--tocus-color-breathing-sphere-shadow',
	'--tocus-color-shadow-depth',
	'--tocus-color-on-stage',
	'--tocus-color-on-stage-muted',
	'--tocus-color-surface',
	'--tocus-color-on-surface-muted',
	'--tocus-color-surface-container',
	'--tocus-color-primary',
	'--tocus-color-on-primary',
	'--tocus-color-stage-glow',
	'--tocus-color-breathing-sphere-contour',
	'--tocus-color-glass-surface',
	'--tocus-color-glass-border',
	'--tocus-color-focus-ring',
	'--tocus-color-icon-accent',
	'--tocus-color-action',
	'--tocus-color-on-action',
	'--tocus-color-surface-lowest',
	'--tocus-color-on-surface',
	'--tocus-color-outline',
	'--tocus-shadow-soft',
] as const;

const themeRoot = fileURLToPath( new URL( '.', import.meta.url ) );

/**
 * Compiles the complete theme-token stylesheet.
 * @return Compiled theme-token CSS.
 * @since 0.1.0 Initial implementation.
 */
function compileTokens(): string {
	return sass.compileString( "@use 'tokens';", { loadPaths: [ themeRoot ] } ).css;
}

/**
 * Compiles theme tokens for one isolated Shadow DOM host.
 * @return Compiled host-scoped theme-token CSS.
 * @since 0.1.0 Initial implementation.
 */
function compileHostTokens(): string {
	return sass.compileString(
		"@use 'tokens' with ($selector: ':host');",
		{ loadPaths: [ themeRoot ] },
	).css;
}

describe( 'theme color tokens', () => {
	it( 'provides complete static fallbacks before progressive color mixing', () => {
		const css = compileTokens();
		const enhancementIndex = css.indexOf( '@supports (color: color-mix' );

		expect( enhancementIndex ).toBeGreaterThan( 0 );

		const fallbackCss = css.slice( 0, enhancementIndex );

		expect( css ).not.toContain( 'light-dark(' );
		expect( fallbackCss ).not.toContain( 'color-mix(' );
		expect( fallbackCss ).toContain( '@media (prefers-color-scheme: dark)' );
		expect( fallbackCss ).toContain( ':root[data-tocus-theme=dark]' );
		expect( fallbackCss ).toContain( ':root[data-tocus-theme=light]' );

		for ( const token of FALLBACK_COLOR_TOKENS ) {
			expect( fallbackCss ).toContain( `${ token }:` );
		}
	} );

	it( 'can scope the complete theme to an isolated component host', () => {
		const css = compileHostTokens();

		expect( css ).toContain( ':host {' );
		expect( css ).toContain( ':host[data-tocus-theme=dark]' );
		expect( css ).toContain( ':host[data-tocus-palette=green]' );
		expect( css ).not.toContain( ':root' );

		for ( const token of FALLBACK_COLOR_TOKENS ) {
			expect( css ).toContain( `${ token }:` );
		}
	} );
} );
