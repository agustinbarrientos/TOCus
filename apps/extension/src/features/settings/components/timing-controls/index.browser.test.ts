import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { createSettingsBrowserHarness } from '../../utils/browser-test-harness';

describe.each( [
	[ 'Chromium', chromium ],
	[ 'Firefox', firefox ],
	[ 'WebKit', webkit ],
] as const )( '%s native timing ranges', ( _name, engine ) => {
	const { open, setting } = createSettingsBrowserHarness( engine );

	it( 'exposes native bounds and localized values while keyboard changes update the draft', async () => {
		const page = await open();
		const initial = page.getByRole( 'slider' ).first();
		await initial.waitFor();
		expect( await page.getByRole( 'slider' ).evaluateAll( ( sliders ) => sliders.map( ( slider ) => ( {
			native: slider instanceof HTMLInputElement && slider.type === 'range',
			min: slider.getAttribute( 'min' ), max: slider.getAttribute( 'max' ), step: slider.getAttribute( 'step' ),
		} ) ) ) ).toEqual( [
			{ native: true, min: '10', max: '30', step: '5' },
			{ native: true, min: '0', max: '5', step: '1' },
			{ native: true, min: '30', max: '120', step: '30' },
			{ native: true, min: '2', max: '20', step: '1' },
		] );
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
		await page.close();
	} );

	it( 'disables every range during persistence without allowing keyboard draft changes', async () => {
		const page = await open();
		const initial = page.getByRole( 'slider' ).first();
		await initial.press( 'ArrowRight' );
		await setting( page, 'holdConfigurationWrites', true );
		await page.getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect.poll( () => page.getByRole( 'slider' ).evaluateAll( ( sliders ) =>
			sliders.every( ( slider ) => slider instanceof HTMLInputElement && slider.disabled ) ) ).toBe( true );
		await initial.evaluate( ( input ) => {
			if ( input instanceof HTMLInputElement ) {
				input.focus();
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
		await page.close();
	} );
} );
