import { expect } from '@playwright/test';
import { test } from '../../utils/browser-test-harness';

test( 'uses one aligned dialog inset, a prominent heading and three clear decisions', async ( { open }, info ) => {
	const page = await open();
	await page.getByRole( 'slider' ).first().press( 'End' );
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	const dialog = page.getByRole( 'dialog' );
	await expect( dialog.getByRole( 'button' ) ).toHaveText( [ 'Stay', 'Discard', 'Save' ] );
	const geometry = await dialog.evaluate( ( content ) => {
		const title = content.querySelector( '.mantine-Modal-title' );
		const paragraph = content.querySelector( '.mantine-Modal-body p' );
		const actions = content.querySelector( '.tocus-form-actions' );
		if ( ! title || ! paragraph || ! actions ) {
			throw new Error( 'The confirmation must retain its shared title, explanation and action row.' );
		}
		const bounds = content.getBoundingClientRect();
		const titleBounds = title.getBoundingClientRect();
		const paragraphBounds = paragraph.getBoundingClientRect();
		const actionBounds = actions.getBoundingClientRect();
		const titleStyle = getComputedStyle( title );
		const paragraphStyle = getComputedStyle( paragraph );
		return {
			topInset: titleBounds.top - bounds.top,
			bottomInset: bounds.bottom - actionBounds.bottom,
			titleLeft: titleBounds.left,
			textLeft: paragraphBounds.left,
			actionsLeft: actionBounds.left,
			titleSize: Number.parseFloat( titleStyle.fontSize ),
			textSize: Number.parseFloat( paragraphStyle.fontSize ),
			titleWeight: Number.parseInt( titleStyle.fontWeight, 10 ),
			paragraphPadding: paragraphStyle.padding,
		};
	} );
	expect( geometry.topInset ).toBeGreaterThanOrEqual( 24 );
	expect( Math.abs( geometry.topInset - geometry.bottomInset ) ).toBeLessThanOrEqual( 1 );
	expect( geometry.titleLeft ).toBeCloseTo( geometry.textLeft, 0 );
	expect( geometry.actionsLeft ).toBeCloseTo( geometry.textLeft, 0 );
	expect( geometry.titleSize ).toBeGreaterThan( geometry.textSize );
	expect( geometry.titleWeight ).toBeGreaterThanOrEqual( 700 );
	expect( geometry.paragraphPadding ).toBe( '0px' );
	await info.attach( 'unsaved-changes-dialog', { body: await dialog.screenshot(), contentType: 'image/png' } );
} );
