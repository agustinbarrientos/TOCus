import { describe, expect, it } from 'vitest';
import config from '../../config/wtr/web-test-runner.config.js';

const [ scssPlugin ] = config.plugins;
const context = { path: '/src/features/popup/components/shell/index.ts' };

describe( 'web test runner SCSS inline plugin', () => {
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
} );
