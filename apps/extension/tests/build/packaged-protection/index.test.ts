import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Worker } from 'playwright';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { type ExtensionManifest, type ExtensionWorkerGlobal } from './types';

describe( 'packaged Chrome protection', () => {
	let directory: string | undefined;
	let context: BrowserContext | undefined;
	let worker: Worker;

	beforeAll( async () => {
		directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-protection-' ) );
		const extensionPath = join( directory, 'extension' );

		await cp( fileURLToPath( new URL( '../../../.output/chrome-mv3/', import.meta.url ) ), extensionPath, { recursive: true } );
		const manifestPath = join( extensionPath, 'manifest.json' );
		const manifest = JSON.parse( await readFile( manifestPath, 'utf8' ) ) as ExtensionManifest;

		expect( manifest.permissions ).not.toContain( 'tabs' );
		expect( manifest.permissions ).not.toContain( 'history' );
		expect( manifest.optional_permissions ).not.toContain( 'tabs' );
		expect( manifest.optional_permissions ).not.toContain( 'history' );
		// Pregrant one synthetic website in the disposable installation without changing packaged scripts.
		manifest.permissions = [ ...manifest.permissions ?? [], ...manifest.optional_permissions ?? [] ];
		manifest.host_permissions = [ '*://*.example.test/*' ];
		delete manifest.optional_permissions;
		await writeFile( manifestPath, JSON.stringify( manifest ) );

		context = await chromium.launchPersistentContext( join( directory, 'profile' ), {
			channel: 'chromium',
			headless: true,
			args: [ `--disable-extensions-except=${ extensionPath }`, `--load-extension=${ extensionPath }` ],
		} );
		worker = context.serviceWorkers()[ 0 ] ?? await context.waitForEvent( 'serviceworker' );
		await context.route( 'https://example.test/**', ( route ) => route.fulfill( {
			contentType: 'text/html',
			body: '<!doctype html><html lang="en"><title>Example website</title><body><h1>Destination loaded</h1><input aria-label="Unfinished work" value="Keep this text"></body></html>',
		} ) );
	}, 15_000 );

	afterAll( async () => {
		await context?.close();
		if ( directory !== undefined ) {
			await rm( directory, { recursive: true, force: true } );
		}
	} );

	test( 'initializes the isolated protected-page listener without changing the website', async () => {
		if ( context === undefined ) {
			throw new Error( 'The disposable browser is unavailable.' );
		}
		const page = await context.newPage();

		try {
			await page.goto( 'https://example.test/' );
			const status = await worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				const tab = ( await chrome.tabs.query( {} ) ).find( ( candidate ) => candidate.url === 'https://example.test/' );

				if ( tab?.id === undefined ) {
					throw new Error( 'The synthetic website tab is unavailable.' );
				}
				await chrome.scripting.executeScript( { files: [ '/protected-page.js' ], target: { tabId: tab.id } } );
				const response: unknown = await chrome.tabs.sendMessage( tab.id, { type: 'get-protected-page-presentation-status' } );

				return response;
			} );

			expect( status ).toEqual( { allowanceWarningId: null, interruptionLayerPresented: false } );
			expect( await page.getByRole( 'textbox', { name: 'Unfinished work' } ).inputValue() ).toBe( 'Keep this text' );
			expect( page.url() ).toBe( 'https://example.test/' );
		} finally {
			await page.close();
		}
	} );

	test( 'keeps a redacted pause tab alive and opens its destination after Continue', async () => {
		if ( context === undefined ) {
			throw new Error( 'The disposable browser is unavailable.' );
		}
		await worker.evaluate( async () => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

			await chrome.storage.local.set( {
				'tocus.protection.configuration.v1': {
					schemaVersion: 3,
					sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: 'scope_default' } } ],
					timingConfiguration: { initialWaitMilliseconds: 10000, ladderIncreaseMilliseconds: 5000, maximumWaitMilliseconds: 60000, allowanceMilliseconds: 300000, completionAction: 'show-continue' },
					schedulesByScope: { scope_default: { mode: 'always' } },
					measurementRevisionsByScope: { scope_default: 'revision_packaged' },
				},
			} );
		} );
		await expect.poll( () => worker.evaluate( async () => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

			return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
		} ) ).toBeGreaterThan( 0 );
		const page = await context.newPage();

		try {
			await page.goto( 'https://example.test/' );
			await page.waitForURL( '**/interruption.html' );
			await page.bringToFront();
			const pauseTab = await worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				const contexts = await chrome.runtime.getContexts( { contextTypes: [ 'TAB' ] } );
				const pauseContext = contexts.find( ( candidate ) => candidate.documentUrl === chrome.runtime.getURL( '/interruption.html' ) );

				return ( await chrome.tabs.query( {} ) ).find( ( candidate ) => candidate.id === pauseContext?.tabId );
			} );

			expect( pauseTab ).toBeDefined();
			expect( pauseTab?.url ).toBeUndefined();
			expect( pauseTab?.pendingUrl ).toBeUndefined();
			const continueButton = page.getByRole( 'button', { name: 'Continue', exact: true } );

			await continueButton.waitFor( { state: 'visible', timeout: 15_000 } );
			await continueButton.click();
			await page.waitForURL( 'https://example.test/', { timeout: 5_000 } );
			expect( await page.getByRole( 'heading', { name: 'Destination loaded' } ).isVisible() ).toBe( true );
		} finally {
			await page.close();
		}
	}, 25_000 );
} );
