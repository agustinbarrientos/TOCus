import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { SettingsDestination } from '../../../apps/extension/src/features/settings/services/settings-navigation/types';
import { compareOriginal, expect, originalCase, OriginalFixtureOrigin, OriginalSnapshots } from './helpers';
import { waitForStatisticsState } from './helpers/statistics-readiness';
import type { Page } from '@playwright/test';

/**
 * Hovers the changed Schedule action after the fixture replays its archived pre-paint radio event.
 * @param page - Current original-only Schedule fixture using the real production controls.
 * @return Completion of the original rounded pointer movement and action animation settlement.
 * @since 0.1.0
 */
async function prepareScheduleHover( page: Page ): Promise<void> {
	await expect( page.getByRole( 'radio', { name: 'All the time', exact: true } ) ).toBeChecked();
	const action = page.getByRole( 'button', { name: 'Save', exact: true } );
	await expect( action ).toBeEnabled();
	const point = await action.evaluate( ( button ) => {
		button.scrollIntoView();
		const bounds = button.getBoundingClientRect();
		return { x: Math.round( bounds.x + bounds.width / 2 ), y: Math.round( bounds.y + bounds.height / 2 ) };
	} );
	await page.mouse.move( point.x, point.y );
	await action.evaluate( ( button ) => Promise.all(
		button.getAnimations().map( ( animation ) => animation.finished ),
	) );
	expect( await action.evaluate( ( button ) => button.matches( ':hover' ) ) ).toBe( true );
}

/**
 * Restores the original user interaction immediately before the immutable screenshot.
 * @param page - Real Settings presentation using archived deterministic inputs.
 * @param name - Exact original screenshot filename.
 * @return Settled original interaction state.
 * @since 0.1.0
 */
async function prepareState( page: Page, name: string ): Promise<void> {
	if ( name.includes( 'operation-error' ) ) {
		// The original browser-side fixture performs both real gestures before the first editor paint.
		await expect( page.getByRole( 'alert' ) ).toBeVisible();
	}
	if ( name.includes( 'no-increase' ) ) {
		await page.getByRole( 'slider', { name: 'Wait increase', exact: true } ).press( 'Home' );
		await page.getByRole( 'slider', { name: 'Wait increase', exact: true } ).blur();
		await expect( page.getByRole( 'slider', { name: 'Wait increase', exact: true } ) )
			.toHaveAttribute( 'aria-valuetext', '0 (no increase)' );
	}
	if ( name.includes( 'permissions' ) ) {
		await expect( page.getByRole( 'heading', { name: 'Why TOCus needs browser access' } ) ).toBeVisible();
	}
	if ( name.includes( 'protected-site' ) && ( name.includes( 'editing' ) || name.includes( 'removal' ) ) ) {
		const item = page.locator( '.settings-site-item' ).filter( {
			has: page.getByRole( 'heading', { name: name.includes( 'independent-removal' ) ? 'ChatGPT' : 'Instagram', exact: true } ),
		} );
		if ( name.includes( 'removal' ) ) {
			await item.getByRole( 'button', { name: 'Remove site', exact: true } ).evaluate( ( element ) => {
				if ( element instanceof HTMLButtonElement ) {
					element.click();
				}
			} );
			await expect( page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Remove', exact: true } ) ).toBeFocused();
		} else {
			await item.getByRole( 'button', { name: 'Change when TOCus pauses this site, or rename it', exact: true } ).click();
			await expect( page.getByRole( 'dialog' ).getByLabel( 'Name', { exact: true } ) ).toBeFocused();
		}
	}
	if ( name.includes( 'privacy' ) && /confirmation|pending|failed|success|narrow/.test( name ) ) {
		const action = name.includes( 'statistics-confirmation' ) || name.includes( 'success' )
			? 'Reset statistics' : 'Reset all TOCus data';
		await page.getByRole( 'button', { name: action, exact: true } ).press( 'Enter' );
		if ( /pending|failed|success/.test( name ) ) {
			await page.getByRole( 'dialog' ).getByRole( 'button', { name: action, exact: true } ).press( 'Enter' );
		}
	}
	if ( name.includes( 'statistics-settings' ) && /confirmation|resetting|failure/.test( name ) ) {
		if ( name.includes( 'resetting' ) ) {
			await expect( page.getByRole( 'dialog' ) ).toBeVisible();
			await expect( page.getByRole( 'button', { name: 'Resetting...', exact: true } ) ).toBeDisabled();
		} else {
			await page.getByRole( 'button', { name: 'Reset statistics', exact: true } ).press( 'Enter' );
			if ( name.includes( 'failure' ) ) {
				await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Reset statistics', exact: true } ).press( 'Enter' );
			}
		}
	}
	if ( name.includes( 'hover' ) ) {
		if ( name.includes( 'schedule' ) ) {
			await prepareScheduleHover( page );
			return;
		}
		await page.getByRole( 'button', { name: 'Reset all TOCus data', exact: true } ).hover();
	}
}

const settingsSnapshots = OriginalSnapshots.filter( ( entry ) =>
	/features\/(settings|statistics|protected-sites)\//.test( entry.path ) );
for ( const original of settingsSnapshots ) {
	originalCase( original.path, async ( { page } ) => {
		const name = original.path.split( '/' ).at( -1 ) ?? '';
		const shell = original.path.includes( '/shell/' );
		const bytes = readFileSync( fileURLToPath( new URL( `../../../${ original.path }`, import.meta.url ) ) );
		const width = bytes.readUInt32BE( 16 );
		const theme = name.includes( 'dark' ) ? ThemeMode.DARK : ThemeMode.LIGHT;
		const palette = name.includes( 'purple' ) ? Palette.PURPLE
			: name.includes( 'green' ) || name.includes( 'german' )
				? Palette.GREEN : name.includes( 'blue' ) ? Palette.BLUE : Palette.BROWN;
		const destination = name.includes( 'protected-site' ) ? SettingsDestination.PROTECTED_SITES
			: Object.values( SettingsDestination ).find( ( value ) => name.includes( value ) )
				?? SettingsDestination.ABOUT;
		const viewportWidth = name.includes( 'narrow' ) ? width + 16 : shell ? 1280
			: name.includes( 'privacy' ) ? 900 : name.includes( 'about' ) || name.includes( 'protected-site' ) ? 800 : 1280;
		// Preserve the archived browser viewport, not merely the cropped component size.
		const viewportHeight = shell ? 1200 : name.includes( 'protected-site' ) ? 600
			: name.includes( 'about' ) ? 1000 : name.includes( 'language' ) ? name.includes( 'narrow' ) ? 1000 : 900
				: name.includes( 'appearance' ) && name.includes( 'narrow' ) ? 1400 : 1200;
		await page.setViewportSize( { width: viewportWidth, height: viewportHeight } );
		await page.emulateMedia( { colorScheme: theme, reducedMotion: 'reduce' } );
		const parameters = new URLSearchParams( { original: name, theme, palette, width: String( width ) } );
		if ( ! shell ) {
			parameters.set( 'isolated', 'true' );
		}
		const fixture = name.startsWith( 'protected-site-item' ) ? 'site-item.html'
			: name.startsWith( 'protected-site-list' ) ? 'site-list.html' : 'index.html';
		await page.goto( `${ OriginalFixtureOrigin }/apps/extension/src/features/settings/components/shell/__fixtures__/${ fixture }?${ parameters }#${ destination }` );
		await expect( page.getByRole( 'heading', { level: fixture === 'index.html' ? 1 : 2 } ).first() ).toBeVisible();
		if ( destination === SettingsDestination.STATISTICS ) {
			await waitForStatisticsState( page, name );
		}
		await prepareState( page, name );
		await page.evaluate( () => {
			window.scrollTo( 0, 0 );
		} );
		const target = name.startsWith( 'protected-site-item-operation-error' ) ? page.getByRole( 'dialog' )
			: shell ? page.locator( '.settings-layout' ) : name.startsWith( 'protected-site-item' )
				? page.locator( '.settings-site-item' ).first() : name.startsWith( 'protected-site-list' )
					? page.locator( '.settings-site-groups' ) : page.locator( '#settings-root' );
		if ( name.includes( 'privacy' ) && name.includes( 'success' ) ) {
			await expect( page.getByRole( 'status' ).filter( { hasText: 'Statistics reset.' } ) ).toBeVisible();
			const bounds = await target.boundingBox();
			if ( bounds === null ) {
				throw new Error( 'The privacy capture root must be visible.' );
			}
			// Include the viewport-anchored snackbar without changing the registered capture width.
			await compareOriginal( page, original.path, undefined, {
				clip: { ...bounds, height: Math.max( bounds.height, viewportHeight - bounds.y ) },
			} );
			return;
		}
		await compareOriginal( page, original.path, target );
	} );
}
