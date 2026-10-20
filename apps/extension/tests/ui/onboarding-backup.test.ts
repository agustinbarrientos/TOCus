import { expect, test, type Page } from '@playwright/test';
import { createBackupDocument } from '../../src/domains/local-data/utils/backup-document';
import { createBackupSource } from '../../src/domains/local-data/utils/backup-document/__fixtures__';
import { Language, Palette, ThemeMode } from '../../src/domains/preferences/types';
import type { OnboardingPresentationTest } from './onboarding-backup-fixture';

/**
 * Creates complete local backup bytes for the production validator and authority.
 * @return A portable JSON upload retained only by the isolated browser context.
 */
function backupFile() {
	const source = createBackupSource();
	source.preferences = { ...source.preferences, language: Language.ENGLISH,
		theme: ThemeMode.DARK, palette: Palette.BLUE };
	return { name: 'existing-backup.json', mimeType: 'application/json',
		buffer: Buffer.from( JSON.stringify( createBackupDocument( source ) ) ) };
}

/**
 * Opens the approved header action and selects local file bytes.
 * @param page - Isolated browser with real production onboarding mounted.
 */
async function reviewBackup( page: Page ): Promise<void> {
	await page.getByRole( 'button', { name: 'Have a backup?', exact: true } ).click();
	await page.locator( 'input[type=file]' ).setInputFiles( backupFile() );
	await expect( page.getByRole( 'dialog' ) ).toContainText( 'existing-backup.json' );
	await expect( page.getByRole( 'dialog' ) ).toContainText( '7 reconsidered visits' );
}

/**
 * Reads the explicit fixture instrumentation without exposing real extension storage.
 * @param page - Fixture page with the production presentation boundary.
 * @return Current durable writes and gesture observations.
 */
async function observations( page: Page ) {
	return page.evaluate( () => {
		const fixture: OnboardingPresentationTest = window.presentationTest;
		return { writes: fixture.backupWrites(), requests: fixture.importRequests(), consent: fixture.consentRequests(),
			activation: fixture.consentActivation(), settings: fixture.openSettingsRequests(),
			sites: fixture.port.protectedSites, theme: fixture.port.theme, palette: fixture.port.palette };
	} );
}

test.describe( 'onboarding backup authority integration', () => {
	test( 'previews without writes and restores complete preferences and rules from the header', async ( { page } ) => {
		await page.goto( '/apps/extension/tests/ui/index.html?surface=onboarding' );
		await reviewBackup( page );
		expect( ( await observations( page ) ).writes ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
		await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
		const result = await observations( page );
		expect( result.writes ).toBeGreaterThan( 0 );
		expect( result.sites[ 0 ] ).toMatchObject( { identityHost: 'youtube.com', displayNameOverride: 'Video feed' } );
		expect( result.theme ).toBe( ThemeMode.DARK );
		expect( result.palette ).toBe( Palette.BLUE );
		expect( result.consent ).toBe( 1 );
		expect( result.activation ).toBe( true );
		await expect( page.getByRole( 'button', { name: 'Continue', exact: true } ) ).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Open Settings', exact: true } ).click();
		expect( ( await observations( page ) ).settings ).toBe( 1 );
	} );

	test( 'keeps restored data after denial and verifies a new access gesture before showing success', async ( { page } ) => {
		await page.goto( '/apps/extension/tests/ui/index.html?surface=onboarding&backup=missing' );
		await reviewBackup( page );
		await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
		await expect( page.getByRole( 'heading', { name: 'One more step for your websites', exact: true } ) ).toBeVisible();
		await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toHaveCount( 0 );
		const denied = await observations( page );
		expect( denied.writes ).toBeGreaterThan( 0 );
		expect( denied.consent ).toBe( 1 );
		await page.getByRole( 'button', { name: 'Allow website access', exact: true } ).click();
		await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
		const granted = await observations( page );
		expect( granted.writes ).toBe( denied.writes );
		expect( granted.consent ).toBe( 2 );
		expect( granted.activation ).toBe( true );
	} );

	test( 'retries a lost durable response with the same identity without replacing data twice', async ( { page } ) => {
		await page.goto( '/apps/extension/tests/ui/index.html?surface=onboarding&backup=recovery' );
		await reviewBackup( page );
		await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
		const dialog = page.getByRole( 'dialog' );
		await expect( dialog.getByRole( 'alert' ) ).toContainText( "TOCus couldn't finish importing" );
		await expect( dialog.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeDisabled();
		const pending = await observations( page );
		expect( pending.writes ).toBeGreaterThan( 0 );
		await dialog.getByRole( 'button', { name: 'Try again', exact: true } ).click();
		await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
		const restored = await observations( page );
		expect( restored.requests ).toHaveLength( 2 );
		expect( restored.requests[ 1 ] ).toBe( restored.requests[ 0 ] );
		expect( restored.writes ).toBe( pending.writes );
	} );
} );
