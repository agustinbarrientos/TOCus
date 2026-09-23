import { expect } from '@playwright/test';
import { test } from '../../utils/browser-test-harness';

test.describe( 'Shared form feedback layout', () => {
	test( 'separates inline error feedback from copy and actions', async ( { open, setting } ) => {
		const page = await open();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		const notice = page.locator( '.mantine-Alert-root' );
		await expect( notice ).toBeVisible();
		await expect( notice ).toHaveAttribute( 'role', 'alert' );
		const geometry = await notice.evaluate( ( element ) => {
			const style = getComputedStyle( element );
			const bounds = element.getBoundingClientRect();
			const previous = element.previousElementSibling?.getBoundingClientRect();
			const action = element.nextElementSibling?.querySelector( 'button' )?.getBoundingClientRect();
			const label = document.querySelector( '.tocus-field-label' );
			const message = element.querySelector( '.mantine-Alert-message' );
			return {
				before: bounds.top - ( previous?.bottom ?? bounds.top ),
				after: ( action?.top ?? bounds.bottom ) - bounds.bottom,
				font: message ? getComputedStyle( message ).fontSize : '',
				labelFont: label ? getComputedStyle( label ).fontSize : '',
				borders: [ style.borderTopWidth, style.borderRightWidth,
					style.borderBottomWidth, style.borderLeftWidth ],
				radius: parseFloat( style.borderTopLeftRadius ),
				padding: [ style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft ],
			};
		} );
		expect( geometry.before ).toBeCloseTo( 24, 1 );
		expect( geometry.after ).toBeCloseTo( 24, 1 );
		expect( geometry.font ).toBe( geometry.labelFont );
		expect( parseFloat( geometry.font ) ).toBeGreaterThanOrEqual( 16 );
		expect( new Set( geometry.borders ).size ).toBe( 1 );
		expect( geometry.radius ).toBe( 12 );
		expect( geometry.padding ).toEqual( [ '16px', '16px', '16px', '16px' ] );
	} );

	test( 'uses one spacing interval for errors inside a dialog stack', async ( { open, setting } ) => {
		const page = await open();
		await page.getByRole( 'slider' ).first().focus();
		await page.keyboard.press( 'End' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		const notice = dialog.getByRole( 'alert' );
		await expect( notice ).toBeVisible();
		// Bounding boxes include the dialog's entrance scale until its transition finishes.
		await expect( dialog ).toHaveCSS( 'transform', 'matrix(1, 0, 0, 1, 0, 0)' );
		const gaps = await notice.evaluate( ( element ) => {
			const bounds = element.getBoundingClientRect();
			const previous = element.previousElementSibling?.getBoundingClientRect();
			const next = element.nextElementSibling?.getBoundingClientRect();
			return [ bounds.top - ( previous?.bottom ?? bounds.top ), ( next?.top ?? bounds.bottom ) - bounds.bottom ];
		} );
		expect( gaps[ 0 ] ).toBeCloseTo( 24, 1 );
		expect( gaps[ 1 ] ).toBeCloseTo( 24, 1 );
	} );
} );
