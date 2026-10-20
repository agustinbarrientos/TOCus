import { expect, type Page } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

/**
 * Establishes three saved websites through the production form before testing selection-only changes.
 * @param page - Isolated Settings page with the real editor mounted.
 * @return Completion of the initial atomic Save.
 */
async function saveSites( page: Page ): Promise<void> {
	for ( const host of [ 'chess.com', 'instagram.com', 'reddit.com' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( host );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
}

/**
 * Saves a main website, its default Studio exception and a separately selectable path.
 * @param page - Isolated Settings page with the production form mounted.
 * @param addresses - Explicit targets, or the usual main/path/subdomain group.
 * @return Completion of the first persisted Save.
 */
async function saveExceptionSites( page: Page, addresses = [ 'youtube.com', 'youtube.com/shorts' ] ): Promise<void> {
	for ( const address of addresses ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
}

test( 'reveals out-of-flow selection on hover and keyboard focus without changing the saved draft', async ( { open, browserName } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveSites( page );
	const row = page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name: 'Chess.com' } ) } );
	const selection = row.getByRole( 'checkbox', { name: 'Select Chess.com', exact: true } );
	const identity = row.locator( '.settings-site-identity' );
	const before = await identity.boundingBox();
	await page.getByRole( 'heading', { name: 'Websites', exact: true } ).hover();
	await expect( selection ).toHaveCSS( 'opacity', '0' );
	await row.hover();
	await expect( selection ).toHaveCSS( 'opacity', '1' );
	const target = await selection.boundingBox();
	const rowBounds = await row.boundingBox();
	if ( ! target || ! rowBounds || ! before ) {
		throw new Error( 'Selection target, row and identity must have visible layout boxes.' );
	}
	expect( target.x ).toBeGreaterThanOrEqual( 0 );
	expect( target.x + target.width ).toBeLessThanOrEqual( rowBounds.x );
	await page.mouse.move( rowBounds.x - 2, target.y + target.height / 2 );
	await expect( selection ).toHaveCSS( 'opacity', '1' );
	await selection.check();
	await page.getByRole( 'checkbox', { name: 'Select Instagram', exact: true } ).check();
	await page.getByRole( 'heading', { name: 'Websites', exact: true } ).hover();
	for ( const checkbox of await page.getByRole( 'checkbox' ).all() ) {
		await expect( checkbox ).toHaveCSS( 'opacity', '1' );
	}
	await expect( page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ) ).toBeVisible();
	const after = await identity.boundingBox();
	if ( ! after ) {
		throw new Error( 'The selected identity must remain visible.' );
	}
	expect( after.x ).toBe( before.x );
	expect( after.width ).toBe( before.width );
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	await selection.focus();
	await page.keyboard.press( 'Space' );
	await expect( selection ).not.toBeChecked();
	await page.getByRole( 'checkbox', { name: 'Select Instagram', exact: true } ).uncheck();
	await expect( page.getByRole( 'button', { name: /Remove selected/ } ) ).toHaveCount( 0 );
	await selection.focus();
	await expect( selection ).toHaveCSS( 'opacity', '1' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
	await page.keyboard.press( browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab' );
	await expect( selection ).toBeFocused();
	await expect( selection ).toHaveCSS( 'opacity', '1' );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
} );

test( 'confirms exactly the selected removals and commits them together only on Save', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveSites( page );
	const saved = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	const requests = await page.evaluate( () => window.settingsTest.controls.requests );
	await page.getByRole( 'checkbox', { name: 'Select Chess.com', exact: true } ).focus();
	await page.keyboard.press( 'Space' );
	await page.getByRole( 'checkbox', { name: 'Select Instagram', exact: true } ).check();
	const remove = page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } );
	const confirmation = page.getByRole( 'dialog', { name: 'Remove 2 websites?', exact: true } );
	await remove.click();
	await expect( confirmation.getByText( 'These websites will be removed when you save your changes.',
		{ exact: true } ) ).toBeVisible();
	await expect( confirmation.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeFocused();
	await page.keyboard.press( 'Escape' );
	await expect( confirmation ).toBeHidden();
	await expect( remove ).toBeFocused();
	await expect( page.getByRole( 'checkbox', { name: 'Select Chess.com', exact: true } ) ).toBeChecked();
	await remove.click();
	await confirmation.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
	await remove.click();
	await confirmation.getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 1 );
	await expect( page.getByRole( 'heading', { name: 'Reddit', exact: true } ) ).toBeVisible();
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toBeFocused();
	await expect( page.getByRole( 'button', { name: /Remove selected/ } ) ).toHaveCount( 0 );
	await expect( page.getByText( 'Selected websites removed. Save to apply.', { exact: true } ) ).toBeVisible();
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( saved );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) )
		.toEqual( saved.filter( ( site ) => site.identityHost === 'reddit.com' ) );
} );

test( 'restores all removed rows on Discard without restoring stale checkbox selections', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveSites( page );
	for ( const selection of await page.getByRole( 'checkbox' ).all() ) {
		await selection.focus();
		await page.keyboard.press( 'Space' );
	}
	await page.getByRole( 'button', { name: 'Remove selected (3)', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
	for ( const selection of await page.getByRole( 'checkbox' ).all() ) {
		await expect( selection ).not.toBeChecked();
	}
	await expect( page.getByRole( 'button', { name: /Remove selected/ } ) ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
} );

test( 'retains rejected bulk removals for retry and locks selection during a pending save', async ( { open, setting } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveSites( page );
	await page.getByRole( 'checkbox', { name: 'Select Chess.com', exact: true } ).focus();
	await page.keyboard.press( 'Space' );
	await page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } ).click();
	await page.getByRole( 'dialog', { name: 'Remove 1 website?', exact: true } )
		.getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await setting( page, 'rejectSaves', true );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toBeVisible();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 3 );
	await setting( page, 'rejectSaves', false );
	await page.getByRole( 'checkbox', { name: 'Select Instagram', exact: true } ).focus();
	await page.keyboard.press( 'Space' );
	await setting( page, 'holdConfigurationWrites', true );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } ) ).toBeDisabled();
	for ( const selection of await page.getByRole( 'checkbox' ).all() ) {
		await expect( selection ).toBeDisabled();
	}
	await page.evaluate( () => {
		window.settingsTest.releaseConfigurationWrites();
	} );
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	await expect.poll( () => page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 2 );
} );

test( 'prunes selection when its website is removed through the single-row action', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveSites( page );
	const row = page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name: 'Chess.com' } ) } );
	await row.hover();
	await row.getByRole( 'checkbox' ).check();
	await row.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( row ).toHaveCount( 0 );
	await expect( page.getByRole( 'button', { name: /Remove selected/ } ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( row.getByRole( 'checkbox' ) ).not.toBeChecked();
} );

test( 'exposes exception checkboxes and selects the complete group from its main checkbox', async ( { open }, info ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveExceptionSites( page );
	const requests = await page.evaluate( () => window.settingsTest.controls.requests );
	const main = page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } );
	const path = page.getByRole( 'checkbox', { name: 'Select youtube.com/shorts', exact: true } );
	const subdomain = page.getByRole( 'checkbox', { name: 'Select studio.youtube.com', exact: true } );
	await page.getByRole( 'heading', { name: 'Websites', exact: true } ).hover();
	for ( const checkbox of [ main, path, subdomain ] ) {
		await expect( checkbox ).toHaveCSS( 'opacity', '0' );
	}
	await page.locator( '.settings-site-item' ).filter( { has: page.getByRole( 'heading', { name: 'YouTube', exact: true } ) } ).hover();
	for ( const checkbox of [ main, path, subdomain ] ) {
		await expect( checkbox ).toHaveCSS( 'opacity', '1' );
	}
	await path.focus();
	await page.keyboard.press( 'Space' );
	await expect( path ).toBeChecked();
	await expect( subdomain ).not.toBeChecked();
	await expect( main ).toHaveAttribute( 'aria-checked', 'mixed' );
	await expect( page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } ) ).toBeVisible();
	await info.attach( 'exception-selection-mixed', { body: await page.screenshot(), contentType: 'image/png' } );
	await main.focus();
	await page.keyboard.press( 'Space' );
	for ( const checkbox of [ main, path, subdomain ] ) {
		await expect( checkbox ).toBeChecked();
	}
	await expect( page.getByRole( 'button', { name: 'Remove selected (3)', exact: true } ) ).toBeVisible();
	await subdomain.uncheck();
	await expect( path ).toBeChecked();
	await expect( main ).toHaveAttribute( 'aria-checked', 'mixed' );
	await main.check();
	await main.uncheck();
	for ( const checkbox of [ main, path, subdomain ] ) {
		await expect( checkbox ).not.toBeChecked();
	}
	await expect( page.getByRole( 'button', { name: /Remove selected/ } ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
	await page.getByRole( 'heading', { name: 'Websites', exact: true } ).hover();
	for ( const checkbox of [ main, path, subdomain ] ) {
		await expect( checkbox ).toHaveCSS( 'opacity', '0' );
	}
	await path.focus();
	for ( const checkbox of [ main, path, subdomain ] ) {
		await expect( checkbox ).toHaveCSS( 'opacity', '1' );
	}
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
} );

test( 'removes only a selected exception after confirmation and persists its siblings only on Save', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveExceptionSites( page );
	const saved = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	const requests = await page.evaluate( () => window.settingsTest.controls.requests );
	const selection = page.getByRole( 'checkbox', { name: 'Select youtube.com/shorts', exact: true } );
	await selection.focus();
	await page.keyboard.press( 'Space' );
	const remove = page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } );
	const dialog = page.getByRole( 'dialog', { name: 'Remove 1 website?', exact: true } );
	await remove.click();
	await expect( dialog.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeFocused();
	await page.keyboard.press( 'Escape' );
	await expect( remove ).toBeFocused();
	await expect( selection ).toBeChecked();
	await remove.click();
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
	await remove.click();
	await dialog.getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( selection ).toHaveCount( 0 );
	await expect( page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } ) ).not.toBeChecked();
	await expect( page.getByRole( 'checkbox', { name: 'Select studio.youtube.com', exact: true } ) ).not.toBeChecked();
	await expect( page.getByLabel( 'Website address', { exact: true } ) ).toBeFocused();
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( saved );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) )
		.toEqual( saved.filter( ( site ) => site.rule.pathPrefix === undefined ) );
} );

test( 'selects every path-only group member without treating its presentation header as another rule', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await saveExceptionSites( page, [ 'youtube.com/shorts', 'youtube.com/feed' ] );
	const saved = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	const main = page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } );
	const shorts = page.getByRole( 'checkbox', { name: 'Select youtube.com/shorts', exact: true } );
	const feed = page.getByRole( 'checkbox', { name: 'Select youtube.com/feed', exact: true } );
	await shorts.focus();
	await page.keyboard.press( 'Space' );
	await expect( main ).toHaveAttribute( 'aria-checked', 'mixed' );
	await expect( feed ).not.toBeChecked();
	await expect( page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } ) ).toBeVisible();
	await main.check();
	await expect( feed ).toBeChecked();
	await expect( page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ) ).toBeVisible();
	await page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ).click();
	await page.getByRole( 'dialog', { name: 'Remove 2 websites?', exact: true } )
		.getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( saved );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
	for ( const checkbox of await page.getByRole( 'checkbox' ).all() ) {
		await expect( checkbox ).not.toBeChecked();
		await expect( checkbox ).toHaveAttribute( 'aria-checked', 'false' );
	}
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( saved.map( ( site ) => site.rule.pathPrefix ).sort() ).toEqual( [ '/feed', '/shorts' ] );
} );

test( 'keeps a compact peer root independently selectable within the main group', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.goto( '/apps/extension/src/features/settings/components/shell/__fixtures__/?original=root-peers-broad-first#protected-sites' );
	await page.waitForFunction( () => Object.hasOwn( window, 'settingsTest' ) );
	const main = page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } );
	const peer = page.getByRole( 'checkbox', { name: 'Select YouTube (This domain only)', exact: true } );
	await peer.focus();
	await page.keyboard.press( 'Space' );
	await expect( peer ).toBeChecked();
	await expect( main ).toHaveAttribute( 'aria-checked', 'mixed' );
	await expect( page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } ) ).toBeVisible();
	await main.check();
	await expect( page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ) ).toBeVisible();
	await main.uncheck();
	await expect( peer ).not.toBeChecked();
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
} );

test.describe( 'touch website selection', () => {
	test.use( { hasTouch: true, viewport: { width: 320, height: 844 } } );
	test( 'keeps exception checkboxes visible with separate safe touch targets', async ( { open }, info ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await saveExceptionSites( page );
		for ( const row of await page.locator( '.settings-site-item' ).all() ) {
			const checkbox = row.getByRole( 'checkbox' );
			await expect( checkbox ).toHaveCSS( 'opacity', '1' );
			const target = await checkbox.boundingBox();
			const content = await row.locator( '.settings-site-row' ).boundingBox();
			const rowBounds = await row.boundingBox();
			if ( ! target || ! content || ! rowBounds ) {
				throw new Error( 'Each grouped row requires a separate visible selection target and content.' );
			}
			expect( target.width ).toBeGreaterThanOrEqual( 44 );
			expect( target.height ).toBeGreaterThanOrEqual( 44 );
			expect( target.x ).toBeGreaterThanOrEqual( 0 );
			expect( target.x + target.width ).toBeLessThanOrEqual( content.x );
			expect( target.y ).toBeGreaterThanOrEqual( rowBounds.y );
			expect( target.y + target.height ).toBeLessThanOrEqual( rowBounds.y + rowBounds.height );
			expect( target.y + target.height ).toBeLessThanOrEqual( content.y + Math.max( 44, content.height ) );
		}
		const main = page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } );
		await main.tap();
		await expect( page.getByRole( 'button', { name: 'Remove selected (3)', exact: true } ) ).toBeVisible();
		await page.getByRole( 'checkbox', { name: 'Select studio.youtube.com', exact: true } ).tap();
		await expect( main ).toHaveAttribute( 'aria-checked', 'mixed' );
		await expect( page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ) ).toBeVisible();
		await info.attach( 'exception-selection-narrow', { body: await page.screenshot(), contentType: 'image/png' } );
		await page.evaluate( () => window.settingsTest.revoke() );
		await expect( page.getByRole( 'button', { name: 'Allow access', exact: true } ) ).toHaveCount( 3 );
		for ( const row of await page.locator( '.settings-site-item' ).all() ) {
			const target = await row.getByRole( 'checkbox' ).boundingBox();
			const content = await row.locator( '.settings-site-row' ).boundingBox();
			if ( ! target || ! content ) {
				throw new Error( 'Access recovery must preserve visible address and selection target bounds.' );
			}
			expect( target.y + target.height ).toBeLessThanOrEqual( content.y + Math.max( 44, content.height ) );
		}
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
	} );
	test( 'keeps every checkbox visible in a safe gutter with full touch targets', async ( { open } ) => {
		const page = await open( SettingsDestination.PROTECTED_SITES );
		await saveSites( page );
		for ( const row of await page.locator( '.settings-site-item' ).all() ) {
			const checkbox = row.getByRole( 'checkbox' );
			await expect( checkbox ).toHaveCSS( 'opacity', '1' );
			const target = await checkbox.boundingBox();
			const avatar = await row.locator( '.tocus-native-avatar' ).boundingBox();
			if ( ! target || ! avatar ) {
				throw new Error( 'The touch target and favicon must have visible layout boxes.' );
			}
			expect( target.width ).toBeGreaterThanOrEqual( 44 );
			expect( target.height ).toBeGreaterThanOrEqual( 44 );
			expect( target.x ).toBeGreaterThanOrEqual( 0 );
			expect( target.x + target.width ).toBeLessThanOrEqual( avatar.x );
		}
		await page.getByRole( 'checkbox', { name: 'Select Chess.com', exact: true } ).tap();
		await page.getByRole( 'checkbox', { name: 'Select Instagram', exact: true } ).tap();
		await page.getByRole( 'button', { name: 'Remove selected (2)', exact: true } ).tap();
		const dialog = page.getByRole( 'dialog', { name: 'Remove 2 websites?', exact: true } );
		await expect( dialog ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).tap();
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
	} );
} );
