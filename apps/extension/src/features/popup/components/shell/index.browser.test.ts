import { test, expect, type Page } from '@playwright/test';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { PopupOperationError } from './types';

/**
 * Opens the production popup on the runner-owned page.
 * @param page - Test-scoped popup page.
 * @return Completion when the primary popup action is ready.
 */
async function open( page: Page ): Promise<void> {
	await page.setViewportSize( { width: 352, height: 800 } );
	page.setDefaultTimeout( 6000 );
	await page.goto( '/apps/extension/src/features/popup/components/shell/__fixtures__/' );
	await page.getByRole( 'button', { name: 'Pause site', exact: true } ).waitFor();
}

test.describe( 'popup contracts', () => {
	test( 'keeps enrollment synchronous and prevents duplicate requests while pending', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		const action = page.getByRole( 'button', { name: 'Pause site', exact: true } );
		await action.focus();
		await page.keyboard.press( 'Space' );
		await page.keyboard.press( 'Space' );
		expect( await page.evaluate( () => window.popupTest.requests ) ).toBe( 1 );
		expect( await page.locator( '.primary-action' ).isDisabled() ).toBe( true );
		expect( await page.locator( '[aria-busy="true"]' ).count() ).toBeGreaterThan( 0 );
		for ( const label of [ 'Settings', 'Statistics' ] ) {
			const link = page.getByRole( 'link', { name: label, exact: true } );
			expect( await link.getAttribute( 'href' ) ).toContain( '/options.html#' );
			expect( await link.getAttribute( 'rel' ) ).toContain( 'noopener' );
		}
		await page.evaluate( async () => {
			const { port, listed } = window.popupTest;
			port.adding = false;
			port.projection = listed;
			await port.focusManageAction();
		} );
		await expect.poll( () => page.locator( '.manage-action' ).evaluate(
			( element ) => element === document.activeElement,
		) ).toBe( true );
	} );

	test( 'keeps focused waiting authoritative and excludes unrelated timers', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		await page.evaluate( () => {
			const { port, listed, wait } = window.popupTest;
			port.projection = { ...listed, activeScopes: [ wait ] };
		} );
		const timer = page.getByRole( 'region', { name: 'Time left', exact: true } );
		await timer.waitFor();
		expect( await timer.locator( 'strong' ).textContent() ).toBe( '0:05' );
		await page.evaluate( () => {
			window.popupTest.port.nowEpochMilliseconds = 100000;
		} );
		expect( await timer.locator( 'strong' ).textContent() ).toBe( '0:05' );
		await page.evaluate( () => {
			const { port, listed, wait } = window.popupTest;
			port.projection = { ...listed, activeScopes: [ { ...wait, isCurrentScope: false } ] };
		} );
		await timer.waitFor( { state: 'hidden' } );
		await page.evaluate( () => {
			const { port, listed } = window.popupTest;
			port.projection = { ...listed, activeScopes: [ {
				kind: window.popupTest.scopeKinds.SHARED, phase: window.popupTest.timerPhases.ALLOWANCE,
				scopeId: window.popupTest.wait.scopeId, site: null,
				siteCount: 1, isCurrentScope: true, expiresAtEpochMilliseconds: 1000,
			} ] };
		} );
		await timer.waitFor();
		expect( await timer.locator( 'strong' ).textContent() ).toBe( '0:00' );
	} );

	test( 'supports unavailable lookup retry and controller-selected focus recovery', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		await page.evaluate( () => {
			const { port, listed } = window.popupTest;
			port.projection = {
				...listed, currentSite: { status: window.popupTest.currentSiteStatuses.UNAVAILABLE },
			};
		} );
		await page.getByRole( 'button', { name: 'Try again', exact: true } ).click();
		expect( await page.locator( '.retry-action' ).isDisabled() ).toBe( true );
		expect( await page.evaluate( () => window.popupTest.retries ) ).toBe( 1 );
		await page.evaluate( async () => {
			const { port, listed } = window.popupTest;
			port.retrying = false;
			port.projection = listed;
			await port.focusAfterRetry();
		} );
		await expect.poll( () => page.locator( '.manage-action' ).evaluate(
			( element ) => element === document.activeElement,
		) ).toBe( true );
		await page.evaluate( async () => {
			const { port, listed } = window.popupTest;
			port.projection = {
				...listed, currentSite: { status: window.popupTest.currentSiteStatuses.UNSUPPORTED },
			};
			await port.focusAfterRetry();
		} );
		await expect.poll( () => page.locator( '.neutral-message' ).evaluate(
			( element ) => element === document.activeElement,
		) ).toBe( true );
		expect( await page.getByRole( 'button' ).count() ).toBe( 0 );
	} );

	test( 'keeps all enrollment failures readable and preserves the retryable action', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		for ( const error of Object.values( PopupOperationError ) ) {
			await page.evaluate( ( error ) => {
				window.popupTest.port.operationError = error;
			}, error );
			await page.getByRole( 'alert' ).waitFor();
			expect( await page.getByRole( 'alert' ).textContent() ).not.toBe( '' );
			expect( await page.getByRole( 'button', { name: 'Pause site', exact: true } ).isEnabled() ).toBe( true );
		}
	} );

	test( 'contains long identities and failed local favicons across every appearance', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		await page.evaluate( () => {
			const { port, listed } = window.popupTest;
			port.projection = {
				...listed,
				currentSite: {
					status: window.popupTest.currentSiteStatuses.UNPROTECTED,
					identityHost: `${ 'long-name.'.repeat( 12 ) }example.com`,
				},
			};
			port.faviconSource = '/missing-local-favicon.png';
		} );
		await page.locator( '.mantine-Avatar-placeholder' ).waitFor();
		for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
			for ( const palette of Object.values( Palette ) ) {
				await page.evaluate( ( { theme, palette } ) => {
					document.documentElement.setAttribute( 'data-tocus-theme', theme );
					document.documentElement.setAttribute( 'data-tocus-palette', palette );
				}, { theme, palette } );
				const fits = await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth );
				expect( fits ).toBe( true );
			}
		}
	} );

	test( 'leaves focus unchanged when website management is unavailable', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		await page.evaluate( async () => {
			const { port, listed } = window.popupTest;
			port.settingsPageUrl = '';
			port.projection = listed;
			await port.focusManageAction();
		} );
		expect( await page.evaluate( () => document.activeElement === document.body ) ).toBe( true );
	} );

	test( 'renders nothing while either localization or projection is absent', async ( { page } ) => {
		test.setTimeout( 20000 );
		await open( page );
		await page.evaluate( () => {
			window.popupTest.port.projection = null;
		} );
		await page.locator( '.popup-view' ).waitFor( { state: 'hidden' } );
		await page.evaluate( () => {
			window.popupTest.port.copy = null;
			window.popupTest.port.projection = window.popupTest.listed;
		} );
		expect( await page.locator( '.popup-view' ).count() ).toBe( 0 );
	} );
} );
