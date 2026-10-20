import { expect } from '@playwright/test';
import { test } from '../../../settings/utils/browser-test-harness';

for ( const order of [ 'exact-first', 'broad-first' ] ) {
	test( `keeps both root policies as independent main editors with ${ order } storage`, async ( { open } ) => {
		const page = await open();
		await page.goto( `/apps/extension/src/features/settings/components/shell/__fixtures__/?original=root-peers-${ order }#websites` );
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 2 );
		await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 0 );
		await expect( page.getByText( 'Exceptions', { exact: true } ) ).toHaveCount( 0 );
		await expect( page.locator( '.settings-site-item .tocus-native-avatar' ) ).toHaveCount( 1 );
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveCount( 1 );
		const broad = page.locator( '[data-root-coverage="broad"]' );
		const exact = page.locator( '[data-root-coverage="exact"]' );
		await expect( page.locator( '.settings-site-item' ).first() ).toHaveAttribute( 'data-root-coverage', 'broad' );
		for ( const [ row, initial, name ] of [ [ broad, '15', 'All videos' ], [ exact, '10', 'Root videos' ] ] as const ) {
			await row.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
			const dialog = page.getByRole( 'dialog' );
			await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
			await expect( dialog.getByLabel( 'When visited', { exact: true } ) ).toHaveCount( 0 );
			await dialog.getByLabel( 'Name', { exact: true } ).fill( name );
			const schedule = dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } );
			if ( ! await schedule.isChecked() ) {
				await schedule.click();
			}
			await dialog.getByRole( 'button', { name: 'Mon - Fri, all day', exact: true } ).click();
			await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveCount( 5 );
			const timing = dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } );
			if ( ! await timing.isChecked() ) {
				await timing.click();
			}
			await expect( dialog.getByRole( 'slider' ) ).toHaveCount( 4 );
			await expect( dialog.getByRole( 'radio' ) ).toHaveCount( 2 );
			await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', initial );
			await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
			await page.keyboard.press( 'ArrowRight' );
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
			await expect( row ).toContainText( name );
			await expect( page.locator( '.settings-site-item' ).first() ).toHaveAttribute( 'data-root-coverage', 'broad' );
			await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 0 );
		}
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const roots = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
		expect( roots.map( ( site ) => site.rule.includeSubdomains ).sort() ).toEqual( [ false, true ] );
		expect( roots.find( ( site ) =>
			site.rule.includeSubdomains )?.timingConfiguration?.initialWaitMilliseconds ).toBe( 20000 );
		expect( roots.find( ( site ) =>
			! site.rule.includeSubdomains )?.timingConfiguration?.initialWaitMilliseconds ).toBe( 15000 );
		await exact.getByRole( 'checkbox' ).focus();
		await page.keyboard.press( 'Space' );
		await expect( page.getByRole( 'button', { name: 'Remove selected (1)', exact: true } ) ).toBeVisible();
		await page.keyboard.press( 'Space' );
		for ( const address of [ 'youtube.com/shorts', 'studio.youtube.com' ] ) {
			await page.getByLabel( 'Website address', { exact: true } ).fill( address );
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		}
		await expect( page.locator( '.settings-site-root-peer' ) ).toHaveCount( 1 );
		await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 2 );
		await expect( page.getByText( 'Exceptions', { exact: true } ) ).toHaveCount( 1 );
		for ( const child of await page.locator( '.settings-site-exception' ).all() ) {
			await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
			const dialog = page.getByRole( 'dialog' );
			await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toHaveCount( 0 );
			await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
			await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '20' );
			await page.keyboard.press( 'Escape' );
		}
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
		await exact.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
		await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 2 );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await broad.getByRole( 'checkbox' ).focus();
		await page.keyboard.press( 'Space' );
		await expect( page.getByRole( 'button', { name: 'Remove selected (4)', exact: true } ) ).toBeVisible();
		await page.locator( '.settings-site-exception' ).first().getByRole( 'button', { name: 'Remove site', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 3 );
		await expect( page.getByRole( 'button', { name: 'Remove selected (3)', exact: true } ) ).toBeVisible();
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await broad.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
		await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	} );
}
