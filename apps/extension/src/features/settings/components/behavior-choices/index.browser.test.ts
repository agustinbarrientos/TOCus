import { expect } from '@playwright/test';
import { SettingsDestination } from '../../services/settings-navigation/types';
import { test } from '../../utils/browser-test-harness';

test.describe( 'behavior choices', () => {
	test( 'makes descriptionless timing choices compact, centered and fully clickable', async ( { open } ) => {
		const page = await open();
		const choices = page.locator( '.settings-behavior-choices' );
		const cards = choices.locator( '.tocus-choice-radio' );
		await expect( cards ).toHaveCount( 2 );

		for ( const card of await cards.all() ) {
			const metrics = await card.evaluate( ( element ) => {
				const control = element.querySelector( '.mantine-Radio-inner' );
				const label = element.querySelector( '.mantine-Radio-label' );
				if ( ! control || ! label ) {
					throw new Error( 'Expected a complete behavior choice.' );
				}
				const cardBounds = element.getBoundingClientRect();
				const controlBounds = control.getBoundingClientRect();
				const labelBounds = label.getBoundingClientRect();
				return {
					height: cardBounds.height,
					controlCenter: controlBounds.top + controlBounds.height / 2 - cardBounds.top,
					labelCenter: labelBounds.top + labelBounds.height / 2 - cardBounds.top,
				};
			} );
			expect.soft( metrics.height ).toBe( 48 );
			expect.soft( Math.abs( metrics.controlCenter - metrics.height / 2 ) ).toBeLessThanOrEqual( 0.5 );
			expect( Math.abs( metrics.labelCenter - metrics.height / 2 ) ).toBeLessThanOrEqual( 0.5 );
		}

		const automatic = page.getByRole( 'radio', { name: 'Open the site automatically', exact: true } );
		const automaticCard = cards.filter( { has: automatic } );
		const bounds = await automaticCard.boundingBox();
		if ( ! bounds ) {
			throw new Error( 'Expected the automatic choice card to be visible.' );
		}
		await page.mouse.click( bounds.x + bounds.width - 4, bounds.y + bounds.height / 2 );
		await expect( automatic ).toBeChecked();

		const showContinue = page.getByRole( 'radio', { name: 'Show a Continue button', exact: true } );
		await automatic.focus();
		await page.keyboard.press( 'ArrowLeft' );
		await expect( showContinue ).toBeChecked();
		await expect( showContinue ).toBeFocused();
	} );

	test( 'keeps compact choices free of empty card space at a narrow viewport', async ( { open, page: browserPage } ) => {
		await browserPage.setViewportSize( { width: 390, height: 720 } );
		const page = await open();
		const cards = page.locator( '.settings-behavior-choices .tocus-choice-radio' );
		await expect( cards ).toHaveCount( 2 );
		const choiceWidth = await page.locator( '.settings-behavior-choices' ).evaluate( ( element ) =>
			element.getBoundingClientRect().width );
		expect( await cards.evaluateAll( ( elements ) => elements.map( ( element ) => ( {
			height: element.getBoundingClientRect().height,
			width: element.getBoundingClientRect().width,
		} ) ) ) ).toEqual( [
			{ height: 48, width: choiceWidth },
			{ height: 48, width: choiceWidth },
		] );
	} );

	test( 'preserves the height and top alignment of schedule choices with descriptions', async ( { open } ) => {
		const page = await open( SettingsDestination.SCHEDULE );
		const cards = page.locator( '.settings-behavior-choices .tocus-choice-radio' );
		await expect( cards ).toHaveCount( 2 );
		await expect( cards.locator( '.mantine-Radio-description' ) ).toHaveCount( 2 );

		for ( const card of await cards.all() ) {
			const metrics = await card.evaluate( ( element ) => {
				const control = element.querySelector( '.mantine-Radio-inner' );
				if ( ! control ) {
					throw new Error( 'Expected the schedule choice control.' );
				}
				const cardBounds = element.getBoundingClientRect();
				const controlBounds = control.getBoundingClientRect();
				const style = window.getComputedStyle( element );
				return {
					height: cardBounds.height,
					controlOffset: controlBounds.top - cardBounds.top,
					minHeight: style.minHeight,
					paddingBlock: [ style.paddingTop, style.paddingBottom ],
				};
			} );
			expect.soft( metrics.height ).toBeGreaterThanOrEqual( 72 );
			expect.soft( metrics.minHeight ).toBe( '72px' );
			expect.soft( metrics.paddingBlock ).toEqual( [ '11px', '11px' ] );
			expect( metrics.controlOffset ).toBe( 16 );
		}
	} );
} );
