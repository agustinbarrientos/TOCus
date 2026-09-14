import { test, expect } from '@playwright/test';
import { TocusAppearance, TocusPalette } from '../src/types';
import { FixtureFrequency, FixtureMediaMode } from './fixture/types';

const url = '/packages/ui/tests/fixture/';

test.describe( 'shared controls', () => {
	test( 'keeps native notices semantic with decorative artwork and directly wrapping message text', async ( { page } ) => {
		await page.goto( url );
		const notice = page.getByRole( 'alert' ).filter( { hasText: 'Native notice keeps localized feedback' } );
		await notice.waitFor();
		expect( await notice.evaluate( ( element ) => element.tagName ) ).toBe( 'P' );
		expect( await notice.locator( '.tocus-icon' ).getAttribute( 'aria-hidden' ) ).toBe( 'true' );
		expect( await notice.evaluate( ( element ) => {
			const message = Array.from( element.childNodes ).find( ( node ) => node.nodeType === Node.TEXT_NODE );
			if ( ! message || ! ( element instanceof HTMLElement ) ) {
				return false;
			}
			element.style.width = '260px';
			const range = document.createRange();
			range.selectNodeContents( message );
			return message.textContent?.startsWith( 'Native notice keeps localized feedback' )
					&& range.getClientRects().length > 1 && element.scrollWidth <= element.clientWidth;
		} ) ).toBe( true );
	} );
	test( 'retains the original brand scale, heading weight and soft active navigation', async ( { page } ) => {
		await page.goto( url );
		const heading = page.getByRole( 'heading', { name: 'Controls' } );
		await heading.waitFor();
		expect( await heading.evaluate( ( element ) => parseFloat( getComputedStyle( element ).fontSize ) ) )
			.toBeCloseTo( 36.8, 4 );
		await heading.focus();
		expect( await heading.evaluate( ( element ) => getComputedStyle( element ).outlineStyle ) ).toBe( 'none' );
		expect( await page.locator( '.tocus-brand' ).evaluate( ( element ) => getComputedStyle( element ).color ) )
			.toBe( 'rgb(116, 67, 49)' );
		expect( await page.locator( '.tocus-form-actions' ).evaluate( ( element ) =>
			parseFloat( getComputedStyle( element ).gap ) ) ).toBe( 12 );
		expect( await heading.evaluate( ( element ) => getComputedStyle( element ).fontWeight ) ).toBe( '600' );
		expect( await page.locator( '.tocus-brand-icon' ).evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBe( 32 );
		expect( await page.getByRole( 'link', { name: 'Current page' } ).evaluate( ( element ) =>
			element.getBoundingClientRect().height ) ).toBeGreaterThanOrEqual( 48 );
		expect( await page.getByRole( 'link', { name: 'Current page' } ).evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return parseFloat( style.borderRadius ) >= element.clientHeight / 2 && style.color !== 'rgb(255, 248, 240)';
		} ) ).toBe( true );
	} );
	test( 'retains the warm outlined slider track and full-sized tactile thumb', async ( { page } ) => {
		await page.goto( url );
		const slider = page.getByRole( 'slider', { name: 'Initial wait' } );
		await slider.waitFor();
		expect( await slider.evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBe( 24 );
		expect( await page.locator( '.mantine-Slider-track' ).evaluate( ( element ) =>
			element.getBoundingClientRect().height ) ).toBe( 8 );
		expect( await page.locator( '.mantine-Slider-root' ).evaluate( ( element ) => {
			const root = element.getBoundingClientRect();
			const track = element.querySelector( '.mantine-Slider-track' )?.getBoundingClientRect();
			return track !== undefined && track.top + track.height / 2 === root.top + root.height / 2;
		} ) ).toBe( true );
		expect( await page.locator( '.mantine-Slider-track' ).evaluate( ( element ) =>
			getComputedStyle( element, '::before' ).borderTopStyle ) ).toBe( 'solid' );
	} );
	test( 'isolates explicit native field painting without changing default or adorned wrappers', async ( { page } ) => {
		await page.goto( url );
		const plain = page.getByRole( 'textbox', { name: 'Title', exact: true } );
		await plain.waitFor();
		expect( await plain.evaluate( ( element ) =>
			element.parentElement && getComputedStyle( element.parentElement ).position ) ).toBe( 'static' );
		const standard = page.getByRole( 'textbox', { name: 'Default field', exact: true } );
		expect( await standard.evaluate( ( element ) =>
			element.parentElement && getComputedStyle( element.parentElement ).position ) ).toBe( 'relative' );
		const adorned = page.getByRole( 'textbox', { name: 'Adorned field', exact: true } );
		expect( await adorned.evaluate( ( element ) =>
			element.parentElement && getComputedStyle( element.parentElement ).position ) ).toBe( 'relative' );
		expect( await adorned.evaluate( ( element ) => {
			const field = element.getBoundingClientRect();
			const sections = element.parentElement?.querySelectorAll( '.mantine-Input-section' );
			if ( ! sections ) {
				return false;
			}
			return sections.length === 2 && Array.from( sections ).every( ( section ) => {
				const bounds = section.getBoundingClientRect();
				return bounds.left >= field.left && bounds.right <= field.right
						&& bounds.top >= field.top && bounds.bottom <= field.bottom;
			} );
		} ) ).toBe( true );
	} );
	test( 'keeps explicit native text actions flat without changing adorned or loading buttons', async ( { page } ) => {
		await page.goto( url );
		const action = page.getByRole( 'button', { name: 'Native action', exact: true } );
		await action.waitFor();
		expect( await action.evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return [ style.display, style.position, style.overflow ];
		} ) ).toEqual( [ 'flex', 'static', 'visible' ] );
		expect( await action.evaluate( ( element ) => getComputedStyle( element, '::before' ).content ) ).toBe( 'none' );
		for ( const slot of [ '.mantine-Button-inner', '.mantine-Button-label' ] ) {
			expect( await action.locator( slot ).evaluate( ( element ) => getComputedStyle( element ).display ) ).toBe( 'contents' );
		}
		await action.focus();
		await page.keyboard.press( 'Enter' );
		await page.keyboard.press( 'Space' );
		expect( await page.getByLabel( 'Native activation count' ).textContent() ).toBe( '2' );
		expect( await page.getByRole( 'button', { name: 'Disabled native action', exact: true } ).isDisabled() ).toBe( true );
		for ( const name of [ 'Adorned action', 'Loading action', 'Save' ] ) {
			const standard = page.getByRole( 'button', { name, exact: true } );
			expect( await standard.evaluate( ( element ) => getComputedStyle( element ).position ) ).toBe( 'relative' );
			expect( await standard.locator( '.mantine-Button-inner' ).evaluate( ( element ) => getComputedStyle( element ).display ) ).toBe( 'flex' );
		}
	} );
	test( 'preserves native avatar image and accessible fallback layout without changing ordinary avatars', async ( { page } ) => {
		await page.goto( url );
		const fallback = page.getByRole( 'img', { name: 'Native initials', exact: true } );
		await fallback.waitFor();
		expect( await fallback.evaluate( ( element ) => getComputedStyle( element ).position ) ).toBe( 'static' );
		expect( await page.getByRole( 'img', { name: 'Default initials', exact: true } ).evaluate(
			( element ) => getComputedStyle( element ).position,
		) ).toBe( 'relative' );
		const image = page.getByRole( 'img', { name: 'Website icon', exact: true } );
		await image.evaluate( ( element ) => {
			if ( ! ( element instanceof HTMLImageElement ) ) {
				throw new Error( 'The image avatar must retain its native accessible image.' );
			}
			return element.decode();
		} );
		const failed = page.getByRole( 'img', { name: 'Unavailable website icon', exact: true } );
		await expect.poll( () => failed.textContent() ).toBe( 'TC' );
		for ( const avatar of [ fallback, failed ] ) {
			expect( await avatar.evaluate( ( element ) => {
				const root = element.getBoundingClientRect();
				const content = element.firstElementChild?.getBoundingClientRect();
				return root.width === 44 && root.height === 44 && content !== undefined
						&& content.left >= root.left && content.right <= root.right
						&& content.top >= root.top && content.bottom <= root.bottom;
			} ) ).toBe( true );
		}
		expect( await image.evaluate( ( element ) => {
			const imageBounds = element.getBoundingClientRect();
			return imageBounds.width === 44 && imageBounds.height === 44;
		} ) ).toBe( true );
	} );
	test( 'retains original single-line field and radio indicator dimensions', async ( { page } ) => {
		await page.goto( url );
		const input = page.getByRole( 'textbox', { name: 'Title', exact: true } );
		await input.waitFor();
		expect( await page.locator( '[data-tocus-compact="true"]' ).evaluate( ( element ) =>
			getComputedStyle( element ).backgroundColor ) ).toBe( 'rgba(0, 0, 0, 0)' );
		expect( await input.evaluate( ( element ) => element.getBoundingClientRect().height ) ).toBe( 48 );
		const indicator = page.getByRole( 'radio', { name: 'First choice', exact: true } ).locator( '.mantine-RadioIndicator-indicator' );
		expect( await indicator.evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBe( 18 );
		expect( await indicator.evaluate( ( element ) => getComputedStyle( element ).borderTopWidth ) ).toBe( '1px' );
		const checkbox = page.getByRole( 'checkbox', { name: 'Enabled', exact: true } );
		expect( await checkbox.evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBe( 20 );
		expect( await checkbox.evaluate( ( element ) => getComputedStyle( element ).appearance ) ).toBe( 'auto' );
		expect( await page.locator( '.tocus-native-checkbox .mantine-Checkbox-inner' ).evaluate( ( element ) =>
			getComputedStyle( element ).marginTop ) ).toBe( '4px' );
		expect( await page.locator( '.tocus-native-checkbox .mantine-Checkbox-inner' ).evaluate( ( element ) =>
			getComputedStyle( element ).position ) ).toBe( 'static' );
		expect( await page.locator( '.tocus-native-checkbox .mantine-Checkbox-labelWrapper' ).evaluate( ( element ) =>
			getComputedStyle( element ).paddingInlineStart ) ).toBe( '12px' );
		expect( await page.locator( '.tocus-native-checkbox .mantine-Checkbox-label' ).evaluate( ( element ) =>
			getComputedStyle( element ).paddingInlineStart ) ).toBe( '0px' );
	} );
	test( 'keeps restored native choice rows labelled and keyboard operable', async ( { page } ) => {
		await page.goto( url );
		const first = page.getByRole( 'radio', { name: 'Native first', exact: true } );
		const second = page.getByRole( 'radio', { name: 'Native second', exact: true } );
		await first.waitFor();
		expect( await first.isChecked() ).toBe( true );
		await second.click( { timeout: 3000 } );
		expect( await second.isChecked() ).toBe( true );
		await first.click();
		await first.focus();
		await page.keyboard.press( 'ArrowDown' );
		expect( await second.isChecked() ).toBe( true );
		const description = await page.getByText( 'First explanation', { exact: true } ).boundingBox();
		if ( ! description ) {
			throw new Error( 'Missing visible radio explanation.' );
		}
		await page.mouse.click( description.x + description.width / 2, description.y + description.height / 2 );
		expect( await first.isChecked() ).toBe( true );
	} );

	test( 'keeps the current disabled step filled without dimming its progress state', async ( { page } ) => {
		await page.goto( url );
		const step = page.getByRole( 'button', { name: 'Current step' } );
		await step.waitFor();
		expect( await step.locator( '.mantine-Stepper-stepIcon' ).evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return style.backgroundColor === 'rgb(116, 67, 49)'
					&& style.color === 'rgb(255, 248, 240)';
		} ) ).toBe( true );
		expect( await step.evaluate( ( element ) => getComputedStyle( element ).opacity ) ).toBe( '1' );
		expect( await page.getByRole( 'button', { name: 'Previous step' } )
			.locator( '.mantine-Stepper-stepIcon' ).evaluate( ( element ) =>
				getComputedStyle( element ).backgroundColor ) ).toBe( 'rgba(0, 0, 0, 0)' );
	} );
	test( 'retains the original pill silhouette for packaged actions', async ( { page } ) => {
		await page.goto( url );
		const action = page.getByRole( 'button', { name: 'Save', exact: true } );
		await action.waitFor();
		expect( await action.evaluate( ( element ) => element.getBoundingClientRect().height ) ).toBe( 44 );
		expect( await action.evaluate( ( element ) =>
			parseFloat( getComputedStyle( element ).paddingLeft ) ) ).toBe( 24 );
		expect( await action.evaluate( ( element ) => {
			const radius = parseFloat( getComputedStyle( element ).borderRadius );
			return radius >= element.getBoundingClientRect().height / 2;
		} ) ).toBe( true );
	} );
	test( 'isolates generated and changing inline Button and Alert lengths under strict host CSP', async ( { page } ) => {
		await page.setViewportSize( { width: 800, height: 600 } );

		await page.goto( `${ url }shadow.html` );
		const button = page.getByRole( 'button', { name: 'Change dimensions' } );
		await button.waitFor();
		/** @return Actual control geometry, including generated variables and inline props. */
		const dimensions = () => page.evaluate( () => {
			const shadow = document.getElementById( 'shadow-host' )?.shadowRoot;
			const action = shadow?.querySelector( 'button' );
			const alert = shadow?.querySelector( '[role="alert"]' );
			if ( ! action || ! alert ) {
				throw new Error( 'Missing packaged shadow controls.' );
			}
			return [ getComputedStyle( action ).width, getComputedStyle( action ).height,
				getComputedStyle( action ).fontSize, getComputedStyle( alert ).paddingTop,
				getComputedStyle( alert ).borderRadius ].map( parseFloat );
		} );
		const original = await dimensions();
		expect( original[ 0 ] ).toBe( 160 );
		expect( original[ 1 ] ).toBe( 32 );
		expect( original[ 3 ] ).toBe( 20 );
		await page.setViewportSize( { width: 1000, height: 600 } );
		expect( await dimensions() ).toEqual( original );
		await page.evaluate( () => {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync( 'html {font-size:10px!important}' );
			document.adoptedStyleSheets = [ ...document.adoptedStyleSheets, sheet ];
		} );
		expect( await dimensions() ).toEqual( original );
		await button.click();
		await page.getByRole( 'note' ).waitFor();
		const changed = await dimensions();
		expect( changed[ 0 ] ).toBe( 192 );
		expect( changed[ 1 ] ).toBe( 48 );
		expect( changed[ 3 ] ).toBe( 32 );
		expect( await page.getByRole( 'note' ).evaluate( ( element ) =>
			parseFloat( getComputedStyle( element ).paddingTop ) ) ).toBe( 16 );
		expect( await button.evaluate( ( element ) => getComputedStyle( element ).transitionDuration ) ).toBe( '0s' );
	} );
	test( 'distinguishes selected choices from notices and keeps neutral unselected borders', async ( { page } ) => {
		await page.goto( url );
		const selected = page.getByRole( 'radio', { name: 'First choice', exact: true } );
		const other = page.getByRole( 'radio', { name: 'Second choice', exact: true } );
		await selected.waitFor();
		const border = await selected.evaluate( ( element ) => getComputedStyle( element ).borderColor );
		expect( await other.evaluate( ( element ) => getComputedStyle( element ).borderColor ) ).not.toBe( border );
		const background = await selected.evaluate( ( element ) => getComputedStyle( element ).backgroundColor );
		expect( await page.getByRole( 'alert' ).filter( { hasText: 'Could not save' } ).evaluate( ( element ) =>
			getComputedStyle( element ).backgroundColor ) ).not.toBe( background );
		await other.click();
		expect( await other.getAttribute( 'aria-checked' ) ).toBe( 'true' );
		expect( await other.evaluate( ( element ) => getComputedStyle( element ).borderColor ) ).toBe( border );
		await page.keyboard.press( 'Tab' );
		await page.keyboard.press( 'Shift+Tab' );
		await other.focus();
		expect( await other.evaluate( ( element ) => getComputedStyle( element ).outlineStyle ) ).toBe( 'solid' );
	} );
	test( 'submits keyboard-adjusted timing and named choices', async ( { page } ) => {
		await page.goto( url );
		const slider = page.getByRole( 'slider', { name: 'Initial wait' } );
		await slider.focus( { timeout: 1500 } );
		expect( await page.getByRole( 'textbox', { name: 'Title' } ).evaluate( ( element ) => getComputedStyle( element ).borderStyle ) ).toBe( 'solid' );
		expect( await page.getByRole( 'checkbox', { name: 'Enabled' } ).evaluate( ( element ) => getComputedStyle( element ).appearance ) ).toBe( 'auto' );
		await page.keyboard.press( 'End' );
		expect( await slider.getAttribute( 'aria-valuenow' ) ).toBe( '30' );
		await page.getByRole( 'radio', { name: 'Pause media' } ).check();
		await page.getByRole( 'checkbox', { name: 'Enabled' } ).check();
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.getByRole( 'status' ).textContent() )
			.toBe( `30 / ${ FixtureMediaMode.PAUSE } / yes / ${ FixtureFrequency.DAILY } / Focus` );
	} );
	test( 'keeps modal focus inside and returns it after Escape', async ( { page } ) => {
		await page.goto( url );
		await page.getByRole( 'button', { name: 'Review changes' } ).click( { timeout: 1500 } );
		const dialog = page.getByRole( 'dialog', { name: 'Review' } );
		await dialog.waitFor( { state: 'visible' } );
		await expect.poll( () => dialog.evaluate(
			( element ) => element.contains( document.activeElement ),
		) ).toBe( true );
		for ( let index = 0; index < 6; index++ ) {
			await page.keyboard.press( index < 3 ? 'Tab' : 'Shift+Tab' );
			expect( await dialog.evaluate( ( element ) => element.contains( document.activeElement ) ) ).toBe( true );
		}
		await page.keyboard.press( 'Escape' );
		await dialog.waitFor( { state: 'detached' } );
		await expect.poll( () => page.getByRole( 'button', { name: 'Review changes' } ).evaluate( ( element ) => element === document.activeElement ) ).toBe( true );
	} );
	test( 'keeps destructive hover borders with their surface while primary borders retain the action color', async ( { page } ) => {
		for ( const appearance of [ TocusAppearance.LIGHT, TocusAppearance.DARK ] ) {
			await page.goto( `${ url }?appearance=${ appearance }` );
			const destructive = page.getByRole( 'button', { name: 'Delete', exact: true } );
			await destructive.hover();
			expect( await destructive.evaluate( ( element ) => {
				const style = getComputedStyle( element );
				return style.borderTopColor === style.backgroundColor;
			} ) ).toBe( true );
			const primary = page.getByRole( 'button', { name: 'Save', exact: true } );
			const border = await primary.evaluate( ( element ) => getComputedStyle( element ).borderTopColor );
			await primary.hover();
			expect( await primary.evaluate( ( element ) =>
				getComputedStyle( element ).borderTopColor ) ).toBe( border );
			expect( await primary.evaluate( ( element ) =>
				getComputedStyle( element ).backgroundColor ) ).not.toBe( border );
		}
	} );
	test( 'preserves links, disabled actions, notices, and custom select keyboard choice', async ( { page } ) => {
		await page.goto( url );
		expect( await page.getByRole( 'link', { name: 'Documentation' } ).getAttribute( 'href', { timeout: 1500 } ) ).toBe( '#documentation' );
		expect( await page.getByRole( 'button', { name: 'Unavailable' } ).isDisabled() ).toBe( true );
		expect( await page.getByRole( 'button', { name: 'Unavailable' } ).evaluate( ( element ) =>
			getComputedStyle( element ).opacity ) ).toBe( '0.6' );
		const errorNotice = page.getByRole( 'alert' ).filter( { hasText: 'Could not save' } );
		expect( await errorNotice.textContent() ).toContain( 'Could not save' );
		const iconMetrics = await errorNotice.locator( '.mantine-Alert-icon' ).evaluate( ( element ) => {
			const style = getComputedStyle( element );
			return { fontSize: parseFloat( style.fontSize ), height: element.getBoundingClientRect().height,
				marginTop: parseFloat( style.marginTop ) };
		} );
		expect( iconMetrics.height / iconMetrics.fontSize ).toBeCloseTo( 1.25, 2 );
		expect( iconMetrics.marginTop / iconMetrics.fontSize ).toBeCloseTo( 0.125, 2 );
		await page.getByRole( 'combobox', { name: 'Frequency' } ).focus();
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'ArrowDown' );
		await page.keyboard.press( 'Enter' );
		expect( await page.getByRole( 'combobox', { name: 'Frequency' } ).inputValue() ).toBe( 'Weekly' );
	} );
	// Catches brand mappings that erase semantic colors, contrast, or provider isolation.
	test( 'keeps semantic text legible in every palette, scheme and interaction state', async ( { page } ) => {
		for ( const appearance of [ TocusAppearance.LIGHT, TocusAppearance.DARK ] ) {
			for ( const palette of Object.values( TocusPalette ) ) {
				await page.goto( `${ url }?appearance=${ appearance }&palette=${ palette }` );
				await page.getByRole( 'button', { name: 'Save', exact: true } ).waitFor( { timeout: 1500 } );
				const surfaces = page.locator( '[data-contrast]' );
				const colors = [];
				for ( const surface of await surfaces.all() ) {
					for ( const state of [ 'normal', 'hover', 'focus' ] ) {
						await page.mouse.move( 0, 0 );
						if ( state === 'hover' ) {
							await surface.hover();
						}
						if ( state === 'focus' ) {
							await surface.focus();
						}
						/**
						 * Measures the rendered foreground against its first opaque ancestor surface.
						 */
						const result = await surface.evaluate( ( element ) => {
							const style = getComputedStyle( element );
							const canvas = document.createElement( 'canvas' );
							canvas.width = canvas.height = 1;
							const context = canvas.getContext( '2d' );
							if ( ! context ) {
								throw new Error( 'Canvas unavailable for contrast calculation' );
							}
							/**
							 * Resolves browser colors, including color-mix, to sRGB channels.
							 * @param color - Computed CSS color.
							 * @return Red, green and blue channels.
							 */
							const rgb = ( color: string ) => {
								context.clearRect( 0, 0, 1, 1 );
								context.fillStyle = color;
								context.fillRect( 0, 0, 1, 1 );
								return Array.from( context.getImageData( 0, 0, 1, 1 ).data ).slice( 0, 3 );
							};
							let parent: Element = element;
							let background = style.backgroundColor;
							while ( background === 'rgba(0, 0, 0, 0)' && parent.parentElement ) {
								parent = parent.parentElement; background = getComputedStyle( parent ).backgroundColor;
							}
							/**
							 * Computes WCAG relative luminance from the rendered color.
							 * @param color - Computed CSS color.
							 * @return Relative luminance.
							 */
							const luminance = ( color: string ) => rgb( color ).reduce( ( total, value, index ) => {
								const channel = value / 255;
								const linear = channel <= 0.04045 ? channel / 12.92
									: ( ( channel + 0.055 ) / 1.055 ) ** 2.4;
								return total + linear * ( [ 0.2126, 0.7152, 0.0722 ][ index ] ?? 0 );
							}, 0 );
							const foreground = luminance( style.color ); const back = luminance( background );
							const ratio = ( Math.max( foreground, back ) + 0.05 )
								/ ( Math.min( foreground, back ) + 0.05 );
							return { ratio, background };
						} );
						expect( result.ratio, `${ appearance }/${ palette }/${ await surface.textContent() ?? '' }/${ state }` ).toBeGreaterThanOrEqual( 4.5 );
						if ( state === 'normal' ) {
							colors.push( result.background );
						}
					}
				}
				expect( new Set( colors ).size ).toBeGreaterThanOrEqual( 5 );
				expect( await page.locator( 'html' ).getAttribute( 'data-mantine-color-scheme' ) ).toBeNull();
				expect( await page.evaluate( () => localStorage.length ) ).toBe( 0 );
			}
		}
	} );
	// Catches a provider scale regression, missing local font, or unscoped theme updates.
	test( 'isolates providers, scales compact pages, bundles fonts, and fits narrow viewports', async ( { page, baseURL } ) => {
		await page.setViewportSize( { width: 360, height: 800 } );
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		const fixtureOrigin = `${ new URL( url, baseURL ).origin }/`;
		const external: string[] = [];
		page.on( 'request', ( request ) => {
			if ( ! request.url().startsWith( fixtureOrigin ) ) {
				external.push( request.url() );
			}
		} );
		await page.goto( url );
		await page.getByRole( 'heading', { name: 'Controls' } ).waitFor( { timeout: 1500 } );
		await page.evaluate( () => document.fonts.ready );
		expect( await page.evaluate( () => Array.from( document.fonts ).some( ( font ) => font.family.includes( 'Fredoka' ) && font.status === 'loaded' ) ) ).toBe( true );
		expect( await page.locator( 'h1' ).evaluate( ( element ) => getComputedStyle( element ).fontFamily ) ).toContain( 'Fredoka' );
		expect( await page.locator( '[data-testid="main-provider"]' ).evaluate( ( element ) => getComputedStyle( element ).fontSize ) ).toBe( '18.4px' );
		expect( await page.getByRole( 'button', { name: 'Compact action' } ).evaluate( ( element ) => getComputedStyle( element ).fontSize ) ).toBe( '14px' );
		expect( await page.getByRole( 'button', { name: 'Compact action' } ).evaluate( ( element ) => getComputedStyle( element ).backgroundColor ) ).not.toBe( await page.getByRole( 'button', { name: 'Save', exact: true } ).evaluate( ( element ) => getComputedStyle( element ).backgroundColor ) );
		expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
		expect( await page.getByRole( 'button', { name: 'Save', exact: true } ).evaluate( ( element ) => getComputedStyle( element ).transitionDuration ) ).toBe( '0s' );
		expect( external ).toEqual( [] );
	} );
	test( 'keeps controls distinguishable with forced colors', async ( { page } ) => {
		await page.emulateMedia( { forcedColors: 'active' } );
		await page.goto( url );
		const save = page.getByRole( 'button', { name: 'Save', exact: true } );
		await save.waitFor( { timeout: 1500 } );

		await save.focus();
		expect( await save.evaluate( ( element ) => getComputedStyle( element ).outlineStyle ) ).not.toBe( 'none' );
		expect( await save.evaluate( ( element ) => getComputedStyle( element ).borderStyle ) ).toBe( 'solid' );
	} );
	// Catches root attributes leaking after unmount or portals falling back to document.body.
	test( 'contains explicit owned portals and restores owned root attributes', async ( { page } ) => {
		await page.goto( `${ url }?ownership=1` );
		const action = page.getByRole( 'button', { name: 'Owned action' } );
		await action.waitFor( { timeout: 1500 } );
		expect( await action.evaluate( ( element ) => Boolean( element.closest( '#owned-portals' ) ) ) ).toBe( true );
		expect( await page.locator( '#owned-root' ).getAttribute( 'data-tocus-theme' ) ).toBe( TocusAppearance.DARK );
		expect( await page.locator( 'html' ).getAttribute( 'data-mantine-color-scheme' ) ).toBeNull();
		expect( await page.locator( '[data-mantine-shared-portal-node]' ).count() ).toBe( 0 );
		await page.getByRole( 'button', { name: 'Unmount integration' } ).click();
		await expect.poll( () => action.count() ).toBe( 0 );
		expect( await page.locator( '#owned-root' ).getAttribute( 'data-tocus-theme' ) ).toBe( 'original' );
		expect( await page.locator( '#owned-root' ).getAttribute( 'data-tocus-ui' ) ).toBeNull();
		expect( await page.locator( '#owned-portals' ).getAttribute( 'data-mantine-color-scheme' ) ).toBeNull();
	} );
	// Catches a stale system preference and color updates accidentally reaching another provider.
	test( 'responds to system color changes within one provider', async ( { page } ) => {
		await page.emulateMedia( { colorScheme: TocusAppearance.LIGHT } );
		await page.goto( `${ url }?appearance=${ TocusAppearance.SYSTEM }` );
		const save = page.getByRole( 'button', { name: 'Save', exact: true } );
		await save.waitFor( { timeout: 1500 } );
		const light = await save.evaluate( ( element ) => getComputedStyle( element ).backgroundColor );
		const compact = page.getByRole( 'button', { name: 'Compact action' } );
		const other = await compact.evaluate( ( element ) => getComputedStyle( element ).backgroundColor );
		await page.emulateMedia( { colorScheme: TocusAppearance.DARK } );
		await expect.poll( () => save.evaluate(
			( element ) => getComputedStyle( element ).backgroundColor,
		) ).not.toBe( light );
		expect( await compact.evaluate( ( element ) => getComputedStyle( element ).backgroundColor ) ).toBe( other );
		expect( await page.evaluate( () => localStorage.length ) ).toBe( 0 );
	} );
	test( 'styles an explicit portal target without a separate root', async ( { page } ) => {
		await page.goto( `${ url }?ownership=1&target-only=1` );
		const field = page.getByRole( 'textbox', { name: 'Owned field' } );
		await field.waitFor( { timeout: 1500 } );
		expect( await field.evaluate( ( element ) => getComputedStyle( element ).borderStyle ) ).toBe( 'solid' );
	} );
} );
