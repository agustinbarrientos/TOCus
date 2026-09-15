import { expect, test } from '@playwright/test';
import { Palette } from '../../../../domains/preferences/types';
import type {} from '../../../../../../../tests/visual/originals/presentation/types';

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
