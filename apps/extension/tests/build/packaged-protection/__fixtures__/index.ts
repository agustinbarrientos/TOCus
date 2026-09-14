import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type BrowserContext } from '@playwright/test';
import type { ExtensionManifest, ExtensionWorkerGlobal, ProtectionTestFixtures } from '../types';

/**
 * Owns the complete lifetime of each disposable packaged extension, including failed setup.
 * @since 0.1.0 Initial implementation.
 */
export const test = base.extend<ProtectionTestFixtures>( {
	pregrantSite: [ true, { option: true } ],
	context: [ async ( { playwright, pregrantSite }, use ) => {
		const directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-protection-' ) );
		let context: BrowserContext | undefined;
		try {
			const extensionPath = join( directory, 'extension' );
			await cp( fileURLToPath( new URL( '../../../../.output/chrome-mv3/', import.meta.url ) ),
				extensionPath,
				{ recursive: true } );
			const manifestPath = join( extensionPath, 'manifest.json' );
			const manifest = JSON.parse( await readFile( manifestPath, 'utf8' ) ) as ExtensionManifest;
			expect( manifest.permissions ).not.toContain( 'tabs' );
			expect( manifest.permissions ).not.toContain( 'history' );
			expect( manifest.optional_permissions ).not.toContain( 'tabs' );
			expect( manifest.optional_permissions ).not.toContain( 'history' );
			if ( pregrantSite ) {
				// Only the disposable install grants the synthetic website; packaged scripts remain unchanged.
				manifest.permissions = [ ...manifest.permissions ?? [], ...manifest.optional_permissions ?? [] ];
				manifest.host_permissions = [ '*://*.example.test/*' ];
				delete manifest.optional_permissions;
				await writeFile( manifestPath, JSON.stringify( manifest ) );
			}
			context = await playwright.chromium.launchPersistentContext( join( directory, 'profile' ), {
				channel: 'chromium',
				headless: true,
				// Leave time for fixture cleanup if browser acquisition fails.
				timeout: 10_000,
				args: [ `--disable-extensions-except=${ extensionPath }`, `--load-extension=${ extensionPath }` ],
			} );
			await context.route( /^https?:\/\//u, ( route ) => route.abort() );
			await context.route( 'https://example.test/**', ( route ) => route.fulfill( {
				contentType: 'text/html',
				body: '<!doctype html><html lang="en"><title>Example website</title><body><h1>Destination loaded</h1><input aria-label="Unfinished work" value="Keep this text"></body></html>',
			} ) );
			await use( context );
		} finally {
			try {
				await context?.close();
			} finally {
				await rm( directory, { recursive: true, force: true } );
			}
		}
	}, { scope: 'test', timeout: 20_000 } ],
	/**
	 * Waits for the real first-install page before the test begins a focus-sensitive journey.
	 * @param fixtures - This test's isolated extension context.
	 * @param fixtures.context - Persistent context owned by the fixture lifecycle.
	 * @param use - Runs the test with its ready worker.
	 */
	worker: async ( { context }, use ) => {
		const worker = context.serviceWorkers()[ 0 ] ?? await context.waitForEvent( 'serviceworker' );
		await test.step( 'Wait for the installed extension to finish opening onboarding', async () => {
			const onboardingUrl = await worker.evaluate( () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				return chrome.runtime.getURL( '/onboarding.html' );
			} );
			// A late first-install tab would steal attention during a real focused breathing wait.
			await expect.poll( () => context.pages().some( ( page ) => page.url() === onboardingUrl ) ).toBe( true );
		}, { timeout: 10_000 } );
		await use( worker );
	},
	/**
	 * Resolves document URLs from the current installation rather than a cached extension ID.
	 * @param fixtures - This test's initialized extension worker.
	 * @param fixtures.worker - Service worker of the disposable installation.
	 * @param use - Runs the test with its packaged document root.
	 */
	extensionRoot: async ( { worker }, use ) => {
		await use( await worker.evaluate( () => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			return chrome.runtime.getURL( '/' );
		} ) );
	},
} );

export { expect } from '@playwright/test';
