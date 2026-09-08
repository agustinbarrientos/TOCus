import { describe, expect, it } from 'vitest';
import config from '../../config/wtr/web-test-runner.config.js';

describe( 'native browser test configuration', () => {
	it( 'preserves the native media and Canvas contracts without any renderer plugins', () => {
		expect( config.files ).toEqual( [
			'src/features/interruption/services/media-playback-controller/index.wtr.test.ts',
			'src/features/interruption/utils/breathing-sphere-renderer/index.wtr.test.ts',
		] );
		expect( config.plugins ).toHaveLength( 2 );
		expect( config.coverage ).toBe( true );
		expect( config.coverageConfig.threshold ).toEqual( {
			branches: 100, functions: 100, lines: 100, statements: 100,
		} );
	} );

	it( 'serves only local token styles and the supplied browser framework', () => {
		const html = config.testRunnerHtml( '/test-framework.js' );
		expect( html ).toContain( 'src="/test-framework.js"' );
		expect( html ).toContain( '--tocus-color' );
		expect( html ).not.toMatch( /https?:\/\/|@import|lit-html|lit-element/u );
	} );
} );
