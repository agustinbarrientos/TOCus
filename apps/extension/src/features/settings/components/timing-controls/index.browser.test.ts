import { expect } from '@playwright/test';
import { test } from '../../utils/browser-test-harness';

test.describe( 'timing sliders', () => {
	test( 'preserves the maximum wait through hidden drafts and saved screen reopening', async ( { open } ) => {
		const page = await open();
		const maximum = page.getByRole( 'slider', { name: 'Maximum wait', exact: true } );
		const increase = page.getByRole( 'slider', { name: 'Wait increase', exact: true } );
		await maximum.press( 'End' );
		await maximum.press( 'ArrowLeft' );
		await expect( maximum ).toHaveAttribute( 'aria-valuenow', '90' );
		await increase.press( 'Home' );
		await expect( maximum ).toHaveCount( 0 );
		await expect( page.locator( '.settings-timing-range' ).filter( { hasText: 'Maximum wait' } ) ).toHaveCount( 0 );
		await expect( increase ).toBeFocused();
		await increase.press( 'ArrowRight' );
		await expect( maximum ).toHaveAttribute( 'aria-valuenow', '90' );
		await increase.press( 'Home' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration ) ).toMatchObject( {
			ladderIncreaseMilliseconds: 0, maximumWaitMilliseconds: 90000,
		} );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await expect( increase ).toHaveCount( 0 );
		await page.getByRole( 'link', { name: 'Pause timing', exact: true } ).click();
		await expect( increase ).toHaveAttribute( 'aria-valuenow', '0' );
		await expect( maximum ).toHaveCount( 0 );
		await increase.press( 'ArrowRight' );
		await expect( maximum ).toHaveAttribute( 'aria-valuenow', '90' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration ) ).toMatchObject( {
			ladderIncreaseMilliseconds: 1000, maximumWaitMilliseconds: 90000,
		} );
	} );
	test( 'keeps one field gap below aligned timing headers and behavior labels', async ( { open } ) => {
		const page = await open();
		await expect( page.getByRole( 'slider', { name: 'Initial wait', exact: true } ) ).toBeVisible();
		for ( const range of await page.locator( '.settings-timing-range' ).all() ) {
			const metrics = await range.evaluate( ( element ) => {
				const label = element.querySelector( '.tocus-field-label' );
				const help = element.querySelector( '.tocus-field-help' );
				const output = element.querySelector( 'output' );
				const slider = element.querySelector( '.mantine-Slider-root' );
				const header = slider?.previousElementSibling;
				if ( ! label || ! help || ! output || ! slider || ! header ) {
					throw new Error( 'Expected a complete timing header and slider.' );
				}
				const labelBounds = label.getBoundingClientRect();
				const helpBounds = help.getBoundingClientRect();
				const outputBounds = output.getBoundingClientRect();
				return {
					gap: slider.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
					labelCenter: labelBounds.top + labelBounds.height / 2,
					helpCenter: helpBounds.top + helpBounds.height / 2,
					outputCenter: outputBounds.top + outputBounds.height / 2,
				};
			} );
			expect.soft( metrics.gap ).toBe( 8 );
			expect( metrics.labelCenter ).toBeCloseTo( metrics.helpCenter, 1 );
			expect( metrics.labelCenter ).toBeCloseTo( metrics.outputCenter, 1 );
		}
		const choices = page.locator( '.settings-behavior-choices' );
		expect( await choices.evaluate( ( element ) => {
			const label = element.closest( '.settings-behavior-control' )?.querySelector( '.settings-behavior-label' );
			if ( ! label ) {
				throw new Error( 'Expected the behavior group label.' );
			}
			return element.getBoundingClientRect().top - label.getBoundingClientRect().bottom;
		} ) ).toBe( 8 );
	} );
	test( 'keeps question-circle help close to each label without shrinking its target', async ( { open } ) => {
		const page = await open();
		const ranges = page.locator( '.settings-timing-range' );
		await expect( ranges ).toHaveCount( 4 );
		for ( const range of await ranges.all() ) {
			const help = range.locator( '.tocus-field-help' );
			const label = await range.locator( '.tocus-field-label' ).boundingBox();
			const target = await help.boundingBox();
			if ( ! label || ! target ) {
				throw new Error( 'The timing label and help target must both be visible.' );
			}
			expect( target.x - label.x - label.width ).toBeGreaterThanOrEqual( 0 );
			expect( target.x - label.x - label.width ).toBeLessThanOrEqual( 5 );
			expect( target.width ).toBeGreaterThanOrEqual( 24 );
			expect( target.height ).toBeGreaterThanOrEqual( 24 );
			await expect( help.locator( 'svg path' ) ).toHaveCount( 1 );
			await expect( help.locator( 'svg path[opacity]' ) ).toHaveCount( 0 );
		}
	} );
	test( 'shows every selectable step and exposes help on keyboard focus without inline prose', async ( { open } ) => {
		const page = await open();
		const ranges = page.locator( '.settings-timing-range' );
		await expect( ranges ).toHaveCount( 4 );
		for ( const [ index, count ] of [ 5, 6, 4, 19 ].entries() ) {
			await expect( ranges.nth( index ).locator( '.mantine-Slider-mark' ) ).toHaveCount( count );
		}
		const help = ranges.first().getByRole( 'button', { name: 'Initial wait', exact: true } );
		await help.focus();
		await expect( page.getByRole( 'tooltip' ) ).toContainText( 'first' );
		await page.keyboard.press( 'Escape' );
		await expect( page.getByRole( 'tooltip' ) ).toBeHidden();
		await expect( ranges.first().locator( '> p' ) ).toHaveCount( 0 );
	} );
	test( 'exposes bounds and localized values while keyboard steps update the draft', async ( { open } ) => {
		const page = await open();
		const initial = page.getByRole( 'slider' ).first();
		await initial.waitFor();
		expect( await page.getByRole( 'slider' ).evaluateAll( ( sliders ) => sliders.map( ( slider ) => ( {
			min: slider.getAttribute( 'aria-valuemin' ), max: slider.getAttribute( 'aria-valuemax' ),
		} ) ) ) ).toEqual( [
			{ min: '10', max: '30' }, { min: '0', max: '5' },
			{ min: '30', max: '120' }, { min: '2', max: '20' },
		] );
		for ( const [ name, firstStep ] of [
			[ 'Initial wait', '15' ], [ 'Maximum wait', '60' ],
			[ 'Allowance', '3' ], [ 'Wait increase', '1' ],
		] as const ) {
			const slider = page.getByRole( 'slider', { name, exact: true } );
			await slider.press( 'Home' );
			await slider.press( 'ArrowRight' );
			await expect( slider ).toHaveAttribute( 'aria-valuenow', firstStep );
			await slider.press( 'Home' );
		}
		await initial.focus();
		await page.keyboard.press( 'ArrowRight' );
		expect( await initial.getAttribute( 'aria-valuenow' ) ).toBe( '15' );
		expect( await initial.getAttribute( 'aria-valuetext' ) ).toBe( '15 seconds' );
		await page.keyboard.press( 'End' );
		await page.keyboard.press( 'ArrowRight' );
		expect( await initial.getAttribute( 'aria-valuenow' ) ).toBe( '30' );
		await page.keyboard.press( 'Home' );
		await page.keyboard.press( 'ArrowLeft' );
		expect( await initial.getAttribute( 'aria-valuenow' ) ).toBe( '10' );
		const increase = page.getByRole( 'slider', { name: 'Wait increase', exact: true } );
		await increase.press( 'Home' );
		expect( await increase.getAttribute( 'aria-valuetext' ) ).toBe( '0 (no increase)' );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration.ladderIncreaseMilliseconds ) ).toBe( 0 );
	} );

	test( 'disables every range during persistence without allowing keyboard draft changes', async ( { open, setting } ) => {
		const page = await open();
		const sliders = page.getByRole( 'slider', { includeHidden: true } );
		const initial = sliders.first();
		await initial.press( 'ArrowRight' );
		await setting( page, 'holdConfigurationWrites', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( sliders ).toHaveCount( 4 );
		for ( const slider of await sliders.all() ) {
			await expect( slider ).toBeDisabled();
		}
		await initial.evaluate( ( element ) => {
			if ( element instanceof HTMLElement ) {
				element.focus();
			}
		} );
		await page.keyboard.press( 'End' );
		expect( await initial.getAttribute( 'aria-valuenow' ) ).toBe( '15' );
		await page.evaluate( () => {
			window.settingsTest.releaseConfigurationWrites();
		} );
		await expect.poll( () => initial.isEnabled() ).toBe( true );
		expect( await page.evaluate( () =>
			window.settingsTest.getConfiguration().timingConfiguration.initialWaitMilliseconds ) ).toBe( 15000 );
	} );
} );
