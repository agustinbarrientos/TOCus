import { expect } from '@playwright/test';
import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { test } from '../../../settings/utils/browser-test-harness';

test( 'groups sibling paths under an editable no-pause parent and edits complete child policies tentatively', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com/shorts', 'youtube.com/feed' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 3 );
	await expect( page.getByText( 'Exceptions', { exact: true } ) ).toHaveCount( 1 );
	const parent = page.locator( '.settings-site-item:not(.settings-site-exception)' );
	await expect( parent ).toContainText( 'No pause' );
	await expect( parent.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ) ).toBeVisible();
	const child = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	const dialog = page.getByRole( 'dialog', { name: 'youtube.com/shorts', exact: true } );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toHaveCount( 0 );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider' ) ).toHaveCount( 4 );
	await expect( dialog.getByRole( 'radio' ) ).toHaveCount( 2 );
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Mon - Fri, all day', exact: true } ).click();
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveCount( 5 );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).toContainText( 'Custom pause timing' );
	await expect( child ).toContainText( 'Custom schedule' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) =>
		[ site.rule.host, site.rule.pathPrefix, site.rule.behavior ] ) ) ).toEqual( [
		[ 'youtube.com', '/shorts', undefined ], [ 'youtube.com', undefined, 'allow' ],
		[ 'studio.youtube.com', undefined, 'allow' ], [ 'youtube.com', '/feed', undefined ],
	] );
} );

test( 'starts child timing from the staged main policy and retains tentative toggles until Done', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com', 'youtube.com/shorts' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	const main = page.locator( '.settings-site-item:not(.settings-site-exception)' );
	const child = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	const edit = 'Change when TOCus pauses this site, or rename it';
	await main.getByRole( 'button', { name: edit, exact: true } ).click();
	let dialog = page.getByRole( 'dialog' );
	await expect( dialog.getByLabel( 'Name', { exact: true } ) ).toBeVisible();
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await expect( page.locator( '#initial-wait' ) ).toHaveCount( 1 );
	await dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '20' );
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( child ).not.toContainText( 'Custom pause timing' );
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await main.getByRole( 'button', { name: edit, exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'slider', { name: 'Initial wait', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	dialog = page.getByRole( 'dialog' );
	await expect( dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '15' );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).not.toContainText( 'Custom pause timing' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) =>
		site.timingConfiguration?.initialWaitMilliseconds ) ) ).toEqual( [ 20000, undefined, undefined ] );
} );

test( 'keeps no-pause behavior isolated through Escape, Done, Save and Discard', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'studio.youtube.com' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	const child = page.locator( '.settings-site-exception' );
	const edit = child.getByRole( 'button', { name: 'Edit exception', exact: true } );
	await edit.click();
	await page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await expect( page.getByRole( 'dialog' ).getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ) ).toHaveCount( 0 );
	await page.keyboard.press( 'Escape' );
	await expect( child ).not.toContainText( 'No pause' );
	await edit.click();
	await expect( page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ) ).toHaveValue( 'pause' );
	await page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).toContainText( 'No pause' );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( child ).not.toContainText( 'No pause' );
	await edit.click();
	await page.getByRole( 'dialog' ).getByLabel( 'When visited', { exact: true } ).selectOption( 'allow' );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Done', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ]?.rule ) ).toMatchObject( { host: 'studio.youtube.com', includeSubdomains: false, behavior: 'allow' } );
} );

test( 'rejects exact duplicates and selects or removes only captured group members', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com', 'youtube.com/shorts', 'youtube.com/feed' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'www.youtube.com/shorts/' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	const shorts = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	await expect( shorts ).toHaveAttribute( 'data-highlighted', 'true' );
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 4 );
	await page.getByLabel( 'Website address', { exact: true } ).fill( '' );
	await shorts.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-exception' ) ).toHaveCount( 2 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await page.getByRole( 'checkbox', { name: 'Select YouTube', exact: true } ).focus();
	await page.keyboard.press( 'Space' );
	await expect( page.getByRole( 'button', { name: 'Remove selected (4)', exact: true } ) ).toBeVisible();
	for ( const checkbox of await page.getByRole( 'checkbox' ).all() ) {
		await expect( checkbox ).toBeChecked();
	}
	await page.getByRole( 'button', { name: 'Remove selected (4)', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	for ( const checkbox of await page.getByRole( 'checkbox' ).all() ) {
		await expect( checkbox ).not.toBeChecked();
	}
	await page.locator( '.settings-site-item:not(.settings-site-exception)' ).getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await expect( page.locator( '.settings-site-item' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toHaveLength( 0 );
} );

test( 'keeps exception fields usable with narrow enlarged text and reduced motion', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	await page.setViewportSize( { width: 320, height: 844 } );
	await page.emulateMedia( { reducedMotion: 'reduce' } );
	await page.addStyleTag( { content: 'html { font-size: 125%; }' } );
	await page.getByLabel( 'Website address', { exact: true } ).fill( 'youtube.com/shorts' );
	await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	const child = page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } );
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	const dialog = page.getByRole( 'dialog', { name: 'youtube.com/shorts', exact: true } );
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Mon - Fri, all day', exact: true } ).click();
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveCount( 5 );
	await dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } ).click();
	await dialog.getByRole( 'slider', { name: 'Allowance', exact: true } ).focus();
	await page.keyboard.press( 'ArrowRight' );
	await dialog.getByRole( 'radio', { name: 'Open the site automatically', exact: true } ).check();
	await expect( dialog.getByText( /automatically/ ).last() ).toBeVisible();
	expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await child.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	await expect( dialog.getByRole( 'slider', { name: 'Allowance', exact: true } ) ).toHaveAttribute( 'aria-valuenow', '6' );
	await expect( dialog.getByRole( 'radio', { name: 'Open the site automatically', exact: true } ) ).toBeChecked();
	await dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } ).click();
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await expect( child ).not.toContainText( 'Custom schedule' );
	await expect( child ).toContainText( 'Custom pause timing' );
} );

test( 'retains browser access for a main website when only its exception is removed', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'youtube.com', 'youtube.com/shorts' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	const requests = await page.evaluate( () => window.settingsTest.controls.requests );
	await page.locator( '.settings-site-exception' ).filter( { hasText: 'youtube.com/shorts' } )
		.getByRole( 'button', { name: 'Remove site', exact: true } ).click();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	await expect( page.getByText( 'Access required', { exact: true } ) ).toHaveCount( 0 );
	expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( requests );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.map( ( site ) => site.rule.host ) ) ).toEqual( [ 'youtube.com', 'studio.youtube.com' ] );
} );


test( 'excludes retained No pause parent preferences from child inheritance while preserving child overrides', async ( { open } ) => {
	const page = await open( SettingsDestination.PROTECTED_SITES );
	for ( const address of [ 'a.com', 'a.com/inherited', 'a.com/custom' ] ) {
		await page.getByLabel( 'Website address', { exact: true } ).fill( address );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
	}
	const main = page.locator( '.settings-site-item:not(.settings-site-exception)' );
	const inherited = page.locator( '.settings-site-exception' ).filter( { hasText: 'a.com/inherited' } );
	const custom = page.locator( '.settings-site-exception' ).filter( { hasText: 'a.com/custom' } );
	const editMain = main.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } );
	const dialog = page.getByRole( 'dialog' );
	const behavior = dialog.getByLabel( 'When visited', { exact: true } );
	const timing = dialog.getByRole( 'switch', { name: 'Use custom pause timing', exact: true } );
	const schedule = dialog.getByRole( 'switch', { name: 'Use custom schedule', exact: true } );
	const wait = dialog.getByRole( 'slider', { name: 'Initial wait', exact: true } );

	/**
	 * Reads the production editor's inherited timing without creating a child override.
	 * @param seconds - Effective wait displayed when the child first opts into custom timing.
	 * @return Completion of the cancel-safe timing check.
	 */
	async function checkInheritedWait( seconds: string ): Promise<void> {
		await inherited.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
		await expect( behavior ).toHaveValue( 'pause' );
		await expect( timing ).not.toBeChecked();
		await expect( schedule ).not.toBeChecked();
		await timing.click();
		await expect( wait ).toHaveAttribute( 'aria-valuenow', seconds );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( inherited ).not.toContainText( 'Custom pause timing' );
	}

	/**
	 * Confirms the child's own timing and schedule survive main website behavior changes.
	 * @return Completion of the unchanged child policy check.
	 */
	async function checkCustomChild(): Promise<void> {
		await custom.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
		await expect( behavior ).toHaveValue( 'pause' );
		await expect( timing ).toBeChecked();
		await expect( wait ).toHaveAttribute( 'aria-valuenow', '25' );
		await expect( schedule ).toBeChecked();
		await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveValue( 'Wednesday' );
		await expect( dialog.getByLabel( 'Start', { exact: true } ) ).toHaveValue( '11:00' );
		await expect( dialog.getByLabel( 'End', { exact: true } ) ).toHaveValue( '13:00' );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	}

	await editMain.click();
	await timing.click();
	await expect( wait ).toHaveAttribute( 'aria-valuenow', '10' );
	await wait.focus();
	await page.keyboard.press( 'ArrowRight' );
	await page.keyboard.press( 'ArrowRight' );
	await expect( wait ).toHaveAttribute( 'aria-valuenow', '20' );
	await schedule.click();
	await dialog.getByLabel( 'Day', { exact: true } ).selectOption( 'Monday' );
	await dialog.getByLabel( 'Start', { exact: true } ).fill( '09:00' );
	await dialog.getByLabel( 'End', { exact: true } ).fill( '17:00' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await custom.getByRole( 'button', { name: 'Edit exception', exact: true } ).click();
	await timing.click();
	await expect( wait ).toHaveAttribute( 'aria-valuenow', '20' );
	await wait.focus();
	await page.keyboard.press( 'ArrowRight' );
	await schedule.click();
	await dialog.getByLabel( 'Day', { exact: true } ).selectOption( 'Wednesday' );
	await dialog.getByLabel( 'Start', { exact: true } ).fill( '11:00' );
	await dialog.getByLabel( 'End', { exact: true } ).fill( '13:00' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 1 );
	const pausedSites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( pausedSites[ 0 ]?.timingConfiguration?.initialWaitMilliseconds ).toBe( 20000 );
	expect( pausedSites[ 0 ]?.schedule ).toEqual( {
		mode: 'custom', windows: [ { weekday: 'Monday', startMinute: 540, endMinute: 1020 } ],
	} );
	await checkInheritedWait( '20' );

	for ( const state of [ { behavior: 'allow', wait: '10' }, { behavior: 'pause', wait: '20' }, { behavior: 'allow', wait: '10' } ] ) {
		await editMain.click();
		await behavior.selectOption( state.behavior );
		if ( state.behavior === 'allow' ) {
			await expect( dialog.getByRole( 'switch' ) ).toHaveCount( 0 );
		} else {
			await expect( wait ).toHaveAttribute( 'aria-valuenow', '20' );
			await expect( dialog.getByLabel( 'Day', { exact: true } ) ).toHaveValue( 'Monday' );
		}
		await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
		await checkInheritedWait( state.wait );
		await checkCustomChild();
	}
	await expect( main ).toContainText( 'No pause' );
	await expect( main ).not.toContainText( 'Custom pause timing' );
	await expect( main ).not.toContainText( 'Custom schedule' );
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 2 );
	const allowedSites = await page.evaluate( () => window.settingsTest.getConfiguration().sites );
	expect( allowedSites ).toEqual( pausedSites.map( ( site ) => site.rule.pathPrefix === undefined
		? { ...site, rule: { ...site.rule, behavior: 'allow' } } : site ) );
	await page.getByRole( 'link', { name: 'About', exact: true } ).click();
	await page.getByRole( 'link', { name: 'Websites', exact: true } ).click();
	await checkInheritedWait( '10' );
	await checkCustomChild();
	await editMain.click();
	await behavior.selectOption( 'pause' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await checkInheritedWait( '20' );
	await page.getByRole( 'button', { name: 'Discard', exact: true } ).click();
	await expect( main ).toContainText( 'No pause' );
	await checkInheritedWait( '10' );
	await editMain.click();
	await behavior.selectOption( 'pause' );
	await dialog.getByRole( 'button', { name: 'Done', exact: true } ).click();
	await checkInheritedWait( '20' );
	await checkCustomChild();
	await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect.poll( () => page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 3 );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( pausedSites );
} );
