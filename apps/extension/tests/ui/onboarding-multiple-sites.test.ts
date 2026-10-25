import { expect, test, type Page } from '@playwright/test';
import { PresentationSurface, SiteBatchScenario } from './types';
import { DefaultProtectionScopeId } from '../../src/domains/protection/types/protection-value';
import type {} from '../../../../tests/visual/originals/presentation/types';

/**
 * Opens the website step through the real preference-save controls.
 * @param page - Browser page mounting the production onboarding flow.
 * @param scenario - Optional enrollment outcome supplied by the fixture.
 */
async function openSites( page: Page, scenario = '' ): Promise<void> {
	await page.goto( `/apps/extension/tests/ui/index.html?surface=${ PresentationSurface.ONBOARDING }&${ scenario }` );
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Make TOCus yours' } ) ).toBeVisible();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Choose websites', exact: true } ) ).toBeVisible();
}

test( 'adds canonical comma-separated domains, subdomains and paths before one Finish consent gesture', async ( { page } ) => {
	await openSites( page, `batch=${ SiteBatchScenario.SUCCESS }` );
	const input = page.getByRole( 'textbox', { name: 'Website address', exact: true } );
	await expect( input ).toHaveAttribute( 'placeholder', 'example.com, sub.example.com, example.com/path' );
	await input.fill( ' example.com, https://www.EXAMPLE.com/, sub.example.org, youtube.com/shorts, , ' );
	const add = page.getByRole( 'button', { name: 'Add sites', exact: true } );
	await add.click();
	await expect( input ).toHaveValue( '' );
	await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeFocused();
	await expect( page.locator( '.added-sites .site-identity span' ) )
		.toHaveText( [ 'example.com', 'sub.example.org', 'youtube.com/shorts' ] );
	await expect( page.locator( '[role="status"][aria-live="polite"]' ) ).toHaveText( '3 websites were added to your list.' );
	await expect( page.getByRole( 'button', { name: 'YouTube', exact: true } ) ).toHaveAttribute( 'aria-pressed', 'false' );
	await expect( page.getByTestId( 'requests' ) ).toHaveText( '0' );
	await page.getByRole( 'button', { name: 'Finish setup', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Open Settings', exact: true } ) ).toBeVisible();
	await expect( page.getByTestId( 'requests' ) ).toHaveText( '1' );
	await expect( page.getByTestId( 'requests' ) ).toHaveAttribute( 'data-activation', 'true' );
	await expect( page.getByTestId( 'requests' ) ).toHaveAttribute( 'data-inputs',
		'["example.com","sub.example.org","youtube.com/shorts"]' );
} );

test( 'keeps an invalid batch intact without partially adding its valid addresses', async ( { page } ) => {
	await openSites( page );
	await page.getByRole( 'button', { name: 'YouTube', exact: true } ).click();
	const input = page.getByRole( 'textbox', { name: 'Website address', exact: true } );
	const invalid = 'example.com, not a website, https://';
	await input.fill( invalid );
	await input.press( 'Enter' );
	await expect( page.getByRole( 'alert' ) ).toHaveText( 'Check these addresses: not a website, https://' );
	await expect( input ).toHaveValue( invalid );
	await expect( input ).toHaveAttribute( 'aria-invalid', 'true' );
	await expect( page.locator( '.added-sites .site-identity span' ) ).toHaveText( [ 'youtube.com' ] );
	await expect( page.getByTestId( 'requests' ) ).toHaveText( '0' );
	await input.fill( 'example.com, example.org' );
	await input.press( 'Enter' );
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
	await expect( input ).toHaveAttribute( 'aria-invalid', 'false' );
	await expect( page.locator( '.added-sites .site-identity span' ) )
		.toHaveText( [ 'youtube.com', 'example.com', 'example.org' ] );
} );

test( 'ignores repeated batch targets while retaining the existing selections and single-site feedback', async ( { page } ) => {
	await openSites( page );
	await page.getByRole( 'button', { name: 'YouTube', exact: true } ).click();
	const input = page.getByRole( 'textbox', { name: 'Website address', exact: true } );
	await input.fill( 'youtube.com, example.com, www.example.com, youtube.com/shorts' );
	await page.getByRole( 'button', { name: 'Add sites', exact: true } ).click();
	await expect( page.locator( '.added-sites .site-identity span' ) )
		.toHaveText( [ 'youtube.com', 'example.com', 'youtube.com/shorts' ] );
	await expect( page.locator( '[role="status"][aria-live="polite"]' ) ).toHaveText( '2 websites were added to your list.' );
	await input.fill( 'youtube.com' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toHaveText( 'That website is already on your list.' );
	await input.fill( 'youtube.com, example.com' );
	await page.getByRole( 'button', { name: 'Add sites', exact: true } ).click();
	await expect( page.locator( '.added-sites .site-identity span' ) )
		.toHaveText( [ 'youtube.com', 'example.com', 'youtube.com/shorts' ] );
	await expect( page.getByTestId( 'requests' ) ).toHaveText( '0' );
	await page.getByRole( 'button', { name: 'YouTube', exact: true } ).click();
	await expect( page.locator( '.added-sites .site-identity span' ) )
		.toHaveText( [ 'example.com', 'youtube.com/shorts' ] );
} );

test( 'retains all batch drafts after denied consent and retries them with one explicit Finish action', async ( { page } ) => {
	await openSites( page );
	await page.getByRole( 'textbox', { name: 'Website address', exact: true } ).fill( 'example.com, example.org/path' );
	await page.getByRole( 'button', { name: 'Add sites', exact: true } ).click();
	await expect( page.getByTestId( 'requests' ) ).toHaveText( '0' );
	for ( const count of [ 1, 2 ] ) {
		await page.getByRole( 'button', { name: 'Finish setup', exact: true } ).click();
		await expect( page.getByRole( 'alert' ) ).toBeVisible();
		await expect( page.locator( '.added-sites .site-identity span' ) ).toHaveText( [ 'example.com', 'example.org/path' ] );
		await expect( page.getByTestId( 'requests' ) ).toHaveText( String( count ) );
		await expect( page.getByTestId( 'requests' ) ).toHaveAttribute( 'data-inputs', '["example.com","example.org/path"]' );
		await expect( page.getByTestId( 'requests' ) ).toHaveAttribute( 'data-activation', 'true' );
	}
} );

test( 'disables empty comma-only input and keeps a single meaningful address singular', async ( { page } ) => {
	await openSites( page );
	const input = page.getByRole( 'textbox', { name: 'Website address', exact: true } );
	await input.fill( ' , , ' );
	await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeDisabled();
	await input.press( 'Enter' );
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
	await input.fill( ' , example.com, ' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await expect( page.locator( '.added-sites .site-identity span' ) ).toHaveText( [ 'example.com' ] );
	await expect( page.locator( '[role="status"][aria-live="polite"]' ) ).toHaveText( 'Example was added to your list.' );
} );

test( 'preserves saved website names and no-pause policies when a batch repeats them', async ( { page } ) => {
	await page.goto( '/tests/visual/originals/presentation/?sites-step' );
	const saved = {
		identityHost: 'youtube.com', displayNameOverride: 'My videos',
		rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId, behavior: 'allow' as const },
	};
	await page.evaluate( ( site ) => {
		window.onboardingOriginal.protectedSites = [ site ];
	}, saved );
	const input = page.getByRole( 'textbox', { name: 'Website address', exact: true } );
	await input.fill( 'youtube.com, example.org, www.youtube.com' );
	await page.getByRole( 'button', { name: 'Add sites', exact: true } ).click();
	await expect( page.locator( '.added-sites .site-identity span' ) ).toHaveText( [ 'youtube.com', 'example.org' ] );
	await expect( page.locator( '.added-sites .site-identity strong' ) ).toHaveText( [ 'My videos', 'Example' ] );
	expect( await page.evaluate( () => window.onboardingOriginal.protectedSites ) ).toEqual( [ saved ] );
} );
