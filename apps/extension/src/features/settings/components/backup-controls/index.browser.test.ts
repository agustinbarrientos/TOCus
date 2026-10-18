import { expect } from '@playwright/test';
import { test } from '../../utils/browser-test-harness';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { createBackupDocument } from '../../../../domains/local-data/utils/backup-document';
import { createBackupSource } from '../../../../domains/local-data/utils/backup-document/__fixtures__';
import { readFile } from 'node:fs/promises';

test.describe( 'local backup controls', () => {
	test( 'locks immediately and shows the export label only after 500 milliseconds without a late flash', async ( { open, setting } ) => {
		const page = await open( SettingsDestination.BACKUP_RESET );
		await page.clock.install( { time: new Date( '2026-10-18T12:00:00Z' ) } );
		await page.clock.pauseAt( new Date( '2026-10-18T12:00:01Z' ) );
		const button = page.locator( '.settings-backup-actions button' ).first();
		await setting( page, 'holdBackupExports', true );
		await button.click();
		await expect( button ).toBeDisabled();
		await expect( button ).toHaveText( 'Export backup' );
		await expect( page.getByRole( 'button', { name: 'Import backup', exact: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeDisabled();
		await page.clock.runFor( 499 );
		await expect( button ).toHaveText( 'Export backup' );
		await page.clock.runFor( 1 );
		await expect( button ).toHaveText( 'Exporting backup...' );
		const downloading = page.waitForEvent( 'download' );
		await page.evaluate( () => {
			window.settingsTest.releaseBackupExports();
		} );
		await downloading;
		await expect( button ).toBeEnabled();
		await expect( button ).toHaveText( 'Export backup' );
		await setting( page, 'holdBackupExports', true );
		await button.click();
		await page.clock.runFor( 499 );
		await expect( button ).toHaveText( 'Export backup' );
		const nextDownload = page.waitForEvent( 'download' );
		await page.evaluate( () => {
			window.settingsTest.releaseBackupExports();
		} );
		await nextDownload;
		await page.clock.runFor( 501 );
		await expect( button ).toBeEnabled();
		await expect( button ).toHaveText( 'Export backup' );
	} );

	test( 'previews real file bytes, cancels safely, then replaces after explicit confirmation', async ( { open } ) => {
		const page = await open( SettingsDestination.BACKUP_RESET );
		const backup = createBackupDocument( createBackupSource() );
		const file = { name: 'backup.json', mimeType: 'text/plain', buffer: Buffer.from( JSON.stringify( backup ) ) };
		await page.locator( 'input[type=file]' ).setInputFiles( file );
		const dialog = page.getByRole( 'dialog' );
		await expect( dialog ).toContainText( 'Video feed' );
		await expect( dialog ).toContainText( 'youtube.com' );
		await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 0 );
		await page.locator( 'input[type=file]' ).setInputFiles( file );
		await dialog.getByRole( 'button', { name: 'Replace settings and statistics', exact: true } ).click();
		await expect( dialog ).toBeHidden();
		await expect.poll( () => page.evaluate( () =>
			window.settingsTest.getConfiguration().sites[ 0 ]?.displayNameOverride ) )
			.toBe( 'Video feed' );
	} );

	test( 'downloads real portable JSON through the production download control', async ( { open } ) => {
		const page = await open( SettingsDestination.BACKUP_RESET );
		const downloading = page.waitForEvent( 'download' );
		await page.getByRole( 'button', { name: 'Export backup', exact: true } ).click();
		const download = await downloading;
		const path = await download.path();
		if ( ! path ) {
			throw new Error( 'Missing backup download.' );
		}
		const backup: unknown = JSON.parse( await readFile( path, 'utf8' ) );
		expect( backup ).toMatchObject( { application: 'TOCus', dataFormatVersion: '1.1.0' } );
	} );
} );

test( 'keeps denied imports usable, reports missing access and preserves the native consent gesture', async ( { open, setting } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	await setting( page, 'denyAccess', true );
	const backup = createBackupDocument( createBackupSource() );
	await page.locator( 'input[type=file]' ).setInputFiles( {
		name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Replace settings and statistics', exact: true } ).click();
	await expect( page.getByText( 'Settings and statistics replaced. Some websites still need browser access before TOCus can pause them.' ) ).toBeVisible();
	expect( await page.evaluate( () => window.settingsTest.controls.userActivation ) ).toBe( true );
	expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ]?.identityHost ) ).toBe( 'youtube.com' );
} );

test( 'rejects unsupported, malformed and oversized files without replacing populated settings', async ( { open } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	const original = await page.evaluate( () => window.settingsTest.getConfiguration() );
	for ( const [ buffer, message ] of [
		[ Buffer.from( '{' ), "This file isn't valid JSON" ],
		[ Buffer.from( '{"application":"TOCus","dataFormatVersion":"9"}' ), "data format isn't supported" ],
		[ Buffer.alloc( 10 * 1_024 * 1_024 + 1, ' ' ), '10 MiB file limit' ],
	] as const ) {
		await page.locator( 'input[type=file]' ).setInputFiles( { name: 'invalid.json', mimeType: 'application/json', buffer } );
		await expect( page.getByRole( 'alert' ) ).toContainText( message );
		expect( await page.evaluate( () => window.settingsTest.getConfiguration() ) ).toEqual( original );
	}
} );

test( 'supports Escape, readable previews and responsive contrast without losing controls', async ( { open } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	await page.emulateMedia( { reducedMotion: 'reduce', forcedColors: 'active', colorScheme: 'dark' } );
	await page.setViewportSize( { width: 390, height: 844 } );
	const backup = createBackupDocument( createBackupSource() );
	await page.getByRole( 'button', { name: 'Import backup', exact: true } ).focus();
	await page.locator( 'input[type=file]' ).setInputFiles( {
		name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	const dialog = page.getByRole( 'dialog' );
	await expect( dialog ).toContainText( 'Dark' );
	await expect( dialog ).toContainText( 'Green' );
	await expect( dialog ).toContainText( 'Monday' );
	await dialog.getByRole( 'button', { name: 'Cancel', exact: true } ).focus();
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toBeHidden();
	await expect( page.getByRole( 'button', { name: 'Import backup', exact: true } ) ).toBeFocused();
	expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
} );

test( 'disables conflicting reset actions throughout confirmed backup replacement', async ( { open, setting } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	await setting( page, 'holdConfigurationWrites', true );
	const backup = createBackupDocument( createBackupSource() );
	await page.locator( 'input[type=file]' ).setInputFiles( {
		name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Replace settings and statistics', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeDisabled();
	await expect( page.getByRole( 'button', { name: 'Reset all TOCus data', exact: true } ) ).toBeDisabled();
	await page.evaluate( () => {
		window.settingsTest.releaseConfigurationWrites();
	} );
	await expect( page.getByRole( 'dialog' ) ).toBeHidden();
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeEnabled();
} );

test( 'keeps a pending replacement mounted across sidebar and browser history navigation', async ( { open, setting } ) => {
	const page = await open( SettingsDestination.ABOUT );
	await page.getByRole( 'link', { name: 'Backup and reset', exact: true } ).click();
	await setting( page, 'holdConfigurationWrites', true );
	const backup = createBackupDocument( createBackupSource() );
	await page.locator( 'input[type=file]' ).setInputFiles( {
		name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Replace settings and statistics', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeDisabled();
	await page.getByRole( 'link', { name: 'Privacy', exact: true } ).click();
	await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Backup and reset' );
	await page.evaluate( () => {
		history.back();
	} );
	await expect.poll( () => page.evaluate( () => location.hash ) ).toBe( '#backup-reset' );
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeDisabled();
	await page.evaluate( () => {
		window.settingsTest.releaseConfigurationWrites();
	} );
	await expect( page.getByRole( 'dialog' ) ).toBeHidden();
	await page.getByRole( 'link', { name: 'Privacy', exact: true } ).click();
	await expect( page.getByRole( 'heading', { level: 1 } ) ).toHaveText( 'Privacy' );
} );

test( 'disables backup actions while a reset confirmation owns the data page', async ( { open } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Export backup', exact: true } ) ).toBeDisabled();
	await expect( page.locator( 'input[type=file]' ) ).toBeDisabled();
	await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Export backup', exact: true } ) ).toBeEnabled();
} );

test( 'retains exclusive data-operation ownership while selected file bytes are still being read', async ( { open } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	await page.evaluate( () => {
		/**
		 * Holds the actual file read until the test releases the browser event.
		 * @return The selected file's original text after the test releases decoding.
		 */
		File.prototype.text = async function() {
			await new Promise<void>( ( resolve ) => {
				document.addEventListener( 'backup-read-release', () => {
					resolve();
				}, { once: true } );
			} );
			return new Response( this ).text();
		};
	} );
	const backup = createBackupDocument( createBackupSource() );
	await page.locator( 'input[type=file]' ).setInputFiles( {
		name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	await expect( page.getByRole( 'button', { name: 'Export backup', exact: true } ) ).toBeDisabled();
	await expect( page.getByRole( 'button', { name: 'Import backup', exact: true } ) ).toBeDisabled();
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeDisabled();
	await page.evaluate( () => document.dispatchEvent( new Event( 'backup-read-release' ) ) );
	await expect( page.getByRole( 'dialog' ) ).toBeVisible();
} );

test( 'retains the recovery decision and shared lock until a committed import retry succeeds', async ( { open, setting } ) => {
	const page = await open( SettingsDestination.BACKUP_RESET );
	await setting( page, 'rejectSaves', true );
	const backup = createBackupDocument( createBackupSource() );
	await page.locator( 'input[type=file]' ).setInputFiles( {
		name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	const dialog = page.getByRole( 'dialog' );
	await dialog.getByRole( 'button', { name: 'Replace settings and statistics', exact: true } ).click();
	await expect( dialog.getByRole( 'button', { name: 'Try again', exact: true } ) ).toBeEnabled();
	await expect( dialog.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeDisabled();
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeDisabled();
	await page.keyboard.press( 'Escape' );
	await expect( dialog ).toBeVisible();
	await setting( page, 'rejectSaves', false );
	await dialog.getByRole( 'button', { name: 'Try again', exact: true } ).click();
	await expect( dialog ).toBeHidden();
	await expect( page.getByRole( 'button', { name: 'Reset statistics', exact: true } ) ).toBeEnabled();
} );
