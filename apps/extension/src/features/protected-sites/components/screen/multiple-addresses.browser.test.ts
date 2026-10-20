import { expect, type Page } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

/**
 * Stages a complete comma-separated batch through the production form.
 * @param page - Isolated Settings page.
 * @param addresses - Raw address list entered by the user.
 * @return Completion of the plural Add sites action.
 */
async function addSites( page: Page, addresses: string ): Promise<void> {
	await page.getByLabel( 'Website address', { exact: true } ).fill( addresses );
	await page.getByRole( 'button', { name: 'Add sites', exact: true } ).click();
}

/**
 * Commits the page draft through the production permission-aware Save action.
 * @param page - Isolated Settings page.
 * @param writes - Total expected successful configuration writes.
 * @return Completion of the atomic configuration write.
 */
async function save( page: Page, writes: number ): Promise<void> {
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( writes );
}

/**
 * Sets optional active hours shared by the pending explicit additions.
 * @param page - Isolated Settings page with a pending address.
 * @param start - Start of the Monday active window.
 * @param end - End of the Monday active window.
 * @return Completion of the custom schedule controls.
 */
async function setSchedule( page: Page, start: string, end: string ): Promise<void> {
	const schedule = page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } );
	await expect( schedule ).toBeVisible();
	// Let the address-dependent layout paint before Firefox's next native pointer action.
	await page.evaluate( () => new Promise<void>( ( resolve ) => {
		requestAnimationFrame( () => requestAnimationFrame( () => {
			resolve();
		} ) );
	} ) );
	await schedule.click();
	await page.getByLabel( 'Start', { exact: true } ).fill( start );
	await page.getByLabel( 'End', { exact: true } ).fill( end );
}

test( 'counts nonempty address segments for the Add label before canonical deduplication', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	const address = page.getByLabel( 'Website address', { exact: true } );
	await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeVisible();
	await address.fill( ' , example.com, , ' );
	await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeVisible();
	await address.fill( 'example.com, , https://www.example.com/' );
	await expect( page.getByRole( 'button', { name: 'Add sites', exact: true } ) ).toBeVisible();
	await address.fill( ', ,  , ' );
	await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeVisible();
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toBeVisible();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await address.fill( ' , , ' );
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toBeVisible();
	await expect( address ).toHaveValue( ' , , ' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
} );

test( 'accepts a single nonempty address surrounded by empty comma segments', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( ' , example.com, , ' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 1 );
	await expect( page.getByRole( 'heading', { name: 'Example', exact: true } ) ).toBeVisible();
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
} );

test( 'stages trimmed canonical batches and discards every addition without writes or access requests', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSites( page, ' , example.com, , EXAMPLE.org, https://www.example.com/ , ' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
	await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeVisible();
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
} );

test( 'retains the entire invalid batch and names rejected entries before a corrected Add stages it', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	const addresses = 'example.com, not a website, javascript:alert(1), example.org';
	await addSites( page, addresses );
	const error = page.getByRole( 'alert' );
	await expect( error ).toContainText( 'not a website' );
	await expect( error ).toContainText( 'javascript:alert(1)' );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( addresses );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	await addSites( page, 'example.com, example.org' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	await expect( error ).toHaveCount( 0 );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
} );

test( 'rejects an invalid pending batch during Save without partially staging it or losing earlier edits', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.net' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	const addresses = 'example.com, not a website, example.org';
	await page.getByLabel( 'Website address', { exact: true } ).fill( addresses );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toContainText( 'not a website' );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( addresses );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 1 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
} );

test( 'saves a pending canonical batch with uniform active hours and one browser access gesture', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( ' example.com, EXAMPLE.org, https://www.example.com/ ' );
	await setSchedule( page, '09:00', '17:00' );
	await save( page, 1 );
	const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( sites.map( ( site ) => site.identityHost ) ).toEqual( [ 'example.com', 'example.org' ] );
	for ( const site of sites ) {
		expect( site.schedule ).toEqual( { mode: 'custom',
			windows: [ { weekday: 'Monday', startMinute: 540, endMinute: 1020 } ] } );
		expect( site.displayNameOverride ).toBeUndefined();
	}
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	await expect( page.getByRole( 'button', { name: 'Allow access', exact: true } ) ).toHaveCount( 0 );
} );

test( 'combines staged and pending batches in one Save transaction', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSites( page, 'example.com, example.org' );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.net, example.info' );
	await save( page, 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites
		.map( ( site ) => site.identityHost ) ) )
		.toEqual( [ 'example.com', 'example.org', 'example.net', 'example.info' ] );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 4 );
} );

test( 'ignores a duplicate-only pending batch when saving unrelated row edits', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
	await save( page, 1 );
	await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
	const dialog = page.getByRole( 'dialog' );
	await dialog.getByLabel( 'Name', { exact: true } ).fill( 'Pending reading name' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com, https://www.example.com/' );
	await setSchedule( page, '10:00', '18:00' );
	await save( page, 2 );
	const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( sites ).toHaveLength( 1 );
	expect( sites[ 0 ]?.displayNameOverride ).toBe( 'Pending reading name' );
	expect( sites[ 0 ]?.schedule ).toBeUndefined();
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
} );

test( 'announces a duplicate-only Add and highlights the first matching row without claiming an addition', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await addSites( page, 'example.com, example.org' );
	await addSites( page, 'EXAMPLE.org, https://www.example.com/' );
	await expect( page.getByRole( 'status' ).filter( { hasText: 'This site is already in your list.' } ) ).toBeVisible();
	await expect( page.getByRole( 'status' ).filter( { hasText: 'Site added. Save to apply your changes.' } ) )
		.toHaveCount( 0 );
	await expect( page.locator( '.settings-site-item' ).filter( { hasText: 'example.org' } ) )
		.toHaveAttribute( 'data-highlighted', 'true' );
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toHaveValue( '' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
} );

test( 'skips canonical duplicates while preserving saved name, policy, schedule and timing overrides', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
	const dialog = page.getByRole( 'dialog' );
	await dialog.getByLabel( 'Name', { exact: true } ).fill( 'My reading' );
	await setSchedule( page, '09:00', '17:00' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await save( page, 1 );
	const original = await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'EXAMPLE.com/, https://www.example.com, example.org, example.org' );
	await setSchedule( page, '10:00', '18:00' );
	await page.getByRole( 'button', { name: 'Add sites', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	await save( page, 2 );
	const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( sites[ 0 ] ).toEqual( original );
	expect( sites[ 1 ]?.identityHost ).toBe( 'example.org' );
	expect( sites[ 1 ]?.schedule ).toEqual( { mode: 'custom',
		windows: [ { weekday: 'Monday', startMinute: 600, endMinute: 1080 } ] } );
	expect( sites[ 1 ]?.rule.behavior ).toBeUndefined();
	expect( sites[ 1 ]?.timingConfiguration ).toBeUndefined();
} );

for ( const addresses of [ 'youtube.com/shorts, youtube.com, studio.youtube.com',
	'studio.youtube.com, youtube.com, youtube.com/shorts' ] ) {
	test( `gives all explicit paused targets precedence over inferred defaults for ${ addresses }`, async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await addSites( page, addresses );
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
		await expect( page.getByText( 'No pause', { exact: true } ) ).toHaveCount( 0 );
		await save( page, 1 );
		const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
		expect( sites ).toHaveLength( 3 );
		expect( sites.find( ( site ) => site.rule.host === 'youtube.com' && ! site.rule.pathPrefix )?.rule.behavior )
			.toBeUndefined();
		expect( sites.find( ( site ) => site.rule.host === 'studio.youtube.com' )?.rule.behavior ).toBeUndefined();
		expect( sites.find( ( site ) => site.rule.pathPrefix === '/shorts' )?.rule.behavior ).toBeUndefined();
	} );
}

test( 'schedules explicit additions while generated exceptions and parents keep defaults', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'youtube.com, example.org/videos' );
	await setSchedule( page, '09:00', '17:00' );
	await save( page, 1 );
	const sites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( sites ).toHaveLength( 4 );
	const root = sites.find( ( site ) => site.rule.host === 'youtube.com' );
	const path = sites.find( ( site ) => site.rule.pathPrefix === '/videos' );
	expect( root?.schedule ).toEqual( { mode: 'custom',
		windows: [ { weekday: 'Monday', startMinute: 540, endMinute: 1020 } ] } );
	expect( path?.schedule ).toEqual( root?.schedule );
	for ( const site of sites.filter( ( entry ) => entry.rule.behavior === 'allow' ) ) {
		expect( site.schedule ).toBeUndefined();
		expect( site.timingConfiguration ).toBeUndefined();
		expect( site.displayNameOverride ).toBeUndefined();
	}
	expect( sites.filter( ( site ) => site.rule.behavior === 'allow' ).map( ( site ) => site.rule.host ).sort() )
		.toEqual( [ 'example.org', 'studio.youtube.com' ] );
} );

test( 'retains the whole pending batch after access denial and saves every target on retry', async ( { open, setting } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await setting( page, 'denyAccess', true );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.com, example.org' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toBeVisible();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeEnabled();
	await setting( page, 'denyAccess', false );
	await save( page, 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites
		.map( ( site ) => site.identityHost ) ) )
		.toEqual( [ 'example.com', 'example.org' ] );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 2 );
	await expect( page.getByRole( 'alert' ) ).toHaveCount( 0 );
} );
