import { expect, test, type Page } from '@playwright/test';
import { createBackupDocument } from '../../../../domains/local-data/utils/backup-document';
import { createBackupSource } from '../../../../domains/local-data/utils/backup-document/__fixtures__';
import type { OnboardingPageShell } from '../../services/onboarding-page/types';
import type { BackupActionResult, BackupPreview } from '../../../settings/services/backup-data-actions/types';

/** Test-only browser boundary exposing the mounted production page port. */
type ImportTestWindow = Window & { presentationTest: { port: OnboardingPageShell } };

/**
 * Opens the real onboarding form with deterministic authority responses.
 * @param page - Isolated browser page.
 * @param statuses - Import outcomes returned in order.
 * @param missingAccess - Access state returned by a completed import.
 */
async function openImport( page: Page, statuses: BackupActionResult['status'][] = [ 'completed' ], missingAccess = false ) {
	await page.goto( '/apps/extension/tests/ui/?surface=onboarding' );
	await expect( page.getByRole( 'heading', { name: 'Choose your language', exact: true } ) ).toBeVisible();
	await page.evaluate( ( scenario ) => {
		const port = ( window as ImportTestWindow ).presentationTest.port;
		let previews = 0;
		const requests: BackupPreview[] = [];
		port.backupActions = {
			/**
			 * Captures a generation without changing stored data.
			 * @param backup - Locally validated document.
			 * @return One generation-bound preview.
			 */
			preview: ( backup ) => {
				document.body.dataset.previews = String( ++previews );
				return Promise.resolve( { backup, expectedGeneration: 'before', requestId: `import_${ String( previews ) }` } );
			},
			/**
			 * Captures the exact confirmation identity and click activation.
			 * @param preview - Reviewed generation and request identity.
			 * @return The next controlled replacement result.
			 */
			confirmImport: ( preview ) => {
				requests.push( preview );
				document.body.dataset.requests = String( requests.length );
				document.body.dataset.sameRequest = String(
					requests.every( ( request ) => request === requests[ 0 ] ),
				);
				document.body.dataset.activation = String( navigator.userActivation.isActive );
				const status = scenario.statuses.shift() ?? 'completed';
				return Promise.resolve( status === 'completed'
					? { status, requestId: preview.requestId, generation: 'after', missingAccess: scenario.missingAccess }
					: { status } );
			},
			/** @return Verified access after the next explicit recovery gesture. */
			requestAccess: () => {
				document.body.dataset.accessActivation = String( navigator.userActivation.isActive );
				return Promise.resolve( document.body.dataset.allowAccess === 'true' );
			},
		};
	}, { statuses, missingAccess } );
	await page.getByRole( 'button', { name: 'Have a backup?', exact: true } ).click();
	await expect( page.getByRole( 'dialog', { name: 'Import a backup', exact: true } ) ).toBeVisible();
}

/**
 * Selects an actual portable JSON file through the production input and validator.
 * @param page - Isolated browser page.
 */
async function chooseBackup( page: Page ) {
	await page.locator( 'input[type="file"]' ).setInputFiles( {
		name: 'TOCus-backup-2026-10-17.json', mimeType: 'application/json',
		buffer: Buffer.from( JSON.stringify( createBackupDocument( createBackupSource() ) ) ),
	} );
	await expect( page.getByRole( 'dialog', { name: 'Restore this backup?', exact: true } ) ).toBeVisible();
}

test( 'keeps the header entry aligned and reviews a local file before restoring', async ( { page } ) => {
	await openImport( page );
	await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	const entry = page.getByRole( 'button', { name: 'Have a backup?', exact: true } );
	await expect( entry ).toBeFocused();
	for ( const width of [ 360, 1280 ] ) {
		await page.setViewportSize( { width, height: 800 } );
		const geometry = await entry.evaluate( ( element ) => {
			const icon = element.querySelector( '.tocus-icon' );
			const label = element.querySelector( '.mantine-Button-label' );
			if ( ! icon || ! label || ! element.parentElement ) {
				throw new Error( 'Expected the shared labeled button in the onboarding header.' );
			}
			const style = getComputedStyle( element );
			return { icon: icon.getBoundingClientRect().width, font: parseFloat( style.fontSize ),
				labelRight: label.getBoundingClientRect().right,
				gridRight: element.parentElement.getBoundingClientRect().right,
				margin: parseFloat( style.marginInlineEnd ), padding: parseFloat( style.paddingInlineEnd ) };
		} );
		expect( geometry.icon ).toBeCloseTo( geometry.font * 1.25, 1 );
		expect( geometry.labelRight ).toBeCloseTo( geometry.gridRight, 0 );
		expect( geometry.margin ).toBe( -geometry.padding - 1 );
	}
	await entry.click();
	await chooseBackup( page );
	const dialog = page.getByRole( 'dialog' );
	await expect( dialog ).toContainText( 'TOCus-backup-2026-10-17.json' );
	await expect( dialog ).toContainText( '2026' );
	await expect( dialog ).toContainText( 'Included' );
	await expect( dialog ).toContainText( '7 reconsidered visits' );
	await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-previews', '1' );
	await expect( page.locator( 'body' ) ).not.toHaveAttribute( 'data-requests' );
	await dialog.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeFocused();
	await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-activation', 'true' );
	await expect( page.getByRole( 'button', { name: 'Have a backup?', exact: true } ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'button', { name: 'Open Settings', exact: true } ) ).toBeVisible();
} );

test( 'keeps site drafts after cancellation and safely reports an invalid file', async ( { page } ) => {
	await openImport( page );
	await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await page.getByRole( 'textbox' ).fill( 'example.com' );
	await page.getByRole( 'button', { name: 'Have a backup?', exact: true } ).click();
	await page.locator( 'input[type="file"]' ).setInputFiles( {
		name: 'private-invalid.json', mimeType: 'application/json', buffer: Buffer.from( '{secret-file-contents' ),
	} );
	await expect( page.getByRole( 'alert' ) ).toHaveText( "This file isn't valid JSON. Choose a TOCus backup." );
	await expect( page.getByRole( 'dialog' ) ).not.toContainText( 'secret-file-contents' );
	await page.keyboard.press( 'Escape' );
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
	await expect( page.getByRole( 'textbox' ) ).toHaveValue( 'example.com' );
	await expect( page.locator( 'body' ) ).not.toHaveAttribute( 'data-requests' );
} );

test( 'discards a canceled asynchronous file read and keeps native picker cancellation harmless', async ( { page } ) => {
	await openImport( page );
	await page.locator( 'input[type="file"]' ).dispatchEvent( 'cancel' );
	await expect( page.getByRole( 'dialog' ) ).toBeVisible();
	await page.evaluate( () => {
		File.prototype.text = async function() {
			await new Promise<void>( ( resolve ) => {
				document.addEventListener( 'finish-file-read', () => {
					resolve();
				}, { once: true } );
			} );
			return Blob.prototype.text.call( this );
		};
	} );
	await page.locator( 'input[type="file"]' ).setInputFiles( {
		name: 'late.json', mimeType: 'application/json',
		buffer: Buffer.from( JSON.stringify( createBackupDocument( createBackupSource() ) ) ),
	} );
	await expect( page.getByRole( 'button', { name: 'Choose backup file', exact: true } ) ).toBeDisabled();
	await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await page.evaluate( () => document.dispatchEvent( new Event( 'finish-file-read' ) ) );
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
	await expect( page.locator( 'body' ) ).not.toHaveAttribute( 'data-previews' );
} );

test( 'reports file-read failures without exposing the error contents', async ( { page } ) => {
	await openImport( page );
	await page.evaluate( () => {
		File.prototype.text = () => Promise.reject( new Error( 'private-read-details' ) );
	} );
	await page.locator( 'input[type="file"]' ).setInputFiles( {
		name: 'unreadable.json', mimeType: 'application/json', buffer: Buffer.from( '{}' ),
	} );
	await expect( page.getByRole( 'alert' ) ).toHaveText( "TOCus couldn't read this file. Choose it again." );
	await expect( page.getByRole( 'dialog' ) ).not.toContainText( 'private-read-details' );
	await expect( page.getByRole( 'button', { name: 'Choose backup file', exact: true } ) ).toBeEnabled();
	await expect( page.locator( 'body' ) ).not.toHaveAttribute( 'data-previews' );
} );

test( 'contains a file-read result after the import component unmounts', async ( { page } ) => {
	await openImport( page );
	await page.evaluate( () => {
		File.prototype.text = async function() {
			await new Promise<void>( ( resolve ) => {
				document.addEventListener( 'finish-file-read', () => {
					resolve();
				}, { once: true } );
			} );
			return Blob.prototype.text.call( this );
		};
	} );
	await page.locator( 'input[type="file"]' ).setInputFiles( {
		name: 'late.json', mimeType: 'application/json',
		buffer: Buffer.from( JSON.stringify( createBackupDocument( createBackupSource() ) ) ),
	} );
	await expect( page.getByRole( 'button', { name: 'Choose backup file', exact: true } ) ).toBeDisabled();
	await page.evaluate( () => {
		const port = ( window as ImportTestWindow ).presentationTest.port;
		const copy = port.copy;
		document.addEventListener( 'remount-onboarding', () => {
			port.copy = copy;
		}, { once: true } );
		port.copy = undefined;
	} );
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
	await page.evaluate( async () => {
		document.dispatchEvent( new Event( 'finish-file-read' ) );
		await new Promise<void>( ( resolve ) => requestAnimationFrame( () => {
			resolve();
		} ) );
		document.dispatchEvent( new Event( 'remount-onboarding' ) );
	} );
	await expect( page.getByRole( 'button', { name: 'Have a backup?', exact: true } ) ).toBeVisible();
	await expect( page.getByRole( 'dialog' ) ).toHaveCount( 0 );
	await expect( page.locator( 'body' ) ).not.toHaveAttribute( 'data-previews' );
} );

test( 'blocks duplicate confirmations and cancellation while replacement is pending', async ( { page } ) => {
	await openImport( page );
	await page.evaluate( () => {
		const actions = ( window as ImportTestWindow ).presentationTest.port.backupActions;
		if ( ! actions ) {
			throw new Error( 'Expected the fixture backup authority.' );
		}
		let requests = 0;
		/**
		 * Retains the pending confirmation until the test settles the durable boundary.
		 * @param preview - Exact confirmed preview.
		 * @return Completed import after the fixture settlement signal.
		 */
		actions.confirmImport = async ( preview ) => {
			document.body.dataset.requests = String( ++requests );
			await new Promise<void>( ( resolve ) => {
				document.addEventListener( 'finish-import', () => {
					resolve();
				}, { once: true } );
			} );
			return { status: 'completed', requestId: preview.requestId, generation: 'after', missingAccess: false };
		};
	} );
	await chooseBackup( page );
	await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).evaluate( ( element: HTMLButtonElement ) => {
		element.click();
		element.click();
	} );
	await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-requests', '1' );
	await expect( page.getByRole( 'button', { name: 'Importing backup...', exact: true } ) ).toBeDisabled();
	await expect( page.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeDisabled();
	await page.keyboard.press( 'Escape' );
	await expect( page.getByRole( 'dialog' ) ).toBeVisible();
	await page.evaluate( () => document.dispatchEvent( new Event( 'finish-import' ) ) );
	await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
} );

test( 'disables importing while the current onboarding step is saving', async ( { page } ) => {
	await page.goto( '/apps/extension/tests/ui/?surface=onboarding&save=pending' );
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Have a backup?', exact: true } ) ).toBeDisabled();
	await page.evaluate( () => document.dispatchEvent( new Event( 'fixture-settle-save' ) ) );
	await expect( page.getByRole( 'heading', { name: 'Make TOCus yours', exact: true } ) ).toBeVisible();
	await expect( page.getByRole( 'button', { name: 'Have a backup?', exact: true } ) ).toBeEnabled();
} );

for ( const status of [ 'recovery-pending', 'busy' ] as const ) {
	test( `retains the exact request after ${ status } and localized copy updates`, async ( { page } ) => {
		await openImport( page, [ status, 'completed' ] );
		await chooseBackup( page );
		await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
		await expect( page.getByRole( 'alert' ) ).toBeVisible();
		await expect( page.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeDisabled();
		await expect( page.getByRole( 'button', { name: 'Choose a different file', exact: true } ) ).toBeDisabled();
		await page.keyboard.press( 'Escape' );
		await expect( page.getByRole( 'dialog' ) ).toBeVisible();
		await page.evaluate( () => {
			const port = ( window as ImportTestWindow ).presentationTest.port;
			if ( ! port.copy ) {
				throw new Error( 'Expected complete onboarding copy.' );
			}
			port.copy = { ...port.copy, backup: { ...port.copy.backup, reviewTitle: 'Review updated copy' } };
		} );
		await expect( page.getByRole( 'dialog', { name: 'Review updated copy', exact: true } ) ).toBeVisible();
		await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
		await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
		await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-requests', '2' );
		await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-previews', '1' );
		await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-same-request', 'true' );
	} );
}

test( 'retains import uncertainty when a retry cannot request website access', async ( { page } ) => {
	await openImport( page, [ 'recovery-pending', 'permission-error', 'completed' ] );
	await chooseBackup( page );
	await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
	await expect( page.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeDisabled();
	await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) )
		.toHaveText( "TOCus couldn't finish importing. Try again to complete the replacement." );
	await expect( page.getByRole( 'button', { name: 'Cancel', exact: true } ) ).toBeDisabled();
	await expect( page.getByRole( 'button', { name: 'Choose a different file', exact: true } ) ).toBeDisabled();
	await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
	await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-same-request', 'true' );
} );

test( 'requires a fresh file preview after local data changes', async ( { page } ) => {
	await openImport( page, [ 'stale', 'completed' ] );
	await chooseBackup( page );
	await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toContainText( 'Your local data changed.' );
	await expect( page.getByRole( 'button', { name: 'Restore backup', exact: true } ) ).toHaveCount( 0 );
	await chooseBackup( page );
	await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-previews', '2' );
	await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
} );

test( 'removes Appearance preview and verifies website access from an explicit recovery gesture', async ( { page } ) => {
	await openImport( page, [ 'completed' ], true );
	await page.getByRole( 'button', { name: 'Cancel', exact: true } ).click();
	await page.getByRole( 'button', { name: 'Continue', exact: true } ).click();
	await expect( page.locator( '.onboarding-preview' ) ).toBeVisible();
	await page.getByRole( 'button', { name: 'Have a backup?', exact: true } ).click();
	await chooseBackup( page );
	await page.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'One more step for your websites', exact: true } ) ).toBeVisible();
	await expect( page.locator( '.onboarding-preview' ) ).toHaveCount( 0 );
	await page.getByRole( 'button', { name: 'Allow website access', exact: true } ).click();
	await expect( page.getByRole( 'alert' ) ).toBeVisible();
	await expect( page.getByRole( 'heading', { name: 'One more step for your websites', exact: true } ) ).toBeVisible();
	await expect( page.locator( 'body' ) ).toHaveAttribute( 'data-access-activation', 'true' );
	await page.evaluate( () => {
		document.body.dataset.allowAccess = 'true';
	} );
	await page.getByRole( 'button', { name: 'Allow website access', exact: true } ).click();
	await expect( page.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeFocused();
} );
