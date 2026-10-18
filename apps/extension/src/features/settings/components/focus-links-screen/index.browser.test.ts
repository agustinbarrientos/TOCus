import { expect } from '@playwright/test';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';
import axe from 'axe-core';

test.describe( 'Focus links settings', () => {
	test( 'keeps add and edit drafts inside dialogs until Done without saving preferences', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		await add.click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await expect( dialog ).toBeVisible();
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Abandoned' );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect( add ).toBeFocused();
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		await add.click();
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await dialog.getByLabel( 'Web address', { exact: true } ).fill( 'http://example.com/read?chapter=2#today' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Read' );
		await expect( page.locator( '.settings-site-identity p' ) ).toHaveText( 'example.com/read?chapter=2#today' );
		const edit = page.getByRole( 'button', { name: 'Edit link', exact: true } );
		await expect( edit ).toBeFocused();
		await edit.click();
		const editor = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		await expect( editor.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( 'http://example.com/read?chapter=2#today' );
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Discarded edit' );
		await page.keyboard.press( 'Escape' );
		await expect( editor ).toBeHidden();
		await expect( edit ).toBeFocused();
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Read' );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		expect( await page.evaluate( () => window.settingsTest.getPreferences().focusLinks[ 0 ]?.url ) ).toBe( 'http://example.com/read?chapter=2#today' );
	} );

	test( 'focuses a new dialog after saving and reopening Add site with the keyboard', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		await add.click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await dialog.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/read' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		await expect( page.getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await add.focus();
		await page.keyboard.press( 'Enter' );
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toHaveValue( '' );
	} );

	for ( const change of [ 'updated', 'removed' ] ) {
		test( `blocks a tentative edit when its shortcut was ${ change } elsewhere`, async ( { open } ) => {
			const page = await open( SettingsDestination.ABOUT );
			await page.evaluate( () => {
				window.settingsTest.externalPreferences( { focusLinks: [
					{ id: 'focus_link_read', label: 'Read', url: 'https://example.com/read' },
				] } );
			} );
			await page.getByRole( 'link', { name: 'Quick links', exact: true } ).click();
			await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
			const dialog = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
			await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Tentative edit' );
			await page.evaluate( ( change ) => {
				window.settingsTest.externalPreferences( { focusLinks: [ {
					id: change === 'updated' ? 'focus_link_read' : 'focus_link_external',
					label: 'Updated elsewhere', url: 'https://example.net/latest',
				} ] } );
			}, change );
			await expect( dialog ).toBeVisible();
			await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Tentative edit' );
			await expect( dialog.getByRole( 'alert' ) ).toHaveText( 'This site changed elsewhere. Reload settings and try again.' );
			await expect( dialog.getByRole( 'button', { name: 'Done', exact: true } ) ).toBeDisabled();
			await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
			await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Updated elsewhere' );
			await expect( page.locator( '.settings-site-identity p' ) ).toHaveText( 'example.net/latest' );
			await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		} );
	}

	test( 'blocks an open Add site dialog when external shortcuts reach the limit', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Tentative addition' );
		await dialog.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/new' );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [
				{ id: 'focus_link_write', label: 'Write', url: 'https://example.com/write' },
				{ id: 'focus_link_read', label: 'Read', url: 'https://example.com/read' },
				{ id: 'focus_link_plan', label: 'Plan', url: 'https://example.com/plan' },
			] } );
		} );
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Tentative addition' );
		await expect( dialog.getByRole( 'alert' ) ).toHaveText( 'This site changed elsewhere. Reload settings and try again.' );
		await expect( dialog.getByRole( 'button', { name: 'Done', exact: true } ) ).toBeDisabled();
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( [ 'Write', 'Read', 'Plan' ] );
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

	test( 'left-aligns the add action and keeps validation feedback clear at narrow widths', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		const panel = page.locator( '.settings-sites-empty' );
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		for ( const width of [ 1280, 320 ] ) {
			await page.setViewportSize( { width, height: 1000 } );
			await expect( panel.getByRole( 'heading', { name: 'No websites yet', exact: true } ) ).toBeVisible();
			const panelBox = await panel.boundingBox();
			const addBox = await add.boundingBox();
			if ( ! panelBox || ! addBox ) {
				throw new Error( 'Expected the empty state and its add action to be visible.' );
			}
			expect( Math.abs( addBox.x - panelBox.x ) ).toBeLessThanOrEqual( 1 );
			expect( addBox.y - panelBox.y - panelBox.height ).toBeGreaterThanOrEqual( 20 );
			const descriptionColor = await panel.locator( 'p' ).evaluate( ( paragraph ) =>
				getComputedStyle( paragraph ).color );
			await add.click();
			const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
			const label = dialog.getByLabel( 'Label', { exact: true } );
			const url = dialog.getByLabel( 'Web address', { exact: true } );
			await expect( label ).toBeFocused();
			await expect( label ).toHaveAttribute( 'aria-invalid', 'true' );
			await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
			const errors = dialog.locator( '.settings-site-editor .mantine-InputWrapper-error' );
			await expect( errors ).toHaveCount( 2 );
			for ( const error of await errors.all() ) {
				const errorColor = await error.evaluate( ( paragraph ) => getComputedStyle( paragraph ).color );
				expect( errorColor ).not.toBe( descriptionColor );
			}
			const fieldGap = await label.evaluate( ( input ) => {
				const fields = input.closest( '.mantine-InputWrapper-root' )?.parentElement;
				if ( ! fields ) {
					throw new Error( 'Expected both fields in their shared spacing container.' );
				}
				return getComputedStyle( fields ).rowGap;
			} );
			expect( fieldGap ).toBe( '16px' );
			await expect.poll( async () => {
				const firstError = await errors.first().boundingBox();
				const urlLabel = await dialog.locator( 'label' ).filter( { hasText: /^Web address$/u } ).boundingBox();
				if ( ! firstError || ! urlLabel ) {
					throw new Error( 'Expected inline validation and the next field label to be visible.' );
				}
				// Remove only floating-point residue below 0.0001px; the CSS field gap remains exactly 16px.
				return Math.round( ( urlLabel.y - firstError.y - firstError.height ) * 10_000 ) / 10_000;
			} ).toBeGreaterThanOrEqual( 16 );
			expect( await page.evaluate( () => document.documentElement.scrollWidth ) ).toBe( width );
			await page.screenshot( { path: test.info().outputPath( `focus-links-empty-validation-${ String( width ) }.png` ), fullPage: true } );
			await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		}
	} );


	test( 'presents saved shortcuts as compact website rows without requesting favicons or access', async ( { open } ) => {
		const page = await open( SettingsDestination.ABOUT );
		await page.evaluate( () => {
			document.documentElement.dataset.focusFaviconRequests = '0';
			window.settingsTest.setFaviconProvider( {
				/**
				 * Detects accidental favicon-provider access without requesting an icon.
				 * @return Local fallback without starting any favicon lookup.
				 */
				getSource: () => {
					document.documentElement.dataset.focusFaviconRequests = String(
						Number( document.documentElement.dataset.focusFaviconRequests ) + 1 );
					return null;
				} } );
			window.settingsTest.externalPreferences( { focusLinks: [
				{ id: 'focus_link_write', label: 'Write', url: 'https://example.com/write' },
				{ id: 'focus_link_read', label: 'Read', url: 'https://example.com/read' },
			] } );
		} );
		await page.getByRole( 'link', { name: 'Quick links', exact: true } ).click();
		const rows = page.locator( '.settings-site-list > .settings-site-item' );
		await expect( rows ).toHaveCount( 2 );
		await expect( rows.first().locator( '.settings-site-identity h2' ) ).toHaveText( 'Write' );
		await expect( rows.first().locator( '.settings-site-identity p' ) ).toHaveText( 'example.com/write' );
		await expect( rows.nth( 1 ).locator( '.settings-site-identity h2' ) ).toHaveText( 'Read' );
		await expect( rows.locator( 'input, img' ) ).toHaveCount( 0 );
		await rows.first().getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await page.evaluate( ( theme ) => {
			window.settingsTest.externalPreferences( { theme } );
		}, ThemeMode.DARK );
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
		await expect( rows.first().locator( '.settings-site-identity h2' ) ).toHaveText( 'Write' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect( rows.first().locator( 'input' ) ).toHaveCount( 0 );
		await expect( rows.first().getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await expect( rows.first().locator( '.settings-site-identity h2' ) ).toHaveText( 'Draft' );
		await rows.first().getByRole( 'button', { name: 'Move down', exact: true } ).focus();
		await page.keyboard.press( 'Space' );
		await expect( rows.nth( 1 ).locator( '.settings-site-identity h2' ) ).toHaveText( 'Draft' );
		await expect( rows.nth( 1 ).getByRole( 'button', {
			name: 'Edit link', exact: true,
		} ) ).toBeFocused();
		await rows.nth( 1 ).getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( rows ).toHaveCount( 1 );
		await expect( rows.first().getByRole( 'button', {
			name: 'Edit link', exact: true,
		} ) ).toBeFocused();
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-focus-favicon-requests', '0' );
		expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

	test( 'keeps an invalid edit local and restores the saved shortcut on cancel', async ( { open } ) => {
		const page = await open( SettingsDestination.ABOUT );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [
				{ id: 'focus_link_read', label: 'Read', url: 'https://example.com/read' },
			] } );
		} );
		await page.getByRole( 'link', { name: 'Quick links', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		const url = dialog.getByLabel( 'Web address', { exact: true } );
		await url.fill( 'javascript:alert(1)' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( url ).toBeFocused();
		await expect( url ).toHaveValue( 'javascript:alert(1)' );
		await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
		await expect( page.locator( '.settings-site-identity p' ) ).toHaveText( 'example.com/read' );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect( page.getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( dialog.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( 'https://example.com/read' );
		await page.keyboard.press( 'Escape' );
		await expect( page.getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

	test( 'offers another site only while fewer than three draft shortcuts exist', async ( { open } ) => {
		const page = await open( SettingsDestination.ABOUT );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [
				{ id: 'focus_link_write', label: 'Write', url: 'https://example.com/write' },
				{ id: 'focus_link_read', label: 'Read', url: 'https://example.com/read' },
				{ id: 'focus_link_plan', label: 'Plan', url: 'https://example.com/plan' },
			] } );
		} );
		await page.getByRole( 'link', { name: 'Quick links', exact: true } ).click();
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		await expect( add ).toHaveCount( 0 );
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 )
			.getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( add ).toBeVisible();
		await expect( add ).toBeEnabled();
		await add.click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Replacement' );
		await dialog.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/replacement' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ) ).toHaveCount( 3 );
		await expect( add ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

	test( 'adds, edits, reorders and removes up to three persistent links', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await expect( page.getByRole( 'heading', { name: 'Quick links', exact: true } ) ).toBeVisible();
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		for ( const label of [ 'Write', 'Read', 'Plan' ] ) {
			await add.click();
			const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
			await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
			await dialog.getByLabel( 'Label', { exact: true } ).fill( label );
			await dialog.getByLabel( 'Web address', { exact: true } ).fill( ` https://example.com/${ label.toLowerCase() } ` );
			await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		}
		await expect( add ).toHaveCount( 0 );
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 ).getByRole( 'button', { name: 'Move up', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).locator( '.settings-site-identity h2' ) ).toHaveText( 'Plan' );
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 0 ).getByRole( 'button', { name: 'Move down', exact: true } ).click();
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 ).getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await expect( add ).toBeVisible();
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		const editor = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const links = await page.evaluate( () => window.settingsTest.getPreferences().focusLinks );
		expect( links.map( ( link ) => [ link.label, link.url ] ) ).toEqual( [ [ 'Plan', 'https://example.com/plan' ], [ 'Draft', 'https://example.com/write' ] ] );
		expect( new Set( links.map( ( link ) => link.id ) ).size ).toBe( 2 );
		await expect( page.locator( '.settings-site-list input' ) ).toHaveCount( 0 );
		await expect( page.locator( '.settings-site-item' ).first().getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'link', { name: 'Quick links', exact: true } ).click();
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( page.getByRole( 'dialog', { name: 'Edit link', exact: true } ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
	} );

	test( 'retains invalid drafts and focuses the invalid field without writing', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		const label = dialog.getByLabel( 'Label', { exact: true } );
		const url = dialog.getByLabel( 'Web address', { exact: true } );
		await url.fill( 'javascript:alert(1)' );
		await expect( label ).not.toHaveAttribute( 'aria-invalid', 'true' );
		await expect( url ).not.toHaveAttribute( 'aria-invalid', 'true' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( label ).toHaveAttribute( 'aria-invalid', 'true' );
		await expect( label ).toBeFocused();
		await label.fill( 'Read' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( url ).toBeFocused();
		await expect( url ).toHaveValue( 'javascript:alert(1)' );
		await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await url.fill( 'https://user:secret@example.com/' );
		await label.focus();
		await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
	} );

	test( 'guards applied shortcut drafts during navigation and discards explicitly', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const editor = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await editor.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/read' );
		await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await expect( editor ).toBeHidden();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Save your changes?', exact: true } );
		await expect( dialog.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeVisible();
		await expect( page ).toHaveURL( /#focus-links$/u );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await dialog.getByRole( 'button', { name: 'Stay', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Read' );
		await page.getByRole( 'form', { name: 'Quick link preferences', exact: true } )
			.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeFocused();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await expect( page ).toHaveURL( /#about$/u );
	} );

	test( 'rebases external preferences and saves only the link draft', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const add = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await add.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await add.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await page.evaluate( ( { theme, palette } ) => {
			window.settingsTest.externalPreferences( { theme, palette } );
		}, { theme: ThemeMode.DARK, palette: Palette.GREEN } );
		await expect( add.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Read' );
		await add.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const preferences = await page.evaluate( () => window.settingsTest.getPreferences() );
		expect( preferences ).toMatchObject( { theme: ThemeMode.DARK, palette: Palette.GREEN, focusLinks: [ { label: 'Read', url: 'https://example.com/' } ] } );
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		const editor = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Applied draft' );
		await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [ { id: 'focus_link_external', label: 'Updated elsewhere', url: 'https://example.net/' } ] } );
		} );
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Applied draft' );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( editor.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Updated elsewhere' );
	} );

	test( 'retains rejected saves and locks all edits during a navigation save', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const editor = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await editor.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await editor.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await editor.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await setting( page, 'rejectSaves', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'alert' ) ).toBeVisible();
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Read' );
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		const edit = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
		await expect( edit.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Read' );
		await edit.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await setting( page, 'rejectSaves', false );
		await setting( page, 'holdPreferenceWrites', true );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Edit link', exact: true, includeHidden: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true, includeHidden: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Remove link', exact: true, includeHidden: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Move up', exact: true, includeHidden: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Move down', exact: true, includeHidden: true } ) ).toBeDisabled();
		await page.evaluate( () => {
			window.settingsTest.releasePreferenceWrites();
		} );
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'adopts external link changes on a clean form after saving', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await dialog.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [ { id: 'focus_link_external', label: 'Updated elsewhere', url: 'https://example.net/' } ] } );
		} );
		await expect( page.locator( '.settings-site-identity h2' ) ).toHaveText( 'Updated elsewhere' );
		await expect( page.locator( '.settings-site-list input' ) ).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Updated elsewhere' );
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( 'https://example.net/' );
		await page.getByRole( 'dialog', { name: 'Edit link', exact: true } ).getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'closes tentative editing when preferences become malformed and recovers explicitly', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
		await dialog.getByLabel( 'Label', { exact: true } ).fill( 'Abandoned candidate' );
		await page.evaluate( () => {
			window.settingsTest.malformPreferences();
		} );
		await expect( dialog ).toBeHidden();
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Restore personalization defaults', exact: true } ).click();
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		await expect( dialog ).toBeHidden();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toHaveValue( '' );
		await expect( dialog.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( '' );
	} );

	test( 'keeps duplicate URLs and keyboard operations available in a narrow accessible form', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.setViewportSize( { width: 320, height: 900 } );
		for ( const label of [ 'Read', 'Write' ] ) {
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
			await page.keyboard.press( 'Enter' );
			const dialog = page.getByRole( 'dialog', { name: 'Add site', exact: true } );
			await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
			await page.keyboard.type( label );
			await page.keyboard.press( 'Tab' );
			await expect( dialog.getByLabel( 'Web address', { exact: true } ) ).toBeFocused();
			await page.keyboard.type( 'https://example.com/' );
			await page.keyboard.press( 'Enter' );
			await expect( dialog ).toBeHidden();
		}
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Move up', exact: true } ).focus();
		await page.keyboard.press( 'Space' );
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 0 ).locator( '.settings-site-identity h2' ) ).toHaveText( 'Write' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const notice = page.getByRole( 'status' ).filter( { hasText: 'Changes saved.' } );
		await expect( notice ).toBeVisible();
		await expect( notice ).toHaveCSS( 'opacity', '1' );
		// Dismiss confirmed feedback before long scans can sample its timed exit animation.
		await notice.getByRole( 'button', { name: 'Dismiss notification', exact: true } ).click();
		await expect( page.locator( '.tocus-snackbar' ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.getPreferences().focusLinks.map( ( link ) => link.url ) ) ).toEqual( [ 'https://example.com/', 'https://example.com/' ] );
		await page.addScriptTag( { content: axe.source } );
		for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
			await page.evaluate( ( theme ) => {
				window.settingsTest.externalPreferences( { theme } );
			}, theme );
			await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-tocus-theme', theme );
			for ( const width of [ 320, 1280 ] ) {
				await page.setViewportSize( { width, height: 900 } );
				const violations = await page.evaluate( async () => ( await window.axe.run( document, {
					runOnly: { type: 'tag', values: [ 'wcag2a', 'wcag2aa', 'wcag21aa' ] },
				} ) ).violations );
				expect( violations ).toEqual( [] );
				expect( await page.evaluate( () => document.documentElement.scrollWidth ) ).toBe( width );
				await page.evaluate( () => {
					window.scrollTo( 0, 0 );
				} );
				await page.screenshot( { path: test.info().outputPath( `focus-links-settings-${ theme }-${ String( width ) }.png` ), fullPage: true } );
				await page.locator( '.settings-site-list > .settings-site-item' ).first().getByRole( 'button', { name: 'Edit link', exact: true } ).click();
				const dialog = page.getByRole( 'dialog', { name: 'Edit link', exact: true } );
				await expect( dialog.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
				await page.mouse.move( 0, 0 );
				await expect( dialog ).toHaveCSS( 'opacity', '1' );
				await expect( page.locator( '.mantine-Modal-overlay' ) ).toHaveCSS( 'opacity', '1' );
				await expect( page.getByRole( 'tooltip' ) ).toHaveCount( 0 );
				const dialogViolations = await page.evaluate( async () => ( await window.axe.run( document, {
					runOnly: { type: 'tag', values: [ 'wcag2a', 'wcag2aa', 'wcag21aa' ] },
				} ) ).violations );
				expect( dialogViolations ).toEqual( [] );
				expect( await page.evaluate( () => document.documentElement.scrollWidth ) ).toBe( width );
				await page.screenshot( { path: test.info().outputPath( `focus-link-editor-${ theme }-${ String( width ) }.png` ), fullPage: true } );
				await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
				await expect( page.locator( '.mantine-Modal-content' ) ).toHaveCount( 0 );
			}
		}
	} );
} );
