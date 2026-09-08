import { SettingsDestination } from '../../../settings/services/settings-navigation/types';
import { describe, expect, it } from 'vitest';
import { chromium, firefox, webkit } from 'playwright';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { createSettingsBrowserHarness } from '../../../settings/utils/browser-test-harness';

const copy = TestEnglishLocalizationBundle.protectedSites;
const itemCopy = TestEnglishLocalizationBundle.protectedSiteItem;

describe.each( [ [ 'Chromium', chromium ], [ 'Firefox', firefox ], [ 'WebKit', webkit ] ] as const )(
	'%s website draft controls', ( _name, engine ) => {
		const { open } = createSettingsBrowserHarness( engine );

		it( 'shows granted browser access after saving and reopening Websites', async () => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			await page.getByLabel( copy.addressLabel, { exact: true } ).fill( 'example.com' );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByText( copy.saved, { exact: true } ).waitFor();
			const accessAction = page.getByRole( 'button', { name: itemCopy.allowAccess, exact: true } );
			expect( await accessAction.count() ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
			await page.getByRole( 'link', { name: 'About', exact: true } ).click();
			await page.getByRole( 'link', { name: copy.title, exact: true } ).click();
			await page.locator( '.settings-site-list > li' ).waitFor();
			expect( await accessAction.count() ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 1 );
			await page.close();
		}, 20000 );

		it( 'rejects unfinished invalid addresses without changing storage or requesting access', async () => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			const address = page.getByLabel( copy.addressLabel, { exact: true } );
			await address.fill( 'not a website' );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByRole( 'alert' ).waitFor();
			expect( await address.inputValue() ).toBe( 'not a website' );
			expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			await page.getByRole( 'button', { name: copy.discard, exact: true } ).click();
			expect( await address.inputValue() ).toBe( '' );
			await page.close();
		}, 20000 );

		it( 'stages multiple additions without writes or permission requests and discards all of them', async () => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			for ( const host of [ 'example.com', 'example.org' ] ) {
				await page.getByLabel( copy.addressLabel, { exact: true } ).fill( host );
				await page.getByRole( 'button', { name: copy.addSite, exact: true } ).click();
			}
			expect( await page.locator( '.settings-site-list > li' ).count() ).toBe( 2 );
			expect( await page.evaluate( () => window.settingsTest.controls.writes ) ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.controls.requests ) ).toBe( 0 );
			await page.getByRole( 'button', { name: copy.discard, exact: true } ).click();
			expect( await page.locator( '.settings-site-list > li' ).count() ).toBe( 0 );
			expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
			await page.close();
		}, 20000 );

		it( 'finishes the inline draft with Enter without persisting the page', async () => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			await page.getByLabel( copy.addressLabel, { exact: true } ).fill( 'example.com' );
			await page.getByRole( 'button', { name: copy.addSite, exact: true } ).click();
			const row = page.locator( '.settings-site-list > li' ).first();
			await row.getByRole( 'button', { name: itemCopy.edit, exact: true } ).click();
			const displayName = row.getByLabel( itemCopy.displayNameLabel, { exact: true } );
			await displayName.fill( 'Reading' );
			await displayName.press( 'Enter' );
			await displayName.waitFor( { state: 'hidden' } );
			expect( await row.getByRole( 'heading', { name: 'Reading', exact: true } ).count() ).toBe( 1 );
			expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites ) ).toEqual( [] );
			await page.close();
		}, 20000 );

		it( 'saves inline names and separate behavior, locks dirty schedule scope, and confirms removal', async () => {
			const page = await open( SettingsDestination.PROTECTED_SITES );
			await page.getByLabel( copy.addressLabel, { exact: true } ).fill( 'example.com' );
			await page.getByRole( 'button', { name: copy.addSite, exact: true } ).click();
			const row = page.locator( '.settings-site-list > li' ).first();
			await row.getByRole( 'button', { name: itemCopy.edit, exact: true } ).click();
			const displayName = row.getByLabel( itemCopy.displayNameLabel, { exact: true } );
			await expect.poll( () => displayName.evaluate(
				( element ) => document.activeElement === element,
			) ).toBe( true );
			await displayName.fill( 'Reading' );
			await row.getByRole( 'button', { name: itemCopy.useAutomaticName, exact: true } ).click();
			expect( await displayName.inputValue() ).toBe( '' );
			expect( await displayName.evaluate( ( element ) => document.activeElement === element ) ).toBe( true );
			await displayName.fill( 'Reading' );
			await row.getByRole( 'radio', { name: itemCopy.independentBehavior, exact: true } ).click();
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await page.getByText( copy.saved, { exact: true } ).waitFor();
			const site = await page.evaluate( () => window.settingsTest.getConfiguration().sites[ 0 ] );
			expect( site?.displayNameOverride ).toBe( 'Reading' );
			expect( site?.rule.scopeId ).not.toBe( DefaultProtectionScopeId );
			await page.getByRole( 'link', { name: TestEnglishLocalizationBundle.schedule.title, exact: true } ).click();
			const schedule = TestEnglishLocalizationBundle.schedule;
			await page.getByRole( 'radio', { name: schedule.customLabel, exact: true } ).click();
			expect( await page.locator( '#schedule-scope' ).isDisabled() ).toBe( true );
			await page.getByRole( 'button', { name: schedule.discard, exact: true } ).click();
			expect( await page.locator( '#schedule-scope' ).isDisabled() ).toBe( false );
			await page.getByRole( 'link', { name: copy.title, exact: true } ).click();
			await row.getByRole( 'button', { name: itemCopy.edit, exact: true } ).click();
			await row.getByRole( 'button', { name: itemCopy.removeSite, exact: true } ).click();
			await page.getByRole( 'dialog' ).getByRole( 'button', { name: itemCopy.confirmRemove, exact: true } ).click();
			expect( await page.evaluate( () => window.settingsTest.getConfiguration().sites.length ) ).toBe( 1 );
			await page.getByRole( 'button', { name: copy.save, exact: true } ).click();
			await expect.poll( () => page.evaluate( () =>
				window.settingsTest.getConfiguration().sites.length ) ).toBe( 0 );
			await page.close();
		}, 20000 );
	},
);
