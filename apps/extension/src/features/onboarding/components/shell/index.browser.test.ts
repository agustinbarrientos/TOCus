import { expect, test } from '@playwright/test';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import type {} from '../../../../../../../tests/visual/originals/presentation/types';

for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	test( `updates the preview sphere when changing palettes in ${ theme } appearance`, async ( { page } ) => {
		await page.goto( `/tests/visual/originals/presentation/?scenario=appearance&theme=${ theme }` );
		await expect( page.getByRole( 'heading', { name: 'Make TOCus yours', exact: true } ) ).toBeVisible();
		const sphere = page.locator( '.onboarding-preview tocus-f-breathing-sphere' );
		await expect( sphere ).toHaveAttribute( 'still', '' );
		const canvas = sphere.locator( 'canvas' );
		/** @return The rendered sphere's center pixel, independent of its inherited CSS colors. */
		const readCenterPixel = () => canvas.evaluate( ( element: HTMLCanvasElement ) => {
			const context = element.getContext( '2d' );
			if ( ! context ) {
				throw new Error( 'Expected the preview sphere canvas context.' );
			}
			return Array.from( context.getImageData( element.width / 2, element.height / 2, 1, 1 ).data );
		} );
		await expect.poll( async () => ( await readCenterPixel() )[ 3 ] ).toBe( 255 );
		for ( const label of [ 'Orange', 'Blue', 'Orange' ] ) {
			await test.step( `renders the selected ${ label.toLowerCase() } sphere`, async () => {
				const choice = page.getByRole( 'radio', { name: label, exact: true } );
				await choice.click();
				await expect( choice ).toBeChecked();
				await expect.poll( async () => {
					const [ red = 0, , blue = 0 ] = await readCenterPixel();
					return label === 'Blue' ? blue > red : red > blue;
				} ).toBe( true );
			} );
		}
	} );
}

test( 'keeps ordinary onboarding usable when notification copy is unavailable', async ( { page } ) => {
	await page.goto( '/tests/visual/originals/presentation/?scenario=language' );
	await expect( page.getByRole( 'heading', { name: 'Choose your language', exact: true } ) ).toBeVisible();
	await page.evaluate( ( palette ) => {
		window.onboardingOriginal.notificationCopy = undefined;
		window.onboardingOriginal.palette = palette;
	}, Palette.PURPLE );
	await expect( page.locator( '[data-tocus-ui][data-tocus-palette="purple"]' ) ).toBeVisible();
	await expect( page.locator( '.tocus-snackbar' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Make TOCus yours', exact: true } ) ).toBeVisible();
} );

test( 'announces a completed reset once without notifying ordinary onboarding', async ( { page } ) => {
	await page.goto( '/tests/visual/originals/presentation/?scenario=language' );
	await expect( page.getByRole( 'heading', { name: 'Choose your language', exact: true } ) ).toBeVisible();
	const notice = page.locator( '.tocus-snackbar' );
	await expect( notice ).toHaveCount( 0 );
	await page.evaluate( () => {
		window.onboardingOriginal.resetComplete = true;
	} );
	await expect( notice ).toHaveText( 'All TOCus data reset.' );
	await expect( notice ).toHaveAttribute( 'role', 'status' );
	await expect( notice ).toHaveAttribute( 'data-snackbar-tone', 'success' );
	await notice.getByRole( 'button', { name: 'Dismiss notification', exact: true } ).click();
	await expect( notice ).toHaveCount( 0 );
	await page.evaluate( ( palette ) => {
		const copy = window.onboardingOriginal.notificationCopy;
		if ( copy ) {
			window.onboardingOriginal.notificationCopy = { ...copy };
		}
		window.onboardingOriginal.palette = palette;
	}, Palette.PURPLE );
	await expect( page.locator( '[data-tocus-ui][data-tocus-palette="purple"]' ) ).toBeVisible();
	await expect( notice ).toHaveCount( 0 );
} );
