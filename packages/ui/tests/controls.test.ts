import { test, expect } from '@playwright/test';
import { TocusAppearance, TocusPalette } from '../src/types';
import { FixtureFrequency, FixtureMediaMode } from './fixture/types';
import { measureContrast } from './utils/measure-contrast';

const url = '/packages/ui/tests/fixture/';

test.describe( 'shared controls', () => {
	test( 'keeps labels and notices at body size with a clear field gap', async ( { page } ) => {
		await page.goto( url );
		const input = page.getByRole( 'textbox', { name: 'Title', exact: true } );
		await expect( input ).toBeVisible();
		const metrics = await input.evaluate( ( element ) => {
			const wrapper = element.closest( '.mantine-InputWrapper-root' );
			const label = wrapper?.querySelector( 'label' );
			const notice = document.querySelector( '.mantine-Alert-message' );
			if ( ! wrapper || ! label || ! notice ) {
				throw new Error( 'Expected a labelled field and a notice.' );
			}
			return { body: getComputedStyle( wrapper ).fontSize,
				label: getComputedStyle( label ).fontSize, notice: getComputedStyle( notice ).fontSize,
				gap: element.getBoundingClientRect().top - label.getBoundingClientRect().bottom };
		} );
		expect( metrics.label ).toBe( metrics.body );
		expect( metrics.notice ).toBe( metrics.body );
		expect( metrics.gap ).toBeGreaterThanOrEqual( 8 );
	} );
	test( 'honors small actions without shrinking normal actions or slider hit targets', async ( { page } ) => {
		await page.goto( url );
		const small = page.getByRole( 'button', { name: 'Small action', exact: true } );
		const extraSmall = page.getByRole( 'button', { name: 'Extra small action', exact: true } );
		const normal = page.getByRole( 'button', { name: 'Native action', exact: true } );
		await expect( small ).toBeVisible();
		const smallBounds = await small.boundingBox();
		const normalBounds = await normal.boundingBox();
		expect.soft( smallBounds?.height ).toBeLessThan( normalBounds?.height ?? 0 );
		expect.soft( ( await extraSmall.boundingBox() )?.height ).toBeLessThan( smallBounds?.height ?? 0 );
		const sizes = [];
		for ( const button of [ extraSmall, small, normal ] ) {
			sizes.push( await button.evaluate( ( element ) => {
				const style = getComputedStyle( element );
				return { padding: parseFloat( style.paddingInlineStart ), font: parseFloat( style.fontSize ) };
			} ) );
		}
		expect.soft( sizes[ 0 ]?.padding ).toBeLessThan( sizes[ 1 ]?.padding ?? 0 );
		expect.soft( sizes[ 1 ]?.padding ).toBeLessThan( sizes[ 2 ]?.padding ?? 0 );
		expect.soft( sizes[ 0 ]?.font ).toBeLessThan( sizes[ 1 ]?.font ?? 0 );
		const thumb = page.getByRole( 'slider', { name: 'Initial wait' } );
		expect( await thumb.evaluate( ( element ) => element.getBoundingClientRect().width ) ).toBe( 24 );
		const marks = page.locator( '.mantine-Slider-mark' );
		await expect( marks ).toHaveCount( 5 );
		for ( const mark of await marks.all() ) {
			const metrics = await mark.evaluate( ( element ) => ( {
				diameter: element.getBoundingClientRect().width, opacity: getComputedStyle( element ).opacity,
			} ) );
			expect( metrics.diameter ).toBeCloseTo( 8 / 3, 2 );
			expect( metrics.opacity ).toBe( '0.5' );
		}
	} );
	test( 'leaves website artwork without an added surface or rounded clipping', async ( { page } ) => {
		await page.goto( url );
		const icon = page.getByRole( 'img', { name: 'Website icon', exact: true } );
		await expect( icon ).toBeVisible();
		expect( await icon.evaluate( ( element ) => {
			const avatar = element.closest( '.mantine-Avatar-root' );
			return avatar && getComputedStyle( avatar ).backgroundColor;
		} ) ).toBe( 'rgba(0, 0, 0, 0)' );
		await expect( icon ).toHaveCSS( 'background-color', 'rgba(0, 0, 0, 0)' );
		await expect( icon ).toHaveCSS( 'border-radius', '0px' );
		expect( await icon.evaluate( ( element ) => {
			const avatar = element.closest( '.mantine-Avatar-root' );
			return avatar && getComputedStyle( avatar ).borderRadius;
		} ) ).toBe( '0px' );
	} );
	test( 'gives missing and unavailable avatar initials a readable fallback surface', async ( { page } ) => {
		await page.goto( url );
		for ( const name of [ 'Native initials', 'Default initials', 'Unavailable website icon' ] ) {
			const avatar = page.getByRole( 'img', { name, exact: true } );
			const placeholder = avatar.locator( '.mantine-Avatar-placeholder' );
			await expect( placeholder ).toHaveText( 'TC' );
			await expect( avatar ).toHaveCSS( 'background-color', 'rgba(0, 0, 0, 0)' );
			await expect.soft( placeholder ).not.toHaveCSS( 'background-color', 'rgba(0, 0, 0, 0)' );
			await expect( avatar ).not.toHaveCSS( 'border-radius', '0px' );
			await expect( placeholder ).not.toHaveCSS( 'border-radius', '0px' );
		}
	} );
	test( 'renders the supplied native select arrow without losing keyboard selection or field geometry', async ( { page } ) => {
		await page.goto( url );
		const select = page.getByRole( 'combobox', { name: 'Native interval', exact: true } );
		await expect( select ).toBeVisible();
		const arrow = select.locator( '..' ).locator( '.tocus-select-chevron' );
		await expect( arrow.locator( 'svg' ) ).toBeVisible();
		await expect( arrow ).toHaveAttribute( 'aria-hidden', 'true' );
		expect( await select.evaluate( ( element ) => {
			const bounds = element.getBoundingClientRect();
			const arrowBounds = element.parentElement?.querySelector( '.tocus-select-chevron' )?.getBoundingClientRect();
			return element instanceof HTMLSelectElement && getComputedStyle( element ).appearance === 'none'
				&& bounds.height === 48 && arrowBounds !== undefined && arrowBounds.width > 0
				&& arrowBounds.left >= bounds.left && arrowBounds.right <= bounds.right
				&& arrowBounds.top >= bounds.top && arrowBounds.bottom <= bounds.bottom;
		} ) ).toBe( true );
		await select.focus();
		// Native typeahead remains keyboard-operable without requiring an OS-owned popup in headless browsers.
		await page.keyboard.press( 'w' );
		await expect( select ).toHaveValue( FixtureFrequency.WEEKLY );
	} );
	test( 'renders the supplied loading artwork with custom sizing, color, ref and reduced motion', async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'no-preference' } );
		await page.goto( url );
		const loader = page.locator( '.fixture-loader' );
		const spinner = loader.locator( '.tocus-icon svg' );
		await expect( spinner ).toBeVisible();
		await expect( loader ).toHaveAttribute( 'data-ref-attached', 'true' );
		const presentation = await loader.evaluate( ( element ) => {
			const bounds = element.getBoundingClientRect();
			const style = getComputedStyle( element );
			return { width: bounds.width, height: bounds.height, margin: style.marginLeft, color: style.color };
		} );
		expect( presentation ).toMatchObject( { margin: '7px', color: 'rgb(12, 34, 56)' } );
		expect( presentation.width ).toBeCloseTo( 36.8, 1 );
		expect( presentation.height ).toBeCloseTo( 36.8, 1 );
		const initialTransform = await spinner.evaluate( ( element ) => getComputedStyle( element ).transform );
		await expect.poll( () => spinner.evaluate( ( element ) => getComputedStyle( element ).transform ) )
			.not.toBe( initialTransform );
		await expect( page.getByRole( 'button', { name: 'Loading action', exact: true } ).locator( '.tocus-icon svg' ) ).toBeVisible();
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await expect.poll( () => spinner.evaluate( ( element ) => getComputedStyle( element ).animationName ) ).toBe( 'none' );
		await expect( spinner ).toBeVisible();
	} );
	test( 'keeps the supplied loader visible and motionless inside a strict-CSP shadow provider', async ( { page } ) => {
		await page.goto( `${ url }shadow.html` );
		const spinner = page.locator( '.fixture-loader .tocus-icon svg' );
		await expect( spinner ).toBeVisible();
		expect( await spinner.evaluate( ( element ) => {
			const bounds = element.getBoundingClientRect();
			const style = getComputedStyle( element );
			return { width: bounds.width, height: bounds.height, color: style.color, animation: style.animationName };
		} ) ).toEqual( { width: 32, height: 32, color: 'rgb(12, 34, 56)', animation: 'none' } );
	} );
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
	test( 'keeps adjacent notices readable without adding margins to their section gap', async ( { page } ) => {
		await page.goto( url );
		const error = page.getByRole( 'alert' ).filter( { hasText: 'Could not save' } );
		await expect( error ).toBeVisible();
		const geometry = await error.evaluate( ( element ) => {
			const previous = element.previousElementSibling;
			const next = element.nextElementSibling;
			const label = document.querySelector( '.mantine-InputWrapper-label' );
			if ( ! previous || ! next || ! label ) {
				throw new Error( 'Expected adjacent native, error and success feedback plus a field label.' );
			}
			const bounds = element.getBoundingClientRect();
			return {
				gaps: [ bounds.top - previous.getBoundingClientRect().bottom,
					next.getBoundingClientRect().top - bounds.bottom ],
				fonts: [ previous, element, next ].map( ( notice ) => getComputedStyle( notice ).fontSize ),
				labelFont: getComputedStyle( label ).fontSize,
			};
		} );
		for ( const gap of geometry.gaps ) {
			expect( gap ).toBeCloseTo( 24, 2 );
		}
		expect( geometry.fonts ).toEqual( [ geometry.labelFont, geometry.labelFont, geometry.labelFont ] );
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
	// Each theme gets an isolated case and budget, not twelve navigations inside one timeout.
	for ( const appearance of [ TocusAppearance.LIGHT, TocusAppearance.DARK ] ) {
		for ( const palette of Object.values( TocusPalette ) ) {
			test( `keeps semantic text legible in ${ appearance }/${ palette } across interaction states`, async ( { page, browserName } ) => {
				const tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
				await page.goto( `${ url }?appearance=${ appearance }&palette=${ palette }` );
				await expect( page.getByRole( 'button', { name: 'Save', exact: true } ) ).toBeVisible( { timeout: 1500 } );
				const surfaces = page.locator( '[data-contrast]' );
				// Read resting colors together, before hover/focus can contaminate the next surface.
				const resting = await surfaces.evaluateAll( measureContrast );
				expect( resting.map( ( result ) => result.label ) ).toEqual( [
					'Save', 'Discard', 'Delete', 'Unavailable', 'Current page',
					'Could not save', 'Saved successfully', 'Review browser access', 'Stored on this device',
				] );
				expect( resting.filter( ( result ) => result.focusable ).map( ( result ) => result.label ) ).toEqual( [
					'Save', 'Discard', 'Delete', 'Current page',
				] );
				expect( new Set( resting.map( ( result ) => result.background ) ).size ).toBeGreaterThanOrEqual( 5 );
				for ( const [ index, result ] of resting.entries() ) {
					expect( result.ratio, `${ result.label }/normal` ).toBeGreaterThanOrEqual( 4.5 );
					const surface = surfaces.nth( index );
					await surface.hover();
					const [ hovered ] = await surface.evaluateAll( measureContrast );
					expect( hovered?.ratio, `${ result.label }/hover` ).toBeGreaterThanOrEqual( 4.5 );
					// Notices and disabled controls cannot receive native focus; do not fake that state.
					if ( result.focusable ) {
						await page.mouse.move( 0, 0 );
						await surface.focus();
						await page.keyboard.press( `Shift+${ tabKey }` );
						await page.keyboard.press( tabKey );
						await expect( surface ).toBeFocused();
						const [ focused ] = await surface.evaluateAll( measureContrast );
						expect( focused?.ratio, `${ result.label }/keyboard focus` ).toBeGreaterThanOrEqual( 4.5 );
						await surface.evaluate( ( element ) => {
							( element as HTMLElement ).blur();
						} );
					}
				}
				expect( await page.locator( 'html' ).getAttribute( 'data-mantine-color-scheme' ) ).toBeNull();
				expect( await page.evaluate( () => localStorage.length ) ).toBe( 0 );
			} );
		}
	}
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
