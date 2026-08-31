import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { describe, expect, it } from 'vitest';

const TYPOGRAPHY_ROLES = [
	'display-large',
	'display-medium',
	'display-small',
	'headline-large',
	'headline-medium',
	'headline-small',
	'title-large',
	'title-medium',
	'title-small',
	'body-large',
	'body-medium',
	'body-small',
	'label-large',
	'label-medium',
	'label-small',
] as const;
const themeRoot = fileURLToPath( new URL( '..', import.meta.url ) );

describe( 'typography', () => {
	it.each( TYPOGRAPHY_ROLES )( 'compiles the %s role into declarations', ( role ) => {
		const result = sass.compileString(
			`@use 'typography' as typography;
.subject {
	@include typography.apply( '${ role }' );
}`,
			{ loadPaths: [ themeRoot ] },
		);

		expect( result.css.trim() ).not.toBe( '' );
	} );

	it( 'rejects an unknown role during compilation', () => {
		expect( () =>
			sass.compileString(
				`@use 'typography' as typography;
.subject {
	@include typography.apply( 'unknown' );
}`,
				{ loadPaths: [ themeRoot ] },
			),
		).toThrow( 'Unknown TOCus typography role "unknown".' );
	} );
} );
