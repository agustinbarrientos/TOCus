import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { registerOnboardingOpenOnInstall } from './index';

describe( 'registerOnboardingOpenOnInstall', () => {
	beforeEach( () => {
		fakeBrowser.reset();
		vi.restoreAllMocks();
	} );

	it( 'opens onboarding after the extension is installed for the first time', async () => {
		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );

		await fakeBrowser.runtime.onInstalled.trigger( { reason: 'install' } );

		await vi.waitFor( async () => {
			const tabs = await fakeBrowser.tabs.query( {} );

			expect( tabs ).toContainEqual( expect.objectContaining( {
				url: 'chrome-extension://test-extension-id/onboarding.html',
			} ) );
		} );
	} );

	it( 'does not open onboarding after an extension update', async () => {
		const tabsBeforeUpdate = await fakeBrowser.tabs.query( {} );

		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );
		await fakeBrowser.runtime.onInstalled.trigger( {
			previousVersion: '0.0.0',
			reason: 'update',
		} );

		expect( await fakeBrowser.tabs.query( {} ) ).toEqual( tabsBeforeUpdate );
	} );

	it( 'retries a transient onboarding tab failure during first installation', async () => {
		vi.spyOn( fakeBrowser.tabs, 'create' ).mockRejectedValueOnce( new Error( 'Tab creation failed.' ) );

		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );

		await expect(
			fakeBrowser.runtime.onInstalled.trigger( { reason: 'install' } ),
		).resolves.toEqual( [ undefined ] );

		await vi.waitFor( async () => {
			const tabs = await fakeBrowser.tabs.query( {} );

			expect( tabs ).toContainEqual( expect.objectContaining( {
				url: 'chrome-extension://test-extension-id/onboarding.html',
			} ) );
		} );
	} );

	it( 'retries an unfinished onboarding open when the background starts again', async () => {
		vi.spyOn( fakeBrowser.tabs, 'create' ).mockRejectedValue( new Error( 'Tab creation failed.' ) );

		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );
		await fakeBrowser.runtime.onInstalled.trigger( { reason: 'install' } );
		await vi.waitFor( () => {
			expect( fakeBrowser.tabs.create ).toHaveBeenCalledTimes( 2 );
		} );
		vi.mocked( fakeBrowser.tabs.create ).mockRestore();

		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );

		await vi.waitFor( async () => {
			const tabs = await fakeBrowser.tabs.query( {} );

			expect( tabs ).toContainEqual( expect.objectContaining( {
				url: 'chrome-extension://test-extension-id/onboarding.html',
			} ) );
		} );
	} );

	it( 'opens onboarding directly when local recovery cannot be persisted', async () => {
		vi.spyOn( fakeBrowser.storage.local, 'set' ).mockRejectedValueOnce( new Error( 'Storage unavailable.' ) );

		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );
		await fakeBrowser.runtime.onInstalled.trigger( { reason: 'install' } );

		await vi.waitFor( async () => {
			const tabs = await fakeBrowser.tabs.query( {} );

			expect( tabs ).toContainEqual( expect.objectContaining( {
				url: 'chrome-extension://test-extension-id/onboarding.html',
			} ) );
		} );
	} );

	it( 'contains a recovery read failure without creating an unrelated tab', async () => {
		const tabsBeforeRegistration = await fakeBrowser.tabs.query( {} );
		const storageGet = vi.spyOn( fakeBrowser.storage.local, 'get' )
			.mockRejectedValueOnce( new Error( 'Storage unavailable.' ) );

		registerOnboardingOpenOnInstall( { browser: fakeBrowser } );
		await vi.waitFor( () => {
			expect( storageGet ).toHaveBeenCalledOnce();
		} );

		expect( await fakeBrowser.tabs.query( {} ) ).toEqual( tabsBeforeRegistration );
	} );
} );
