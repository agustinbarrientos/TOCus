import { describe, expect, it } from 'vitest';
import config from '../../config/wtr/web-test-runner.config.js';

const [ scssPlugin ] = config.plugins;
const linguiMacroPlugin = config.plugins.find( ( plugin ) => plugin.name === 'lingui-macro' );
const linguiRuntimeDependenciesPlugin = config.plugins.find(
	( plugin ) => plugin.name === 'lingui-runtime-dependencies',
);
const context = { path: '/src/features/popup/components/shell/index.ts' };

describe( 'web test runner configuration', () => {
	it( 'keeps local visual comparisons out of the default browser suite', () => {
		expect( config.files ).to.deep.equal( [
			'src/**/*.wtr.test.ts',
			'!src/**/visual.wtr.test.ts',
		] );
	} );

	it( 'excludes pure domain modules without hiding future domain components', () => {
		expect( config.coverageConfig.exclude ).to.include.members( [
			'src/domains/protection/services/protection-configuration-editor/**/*.ts',
			'src/domains/protection/types/**/*.ts',
			'src/domains/protection/utils/**/*.ts',
			'src/features/protected-sites/utils/**/*.ts',
		] );
		expect( config.coverageConfig.exclude ).not.to.include( 'src/domains/protection/types.ts' );
		expect( config.coverageConfig.exclude ).not.to.include( 'src/domains/protection/**/*.ts' );
	} );

	it( 'accepts only relative SCSS inline imports', () => {
		expect(
			scssPlugin.resolveImport( {
				context,
				source: './web-component-style.scss?inline',
			} ),
		).to.equal( '/__scss_inline__/src/features/popup/components/shell/web-component-style.scss' );
		expect(
			scssPlugin.resolveImport( { context, source: '@tocus/theme/index.scss?inline' } ),
		).to.equal( undefined );
	} );

	it( 'does not serve non-SCSS or outside virtual targets', () => {
		expect( scssPlugin.serve( { path: '/__scss_inline__/config/wtr/test-themes.css' } ) ).to.equal( undefined );
		expect( scssPlugin.serve( { path: '/__scss_inline__/../../packages/theme/tokens.scss' } ) ).to.equal(
			undefined,
		);
	} );

	it( 'registers the Lingui macro transform', () => {
		expect( linguiMacroPlugin ).not.to.equal( undefined );
	} );

	it( 'serves Lingui runtime dependencies through a browser-compatible boundary', () => {
		expect( linguiRuntimeDependenciesPlugin ).not.to.equal( undefined );
	} );
} );
