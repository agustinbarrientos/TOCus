import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { hasFocusedTextCaret } from './index';

describe.each( [
	[ 'Chromium', chromium ],
	[ 'Firefox', firefox ],
	[ 'WebKit', webkit ],
] as const )( '%s screenshot caret semantics', ( _name, engine ) => {
	let browser: Browser;
	let page: Page;

	beforeAll( async () => {
		browser = await engine.launch();
	} );
	beforeEach( async () => {
		page = await browser.newPage();
	} );
	afterEach( async () => {
		await page.close();
	} );
	afterAll( async () => {
		await browser.close();
	} );

	it( 'does not hide carets when only an unfocused text field exists', async () => {
		await page.setContent( '<input value="Unfocused" style="caret-color: red">' );
		expect( await page.evaluate( () => document.activeElement === document.body ) ).toBe( true );
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
		expect( await page.locator( 'input' ).getAttribute( 'style' ) ).toBe( 'caret-color: red' );
	} );

	it.each( [ 'text', 'search', 'email', 'url', 'tel', 'password', 'number' ] )(
		'detects a focused writable %s input', async ( type ) => {
			await page.setContent( `<input type="${ type }">` );
			await page.locator( 'input' ).focus();
			expect( await page.locator( 'input' ).evaluate( ( input ) => input === document.activeElement ) ).toBe( true );
			expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		},
	);

	it( 'detects a focused textarea and stops after focus moves to a button', async () => {
		await page.setContent( '<textarea>Editable</textarea><button>Done</button>' );
		await page.locator( 'textarea' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		await page.getByRole( 'button' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
	} );

	it.each( [ 'radio', 'range', 'checkbox', 'button', 'submit', 'reset' ] )(
		'does not treat a focused %s input as a text caret', async ( type ) => {
			await page.setContent( `<input type="${ type }">` );
			await page.locator( 'input' ).focus();
			expect( await page.locator( 'input' ).evaluate( ( input ) => input === document.activeElement ) ).toBe( true );
			expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
		},
	);

	it.each( [ 'input', 'textarea' ] )( 'excludes a focused readonly %s', async ( tag ) => {
		await page.setContent( `<${ tag } readonly></${ tag }>` );
		await page.locator( tag ).focus();
		expect( await page.locator( tag ).evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
	} );

	it( 'detects inherited contenteditable focus but excludes its noneditable island', async () => {
		await page.setContent( '<div contenteditable="true"><span id="editable" tabindex="0">Edit</span>'
			+ '<span id="readonly" contenteditable="false" tabindex="0">Read</span></div>' );
		await page.locator( '#editable' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		await page.locator( '#readonly' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
	} );

	it( 'follows nested open shadow focus without modifying DOM or selection', async () => {
		await page.setContent( '<div id="outer"></div>' );
		await page.evaluate( () => {
			const outer = document.getElementById( 'outer' );
			if ( ! outer ) {
				throw new Error( 'The focus fixture requires its outer host.' );
			}
			const inner = document.createElement( 'div' );
			outer.attachShadow( { mode: 'open' } ).append( inner );
			const input = document.createElement( 'input' );
			input.value = 'Selected text';
			inner.attachShadow( { mode: 'open' } ).append( input );
			input.focus();
			input.setSelectionRange( 2, 5 );
		} );
		expect( await page.evaluate( () => document.activeElement?.id ) ).toBe( 'outer' );
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		const input = page.locator( 'input' );
		expect( await input.evaluate( ( element ) => {
			if ( ! ( element instanceof HTMLInputElement ) ) {
				throw new Error( 'The nested focus fixture requires a native input.' );
			}
			return [ element.selectionStart, element.selectionEnd ];
		} ) )
			.toEqual( [ 2, 5 ] );
		expect( await input.getAttribute( 'style' ) ).toBeNull();
		await input.evaluate( ( element ) => {
			if ( ! ( element instanceof HTMLInputElement ) ) {
				throw new Error( 'The nested focus fixture requires a native input.' );
			}
			element.readOnly = true;
		} );
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
	} );
} );
