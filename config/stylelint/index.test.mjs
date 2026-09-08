import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';
import config from '../../stylelint.config.js';

const codeFilename = `${ process.cwd() }/apps/extension/src/features/settings/components/timing-controls/style.scss`;

describe( 'application theme ownership', () => {
	it( 'allows the shared theme to configure the packaged button variant variables', async () => {
		const result = await stylelint.lint( {
			config, codeFilename: `${ process.cwd() }/packages/ui/src/styles.scss`,
			code: '.mantine-Button-root {\n --button-bg: red;\n --button-color: white;\n --button-bd: 1px solid red;\n}',
		} );
		expect( result.results.flatMap( ( file ) => file.warnings ) ).toEqual( [] );
	} );

	it( 'does not allow applications to redefine packaged button variants', async () => {
		const result = await stylelint.lint( {
			config, codeFilename,
			code: '.settings-action {\n --button-bg: red;\n}',
		} );
		expect( result.results.flatMap( ( file ) => file.warnings ) )
			.toContainEqual( expect.objectContaining( { rule: 'property-disallowed-list' } ) );
	} );

	it( 'allows consuming public library sizing tokens without duplicating their values', async () => {
		const result = await stylelint.lint( {
			config, codeFilename,
			code: '.settings-mark {\n width: var(--slider-size);\n margin: var(--mantine-spacing-xs);\n}',
		} );
		expect( result.results.flatMap( ( file ) => file.warnings ) ).toEqual( [] );
	} );

	it( 'keeps application declarations in the owned namespace instead of overriding library tokens', async () => {
		const result = await stylelint.lint( {
			config, codeFilename,
			code: '.settings-mark {\n --mantine-spacing-xs: 4px;\n --slider-size: 2px;\n}',
		} );
		expect( result.results.flatMap( ( file ) => file.warnings ) ).toEqual( [
			expect.objectContaining( { rule: 'property-disallowed-list' } ),
			expect.objectContaining( { rule: 'property-disallowed-list' } ),
		] );
	} );
} );
