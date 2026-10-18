import { expect } from '@playwright/test';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';
import axe from 'axe-core';

test.describe( 'Focus links settings', () => {
	test( 'adds, edits, reorders and removes up to three persistent links', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await expect( page.getByRole( 'heading', { name: 'Focus links', exact: true } ) ).toBeVisible();
		await expect( page.getByText( 'No focus links yet.', { exact: true } ) ).toBeVisible();
		const add = page.getByRole( 'button', { name: 'Add link', exact: true } );
		for ( const [ index, label ] of [ 'Write', 'Read', 'Plan' ].entries() ) {
			await add.click();
			const group = page.getByRole( 'group', { name: String( index + 1 ), exact: true } );
			await expect( group.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
			await group.getByLabel( 'Label', { exact: true } ).fill( label );
			await group.getByLabel( 'Web address', { exact: true } ).fill( ` https://example.com/${ label.toLowerCase() } ` );
		}
		await expect( add ).toBeDisabled();
		await page.getByRole( 'group', { name: '3', exact: true } ).getByRole( 'button', { name: 'Move up', exact: true } ).click();
		await expect( page.getByRole( 'group', { name: '2', exact: true } ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Plan' );
		await page.getByRole( 'group', { name: '1', exact: true } ).getByRole( 'button', { name: 'Move down', exact: true } ).click();
		await page.getByRole( 'group', { name: '3', exact: true } ).getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( page.getByRole( 'group', { name: '2', exact: true } ).getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await page.getByRole( 'group', { name: '2', exact: true } ).getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const links = await page.evaluate( () => window.settingsTest.getPreferences().focusLinks );
		expect( links.map( ( link ) => [ link.label, link.url ] ) ).toEqual( [ [ 'Plan', 'https://example.com/plan' ], [ 'Draft', 'https://example.com/write' ] ] );
		expect( new Set( links.map( ( link ) => link.id ) ).size ).toBe( 2 );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'link', { name: 'Focus links', exact: true } ).click();
		await expect( page.getByRole( 'group', { name: '2', exact: true } ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
	} );

	test( 'retains invalid drafts and focuses the invalid field without writing', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add link', exact: true } ).click();
		const label = page.getByLabel( 'Label', { exact: true } );
		const url = page.getByLabel( 'Web address', { exact: true } );
		await url.fill( 'javascript:alert(1)' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( label ).toHaveAttribute( 'aria-invalid', 'true' );
		await expect( label ).toBeFocused();
		await label.fill( 'Read' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( url ).toBeFocused();
		await expect( url ).toHaveValue( 'javascript:alert(1)' );
		await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await url.fill( 'https://user:secret@example.com/' );
		await label.focus();
		await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
	} );

	test( 'guards invalid navigation saves and discards explicitly', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add link', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'invalid' );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await dialog.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( dialog.getByRole( 'alert' ) ).toBeVisible();
		await expect( page ).toHaveURL( /#focus-links$/u );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await dialog.getByRole( 'button', { name: 'Stay', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( 'invalid' );
		await page.getByRole( 'form', { name: 'Focus link preferences', exact: true } )
			.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByText( 'No focus links yet.', { exact: true } ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Add link', exact: true } ) ).toBeFocused();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await expect( page ).toHaveURL( /#about$/u );
	} );

	test( 'rebases external preferences and saves only the link draft', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add link', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await page.evaluate( ( { theme, palette } ) => {
			window.settingsTest.externalPreferences( { theme, palette } );
		}, { theme: ThemeMode.DARK, palette: Palette.GREEN } );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const preferences = await page.evaluate( () => window.settingsTest.getPreferences() );
		expect( preferences ).toMatchObject( { theme: ThemeMode.DARK, palette: Palette.GREEN, focusLinks: [ { label: 'Read', url: 'https://example.com/' } ] } );
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [ { id: 'focus_link_external', label: 'Updated elsewhere', url: 'https://example.net/' } ] } );
		} );
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Updated elsewhere' );
	} );

	test( 'retains rejected saves and locks all edits during a navigation save', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add link', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'alert' ) ).toBeVisible();
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Read' );
		await setting( page, 'rejectSaves', false );
		await setting( page, 'holdPreferenceWrites', true );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Add link', exact: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Remove link', exact: true } ) ).toBeDisabled();
		await page.evaluate( () => {
			window.settingsTest.releasePreferenceWrites();
		} );
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'adopts external link changes on a clean form after saving', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add link', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [ { id: 'focus_link_external', label: 'Updated elsewhere', url: 'https://example.net/' } ] } );
		} );
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Updated elsewhere' );
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( 'https://example.net/' );
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'keeps malformed preferences intact until explicit recovery', async ( { open } ) => {
		const page = await open( SettingsDestination.ABOUT );
		await page.evaluate( () => {
			window.settingsTest.malformPreferences();
		} );
		await page.getByRole( 'link', { name: 'Focus links', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Add link', exact: true } ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Restore personalization defaults', exact: true } ).click();
		await expect( page.getByText( 'No focus links yet.', { exact: true } ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'keeps duplicate URLs and keyboard operations available in a narrow accessible form', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.setViewportSize( { width: 320, height: 900 } );
		for ( const label of [ 'Read', 'Write' ] ) {
			await page.getByRole( 'button', { name: 'Add link', exact: true } ).focus();
			await page.keyboard.press( 'Enter' );
			await page.keyboard.type( label );
			await page.keyboard.press( 'Tab' );
			await page.keyboard.type( 'https://example.com/' );
		}
		await page.getByRole( 'group', { name: '2', exact: true } ).getByRole( 'button', { name: 'Move up', exact: true } ).focus();
		await page.keyboard.press( 'Space' );
		await expect( page.getByRole( 'group', { name: '1', exact: true } ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Write' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		await expect.poll( () => page.getByRole( 'status' ).filter( { hasText: 'Changes saved.' } ).evaluate( ( notice ) =>
			getComputedStyle( notice ).opacity ) ).toBe( '1' );
		expect( await page.evaluate( () => window.settingsTest.getPreferences().focusLinks.map( ( link ) => link.url ) ) ).toEqual( [ 'https://example.com/', 'https://example.com/' ] );
		for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
			await page.evaluate( ( theme ) => {
				window.settingsTest.externalPreferences( { theme } );
			}, theme );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			await page.addScriptTag( { content: axe.source } );
			const violations = await page.evaluate( async () => ( await window.axe.run( document, {
				runOnly: { type: 'tag', values: [ 'wcag2a', 'wcag2aa', 'wcag21aa' ] },
			} ) ).violations );
			expect( violations ).toEqual( [] );
			expect( await page.evaluate( () => document.documentElement.scrollWidth ) ).toBe( 320 );
			await page.evaluate( () => {
				window.scrollTo( 0, 0 );
			} );
			await page.screenshot( { path: test.info().outputPath( `focus-links-settings-${ theme }.png` ), fullPage: true } );
		}
	} );
} );
