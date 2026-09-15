import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test( 'edits a website in a focus-contained dialog without changing the page draft on cancellation', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'chess.com' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	const row = page.locator( '.settings-site-item' ).first();
	const manage = row.getByRole( 'button', { name: 'Change schedule or site name', exact: true } );
	await manage.click();
	const dialog = page.getByRole( 'dialog', { name: 'Chess.com', exact: true } );
	const name = dialog.getByLabel( 'Name', { exact: true } );
	await expect( name ).toBeFocused();
	await expect( name ).toHaveAttribute( 'placeholder', 'Chess.com' );
	await expect( row.locator( '.settings-site-editor' ) ).toHaveCount( 0 );
	await name.fill( 'Games' );
	await expect( row.getByRole( 'heading', { name: 'Chess.com', exact: true } ) ).toBeVisible();
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( dialog ).toHaveCount( 0 );
	await expect( manage ).toBeFocused();
	await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
	await manage.click();
	await expect( name ).toHaveValue( '' );
	await name.fill( 'Not saved' );
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toHaveCount( 0 );
	await expect( manage ).toBeFocused();
	await manage.click();
	await expect( name ).toHaveValue( '' );
	await name.fill( 'Games' );
	await name.press( 'Enter' );
	await expect( dialog ).toHaveCount( 0 );
	await expect( row.getByRole( 'heading', { name: 'Games', exact: true } ) ).toBeVisible();
	expect( await page.evaluate( () =>
		window.settingsTest.getConfiguration().sites[ 0 ]?.displayNameOverride ) ).toBeUndefined();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	await manage.click();
	const renamed = page.getByRole( 'dialog', { name: 'Games', exact: true } );
	await renamed.getByLabel( 'Name', { exact: true } ).fill( '' );
	await expect( renamed.getByLabel( 'Name', { exact: true } ) ).toHaveAttribute( 'placeholder', 'Chess.com' );
	await renamed.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( row.getByRole( 'heading', { name: 'Chess.com', exact: true } ) ).toBeVisible();
} );

test( 'aligns the schedule summary and keeps row actions consistently sized and semantic', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'chess.com' );
	await page.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await page.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
	await page.getByLabel( 'End', { exact: true } ).fill( '17:00' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	const row = page.locator( '.settings-site-item' ).first();
	await expect( row.locator( '.settings-site-schedule' ) ).toBeVisible();
	const metrics = await row.evaluate( ( element ) => {
		const schedule = element.querySelector( '.settings-site-schedule' );
		const icon = schedule?.querySelector( 'svg' )?.getBoundingClientRect();
		const text = schedule?.querySelector( 'span:last-child' )?.getBoundingClientRect();
		const remove = element.querySelector( '.settings-site-remove' );
		if ( ! schedule || ! icon || ! text || ! remove ) {
			throw new TypeError( 'The website row must retain its schedule, calendar icon and removal action.' );
		}
		return {
			margin: getComputedStyle( schedule ).marginTop,
			alignment: Math.abs( icon.y + icon.height / 2 - text.y - text.height / 2 ),
			icons: Array.from( element.querySelectorAll( '.settings-site-actions svg' ), ( item ) => ( {
				width: item.getBoundingClientRect().width,
				em: parseFloat( getComputedStyle( item ).fontSize ),
			} ) ),
			color: getComputedStyle( remove ).color,
		};
	} );
	expect( parseFloat( metrics.margin ) ).toBe( 8 );
	expect( metrics.alignment ).toBeLessThanOrEqual( 1 );
	for ( const icon of metrics.icons ) {
		expect( icon.width ).toBeCloseTo( 1.2 * icon.em, 1 );
	}
	const danger = await row.evaluate( ( element ) => {
		const sample = document.createElement( 'span' );
		sample.style.color = 'var(--tocus-color-danger)';
		element.append( sample );
		const result = getComputedStyle( sample ).color;
		sample.remove();
		return result;
	} );
	expect( metrics.color ).toBe( danger );
} );

test( 'contains keyboard focus and keeps custom schedule rows usable in a narrow dialog', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.setViewportSize( { width: 320, height: 844 } );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'chess.com' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Change schedule or site name', exact: true } ).click();
	const dialog = page.getByRole( 'dialog', { name: 'Chess.com', exact: true } );
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Add row', exact: true } ).click();
	await expect( dialog.getByRole( 'table' ).getByRole( 'row' ) ).toHaveCount( 3 );
	for ( let index = 0; index < 2; index++ ) {
		await dialog.getByLabel( 'Start', { exact: true } ).nth( index ).fill( '09:00' );
		await dialog.getByLabel( 'End', { exact: true } ).nth( index ).fill( '17:00' );
	}
	const done = dialog.getByRole( 'button', { name: 'Done', exact: true } );
	await done.focus();
	await page.keyboard.press( 'Tab' );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeFocused();
	await page.keyboard.press( 'Shift+Tab' );
	await expect( done ).toBeFocused();
	const bounds = await dialog.boundingBox();
	expect( bounds ).not.toBeNull();
	expect( bounds?.x ).toBeGreaterThanOrEqual( 0 );
	expect( ( bounds?.x ?? 0 ) + ( bounds?.width ?? 0 ) ).toBeLessThanOrEqual( 320 );
	expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
	await done.press( 'Enter' );
	await expect( dialog ).toHaveCount( 0 );
	await expect( page.locator( '.settings-site-schedule' ) ).toContainText( '09:00' );
	expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
} );
