import { expect } from '@playwright/test';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';
import axe from 'axe-core';

test.describe( 'Focus links settings', () => {
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
		}
		await add.click();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		const label = page.getByLabel( 'Label', { exact: true } );
		const url = page.getByLabel( 'Web address', { exact: true } );
		await expect( label ).toBeFocused();
		await expect( label ).toHaveAttribute( 'aria-invalid', 'true' );
		await expect( url ).toHaveAttribute( 'aria-invalid', 'true' );
		const errors = page.locator( '.settings-focus-link .mantine-InputWrapper-error' );
		await expect( errors ).toHaveCount( 2 );
		const descriptionColor = await page.locator( '.settings-focus-links > p' ).evaluate( ( paragraph ) =>
			getComputedStyle( paragraph ).color );
		for ( const error of await errors.all() ) {
			const errorColor = await error.evaluate( ( paragraph ) => getComputedStyle( paragraph ).color );
			expect( errorColor ).not.toBe( descriptionColor );
		}
		const firstError = await errors.first().boundingBox();
		const urlLabel = await page.locator( 'label' ).filter( { hasText: /^Web address$/u } ).boundingBox();
		if ( ! firstError || ! urlLabel ) {
			throw new Error( 'Expected inline validation and the next field label to be visible.' );
		}
		expect( urlLabel.y - firstError.y - firstError.height ).toBeGreaterThanOrEqual( 16 );
		expect( await page.evaluate( () => document.documentElement.scrollWidth ) ).toBe( 320 );
		await page.screenshot( { path: test.info().outputPath( 'focus-links-empty-validation.png' ), fullPage: true } );
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
		await page.getByRole( 'link', { name: 'Focus links', exact: true } ).click();
		const rows = page.locator( '.settings-site-list > .settings-site-item' );
		await expect( rows ).toHaveCount( 2 );
		await expect( rows.first().locator( '.settings-site-identity h2' ) ).toHaveText( 'Write' );
		await expect( rows.first().locator( '.settings-site-identity p' ) ).toHaveText( 'https://example.com/write' );
		await expect( rows.nth( 1 ).locator( '.settings-site-identity h2' ) ).toHaveText( 'Read' );
		await expect( rows.locator( 'input, img' ) ).toHaveCount( 0 );
		await rows.first().getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( rows.first().getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await rows.first().getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await page.evaluate( ( theme ) => {
			window.settingsTest.externalPreferences( { theme } );
		}, ThemeMode.DARK );
		await expect( rows.first().getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
		await rows.first().getByRole( 'button', { name: 'Edit link', exact: true } ).click();
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

	test( 'reopens a collapsed invalid shortcut before focusing its validation error', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'javascript:alert(1)' );
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toBeFocused();
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toHaveValue( 'javascript:alert(1)' );
		await expect( page.getByLabel( 'Web address', { exact: true } ) ).toHaveAttribute( 'aria-invalid', 'true' );
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
		await page.getByRole( 'link', { name: 'Focus links', exact: true } ).click();
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		await expect( add ).toHaveCount( 0 );
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 )
			.getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( add ).toBeVisible();
		await expect( add ).toBeEnabled();
		await add.click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 ).getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await expect( add ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
	} );

	test( 'adds, edits, reorders and removes up to three persistent links', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await expect( page.getByRole( 'heading', { name: 'Focus links', exact: true } ) ).toBeVisible();
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		const add = page.getByRole( 'button', { name: 'Add site', exact: true } );
		for ( const [ index, label ] of [ 'Write', 'Read', 'Plan' ].entries() ) {
			await add.click();
			const group = page.locator( '.settings-site-list > .settings-site-item' ).nth( index );
			await expect( group.getByLabel( 'Label', { exact: true } ) ).toBeFocused();
			await group.getByLabel( 'Label', { exact: true } ).fill( label );
			await group.getByLabel( 'Web address', { exact: true } ).fill( ` https://example.com/${ label.toLowerCase() } ` );
		}
		await expect( add ).toHaveCount( 0 );
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 ).getByRole( 'button', { name: 'Move up', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Plan' );
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 0 ).getByRole( 'button', { name: 'Move down', exact: true } ).click();
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 2 ).getByRole( 'button', { name: 'Remove link', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByLabel( 'Label', { exact: true } ) ).toBeFocused();
		await expect( add ).toBeVisible();
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const links = await page.evaluate( () => window.settingsTest.getPreferences().focusLinks );
		expect( links.map( ( link ) => [ link.label, link.url ] ) ).toEqual( [ [ 'Plan', 'https://example.com/plan' ], [ 'Draft', 'https://example.com/write' ] ] );
		expect( new Set( links.map( ( link ) => link.id ) ).size ).toBe( 2 );
		await expect( page.locator( '.settings-site-list input' ) ).toHaveCount( 0 );
		await expect( page.locator( '.settings-site-item' ).first().getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'link', { name: 'Focus links', exact: true } ).click();
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
	} );

	test( 'retains invalid drafts and focuses the invalid field without writing', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
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
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
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
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeFocused();
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await expect( page ).toHaveURL( /#about$/u );
	} );

	test( 'rebases external preferences and saves only the link draft', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
		await page.evaluate( ( { theme, palette } ) => {
			window.settingsTest.externalPreferences( { theme, palette } );
		}, { theme: ThemeMode.DARK, palette: Palette.GREEN } );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
		const preferences = await page.evaluate( () => window.settingsTest.getPreferences() );
		expect( preferences ).toMatchObject( { theme: ThemeMode.DARK, palette: Palette.GREEN, focusLinks: [ { label: 'Read', url: 'https://example.com/' } ] } );
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Draft' );
		await page.evaluate( () => {
			window.settingsTest.externalPreferences( { focusLinks: [ { id: 'focus_link_external', label: 'Updated elsewhere', url: 'https://example.net/' } ] } );
		} );
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Draft' );
		await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Edit link', exact: true } ) ).toBeFocused();
		await page.getByRole( 'button', { name: 'Edit link', exact: true } ).click();
		await expect( page.getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Updated elsewhere' );
	} );

	test( 'retains rejected saves and locks all edits during a navigation save', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
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
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Remove link', exact: true } ) ).toBeDisabled();
		await page.evaluate( () => {
			window.settingsTest.releasePreferenceWrites();
		} );
		await expect( page ).toHaveURL( /#about$/u );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'adopts external link changes on a clean form after saving', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await page.getByLabel( 'Label', { exact: true } ).fill( 'Read' );
		await page.getByLabel( 'Web address', { exact: true } ).fill( 'https://example.com/' );
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
		await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeDisabled();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'keeps malformed preferences intact until explicit recovery', async ( { open } ) => {
		const page = await open( SettingsDestination.ABOUT );
		await page.evaluate( () => {
			window.settingsTest.malformPreferences();
		} );
		await page.getByRole( 'link', { name: 'Focus links', exact: true } ).click();
		await expect( page.getByRole( 'button', { name: 'Add site', exact: true } ) ).toHaveCount( 0 );
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Restore personalization defaults', exact: true } ).click();
		await expect( page.getByText( 'No websites yet', { exact: true } ) ).toBeVisible();
		expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	} );

	test( 'keeps duplicate URLs and keyboard operations available in a narrow accessible form', async ( { open } ) => {
		const page = await open( SettingsDestination.FOCUS_LINKS );
		await page.setViewportSize( { width: 320, height: 900 } );
		for ( const label of [ 'Read', 'Write' ] ) {
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
			await page.keyboard.press( 'Enter' );
			await page.keyboard.type( label );
			await page.keyboard.press( 'Tab' );
			await page.keyboard.type( 'https://example.com/' );
		}
		await page.locator( '.settings-site-list > .settings-site-item' ).nth( 1 ).getByRole( 'button', { name: 'Move up', exact: true } ).focus();
		await page.keyboard.press( 'Space' );
		await expect( page.locator( '.settings-site-list > .settings-site-item' ).nth( 0 ).getByLabel( 'Label', { exact: true } ) ).toHaveValue( 'Write' );
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
