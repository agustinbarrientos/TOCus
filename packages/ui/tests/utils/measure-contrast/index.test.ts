import { expect, test } from '@playwright/test';
import { measureContrast } from './index';

test.describe( 'browser contrast measurement', () => {
	test( 'measures every surface and resolves inherited and mixed colors in one batch', async ( { page } ) => {
		await page.setContent( `<main style="background: white; color: black">
			<button data-contrast>Inherited</button>
			<button data-contrast disabled>Disabled</button>
			<div data-contrast style="color: white">Invisible</div>
			<div data-contrast style="color: color-mix(in srgb, black 50%, white)">Mixed</div>
		</main><style>button { background: transparent; color: inherit }</style>` );
		const results = await page.locator( '[data-contrast]' ).evaluateAll( measureContrast );
		expect( results.map( ( result ) => result.label ) ).toEqual( [ 'Inherited', 'Disabled', 'Invisible', 'Mixed' ] );
		expect( results.map( ( result ) => result.focusable ) ).toEqual( [ true, false, false, false ] );
		expect( results.map( ( result ) => result.background ) ).toEqual( Array<string>( 4 ).fill( 'rgb(255, 255, 255)' ) );
		expect( results[ 0 ]?.ratio ).toBe( 21 );
		expect( results[ 1 ]?.ratio ).toBe( 21 );
		expect( results[ 2 ]?.ratio ).toBe( 1 );
		expect( results[ 3 ]?.ratio ).toBeCloseTo( 3.95, 2 );
	} );

	test( 'detects illegible hover and keyboard-focus colors through real input', async ( { page, browserName } ) => {
		await page.setContent( `<button>Previous</button><button id="target">Save</button>
			<style>
				#target { background: white; color: black }
				#target:hover, #target:focus-visible { color: white }
			</style>` );
		const target = page.locator( '#target' );
		expect( ( await target.evaluateAll( measureContrast ) )[ 0 ]?.ratio ).toBe( 21 );
		await target.hover();
		expect( ( await target.evaluateAll( measureContrast ) )[ 0 ]?.ratio ).toBe( 1 );
		await page.mouse.move( 0, 0 );
		await page.getByRole( 'button', { name: 'Previous' } ).focus();
		await page.keyboard.press( browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab' );
		await expect( target ).toBeFocused();
		expect( ( await target.evaluateAll( measureContrast ) )[ 0 ]?.ratio ).toBe( 1 );
	} );
} );
