import { test, expect } from '@playwright/test';
import { hasFocusedTextCaret } from './index';

test.describe( 'screenshot caret semantics', () => {
	test( 'does not hide carets when only an unfocused text field exists', async ( { page } ) => {
		await page.setContent( '<input value="Unfocused" style="caret-color: red">' );
		expect( await page.evaluate( () => document.activeElement === document.body ) ).toBe( true );
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
		expect( await page.locator( 'input' ).getAttribute( 'style' ) ).toBe( 'caret-color: red' );
	} );

	for ( const type of [ 'text', 'search', 'email', 'url', 'tel', 'password', 'number' ] ) {
		test( `detects a focused writable ${ type } input`, async ( { page } ) => {
			await page.setContent( `<input type="${ type }">` );
			await page.locator( 'input' ).focus();
			expect( await page.locator( 'input' ).evaluate( ( input ) => input === document.activeElement ) ).toBe( true );
			expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		} );
	}

	test( 'detects a focused textarea and stops after focus moves to a button', async ( { page } ) => {
		await page.setContent( '<textarea>Editable</textarea><button>Done</button>' );
		await page.locator( 'textarea' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		await page.getByRole( 'button' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
	} );

	for ( const type of [ 'radio', 'range', 'checkbox', 'button', 'submit', 'reset' ] ) {
		test( `does not treat a focused ${ type } input as a text caret`, async ( { page } ) => {
			await page.setContent( `<input type="${ type }">` );
			await page.locator( 'input' ).focus();
			expect( await page.locator( 'input' ).evaluate( ( input ) => input === document.activeElement ) ).toBe( true );
			expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
		} );
	}

	for ( const tag of [ 'input', 'textarea' ] ) {
		test( `excludes a focused readonly ${ tag }`, async ( { page } ) => {
			await page.setContent( `<${ tag } readonly></${ tag }>` );
			await page.locator( tag ).focus();
			expect( await page.locator( tag ).evaluate( ( element ) =>
				element === document.activeElement ) ).toBe( true );
			expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
		} );
	}

	test( 'detects inherited contenteditable focus but excludes its noneditable island', async ( { page } ) => {
		await page.setContent( '<div contenteditable="true"><span id="editable" tabindex="0">Edit</span>'
			+ '<span id="readonly" contenteditable="false" tabindex="0">Read</span></div>' );
		await page.locator( '#editable' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( true );
		await page.locator( '#readonly' ).focus();
		expect( await page.evaluate( hasFocusedTextCaret ) ).toBe( false );
	} );

	test( 'follows nested open shadow focus without modifying DOM or selection', async ( { page } ) => {
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
