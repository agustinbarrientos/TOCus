import { test, expect } from '@playwright/test';

const fixture = '/packages/ui/tests/fixture/snackbar.html';

test.describe( 'shared snackbar', () => {
	// A successful action without the shared transient feedback must fail this public UI boundary.
	test( 'announces completed feedback at the bottom center without moving focus', async ( { page } ) => {
		await page.goto( fixture );
		const action = page.getByRole( 'button', { name: 'Show success', exact: true } );
		await action.focus();
		await page.keyboard.press( 'Enter' );
		const snackbar = page.getByRole( 'status' ).filter( { hasText: 'Preferences saved' } );
		await expect( snackbar ).toBeVisible();
		await expect( action ).toBeFocused();
		await expect( snackbar ).toHaveAttribute( 'aria-live', 'polite' );
		await expect( snackbar ).toHaveCSS( 'opacity', '1' );
		const placement = await snackbar.evaluate( ( element ) => {
			const host = element.closest( '.mantine-Notifications-root' );
			const bounds = element.getBoundingClientRect();
			return { position: host?.getAttribute( 'data-position' ),
				center: bounds.left + bounds.width / 2, viewportCenter: window.innerWidth / 2,
				bottomGap: window.innerHeight - bounds.bottom };
		} );
		expect( placement.position ).toBe( 'bottom-center' );
		expect( placement.center ).toBeCloseTo( placement.viewportCenter, 0 );
		expect( placement.bottomGap ).toBeGreaterThanOrEqual( 12 );
		expect( placement.bottomGap ).toBeLessThanOrEqual( 32 );
	} );

	// Missing shared styling must expose the library's small text, stripe or unoutlined default surface.
	test( 'uses readable rounded outlined feedback surfaces with visible semantic artwork', async ( { page } ) => {
		await page.goto( fixture );
		await page.getByRole( 'button', { name: 'Show success', exact: true } ).click();
		const snackbar = page.getByRole( 'status' );
		await expect( snackbar ).toHaveText( 'Preferences saved' );
		await expect( snackbar.locator( '.tocus-icon svg' ) ).toBeVisible();
		await expect( snackbar.locator( '.tocus-icon' ) ).toHaveAttribute( 'aria-hidden', 'true' );
		const surface = await snackbar.evaluate( ( element ) => {
			const style = getComputedStyle( element );
			const message = element.querySelector( '.mantine-Notification-description' );
			return { radius: parseFloat( style.borderRadius ), borderWidth: style.borderTopWidth,
				borderStyle: style.borderTopStyle, borderColor: style.borderTopColor,
				background: style.backgroundColor, color: style.color,
				fontSize: message && parseFloat( getComputedStyle( message ).fontSize ),
				stripe: getComputedStyle( element, '::before' ).display };
		} );
		expect( surface ).toMatchObject( { radius: 12, borderWidth: '1px', borderStyle: 'solid',
			borderColor: 'rgb(57, 134, 85)', background: 'rgb(232, 246, 237)', color: 'rgb(24, 86, 50)', stripe: 'none' } );
		expect( surface.fontSize ).toBeGreaterThanOrEqual( 16 );
		expect( surface.fontSize ).toBeLessThan( 17 );
		await page.getByRole( 'button', { name: 'Show information', exact: true } ).click();
		const information = page.getByRole( 'status' ).filter( { hasText: 'No changes to save' } );
		await expect( information ).toBeVisible();
		await expect( information.locator( '.tocus-icon svg' ) ).toBeVisible();
		await expect( information ).not.toHaveCSS( 'background-color', 'rgb(232, 246, 237)' );
	} );

	// A captured old locale or an unstable context API breaks consumers after a language update.
	test( 'keeps the API stable while updating the localized keyboard dismissal label', async ( { page } ) => {
		await page.goto( fixture );
		await page.getByRole( 'button', { name: 'Use Spanish dismissal', exact: true } ).click();
		await expect( page.getByLabel( 'Stable snackbar API' ) ).toHaveText( 'true' );
		const dismiss = page.getByRole( 'status' ).getByRole( 'button' );
		await expect( dismiss ).toHaveAccessibleName( 'Cerrar aviso' );
		await dismiss.focus();
		await expect( dismiss ).toBeFocused();
		await page.keyboard.press( 'Enter' );
		await expect( page.getByRole( 'status' ) ).toHaveCount( 0 );
	} );

	// Using the global queue or forgetting replacement would replay obsolete feedback after four seconds.
	test( 'replaces pending feedback and dismisses the latest message after four seconds', async ( { page } ) => {
		await page.clock.install();
		await page.goto( fixture );
		await page.getByRole( 'button', { name: 'Show consecutive feedback', exact: true } ).click();
		await page.clock.runFor( 300 );
		await expect( page.getByRole( 'status' ) ).toHaveText( 'Latest preferences saved' );
		await page.clock.runFor( 3_000 );
		await expect( page.getByRole( 'status' ) ).toBeVisible();
		await page.clock.runFor( 1_500 );
		expect( await page.getByRole( 'status' ).count() ).toBe( 0 );
		await page.clock.runFor( 4_500 );
		await expect( page.getByRole( 'status' ) ).toHaveCount( 0 );
	} );

	// An outgoing notification must not reserve a second row and move its replacement when it unmounts.
	test( 'keeps replacement feedback anchored throughout the exit animation', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'no-preference' } );
		await page.goto( fixture );
		await page.getByRole( 'button', { name: 'Show success', exact: true } ).click();
		const outgoing = page.getByRole( 'status' );
		await expect( outgoing ).toHaveCSS( 'opacity', '1' );
		const restingBottom = await outgoing.evaluate( async ( element ) => {
			await Promise.all( element.getAnimations().map( ( animation ) => animation.finished ) );
			return element.getBoundingClientRect().bottom;
		} );
		const movement = await page.getByRole( 'button', { name: 'Show information', exact: true } )
			.evaluate( async ( button ) => {
				if ( ! ( button instanceof HTMLButtonElement ) ) {
					throw new Error( 'Missing feedback action.' );
				}
				const anchors: number[] = [];
				let overlapFrames = 0;
				const deadline = performance.now() + 2_000;
				await new Promise<void>( ( resolve, reject ) => {
					/** Records rendered frames until both the exit and replacement entry finish. */
					function sample() {
						const messages = Array.from( document.querySelectorAll( '[role="status"]' ) );
						const previous = messages.find( ( element ) => element.textContent.includes( 'Preferences saved' ) );
						const current = messages.find( ( element ) => element.textContent.includes( 'No changes to save' ) );
						if ( current ) {
							const style = getComputedStyle( current );
							const translation = new DOMMatrixReadOnly( style.transform ).m42;
							// Remove the intended slide-in transform to detect layout jumps, not easing overshoot.
							anchors.push( current.getBoundingClientRect().bottom - translation );
							if ( previous ) {
								overlapFrames += 1;
							} else if ( style.opacity === '1' && current.getAnimations().length === 0 ) {
								resolve();
								return;
							}
						}
						if ( performance.now() > deadline ) {
							reject( new Error( 'Snackbar replacement did not settle.' ) );
							return;
						}
						requestAnimationFrame( sample );
					}
					requestAnimationFrame( sample );
					button.click();
				} );
				return { anchors, overlapFrames };
			} );
		expect( movement.overlapFrames ).toBeGreaterThan( 0 );
		const largestShift = Math.max( ...movement.anchors.map( ( bottom ) => Math.abs( bottom - restingBottom ) ) );
		expect( largestShift ).toBeLessThan( 1 );
		await expect( page.getByRole( 'status' ) ).toHaveText( 'No changes to save' );
	} );

	// Updating a stable notification ID can inherit an almost-expired timer from the old message.
	test( 'gives a replacement its own four seconds after the previous message was already visible', async ( { page } ) => {
		await page.clock.install();
		await page.goto( fixture );
		await page.getByRole( 'button', { name: 'Show success', exact: true } ).click();
		await page.clock.runFor( 3_000 );
		await expect( page.getByRole( 'status' ) ).toHaveText( 'Preferences saved' );
		await page.getByRole( 'button', { name: 'Show information', exact: true } ).click();
		await page.clock.runFor( 3_000 );
		await expect( page.getByRole( 'status' ) ).toHaveText( 'No changes to save' );
		await page.clock.runFor( 1_500 );
		expect( await page.getByRole( 'status' ).count() ).toBe( 0 );
	} );

	// Ignoring the system preference leaves notification transitions active for reduced-motion users.
	test( 'honors the system reduced motion preference', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await page.goto( fixture );
		await page.getByRole( 'button', { name: 'Show success', exact: true } ).click();
		const snackbar = page.getByRole( 'status' );
		await expect( snackbar ).toBeVisible();
		await expect( snackbar ).toHaveCSS( 'transition-duration', '0s' );
		await expect( snackbar ).toHaveCSS( 'animation-name', 'none' );
	} );

	// Falling back to the global portal/store leaks notifications across roots or changes the protected page.
	test( 'isolates two shadow providers and leaves outside page styles and attributes unchanged', async ( { page } ) => {
		await page.goto( '/packages/ui/tests/fixture/snackbar-shadow.html' );
		const first = page.locator( '#first-shadow' );
		const second = page.locator( '#second-shadow' );
		await first.getByRole( 'button', { name: 'Show success', exact: true } ).click();
		await expect( first.getByRole( 'status' ) ).toHaveText( 'Preferences saved' );
		await expect( second.getByRole( 'status' ) ).toHaveCount( 0 );
		await second.getByRole( 'button', { name: 'Show information', exact: true } ).click();
		await expect( second.getByRole( 'status' ) ).toHaveText( 'No changes to save' );
		const dismiss = first.getByRole( 'button', { name: 'Dismiss notification', exact: true } );
		await dismiss.focus();
		await page.keyboard.press( 'Space' );
		await expect( first.getByRole( 'status' ) ).toHaveCount( 0 );
		await expect( second.getByRole( 'status' ) ).toHaveText( 'No changes to save' );
		expect( await second.getByRole( 'status' ).evaluate( ( element ) => {
			const root = element.getRootNode();
			return root instanceof ShadowRoot && root.host.id === 'second-shadow'
				&& element.closest( '[data-owned-portals]' ) !== null;
		} ) ).toBe( true );
		expect( await page.evaluate( () => {
			const outside = document.getElementById( 'outside-notification' );
			if ( ! outside ) {
				throw new Error( 'Missing host-owned notification sentinel.' );
			}
			return { lightDomNotifications: document.querySelectorAll( '.mantine-Notifications-root' ).length,
				rootAttributes: document.documentElement.getAttributeNames(),
				bodyAttributes: document.body.getAttributeNames(),
				fontSize: getComputedStyle( document.documentElement ).fontSize,
				outsideColor: getComputedStyle( outside ).color,
				outsideRadius: getComputedStyle( outside ).borderRadius };
		} ) ).toEqual( { lightDomNotifications: 0, rootAttributes: [ 'lang' ], bodyAttributes: [],
			fontSize: '40px', outsideColor: 'rgb(12, 34, 56)', outsideRadius: '0px' } );
		await expect( second.getByRole( 'status' ).locator( '.mantine-Notification-description' ) )
			.toHaveCSS( 'font-size', '16.1px' );
	} );
} );
