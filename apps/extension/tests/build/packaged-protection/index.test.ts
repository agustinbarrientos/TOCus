import type { Route, Worker } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { expect, test } from './__fixtures__';
import type { ExtensionWorkerGlobal } from './types';
import { DefaultPreferencesDocument, Language } from '../../../src/domains/preferences/types';
import { TestEmptyProtectionConfiguration } from '../../../src/domains/protection/types/__fixtures__';
import { StoredDurableProtectionStateSchema, type StoredDurableProtectionState } from '../../../src/domains/protection/types/stored-protection-state';
import { ProtectionStorageEnvelopeSchema } from '../../../src/domains/protection/services/protection-storage/types';
import { createMockStatisticsDocument } from '../../../src/domains/statistics/types/__fixtures__/statistics-document';
import { DefaultProtectionScopeId } from '../../../src/domains/protection/types/protection-value';

/**
 * Identifies packaged chart code independently of generated chunk names.
 * @param extensionRoot - Root URL of the current disposable extension installation.
 * @return URLs of every emitted JavaScript module containing the chart renderer.
 */
async function readChartModuleUrls( extensionRoot: string ): Promise<string[]> {
	const output = new URL( '../../../.output/chrome-mv3/', import.meta.url );
	const paths = ( await readdir( output, { recursive: true } ) ).filter( ( path ) => path.endsWith( '.js' ) );
	const modules = await Promise.all( paths.map( async ( path ) => ( {
		path,
		code: await readFile( new URL( path, output ), 'utf8' ),
	} ) ) );
	const chartModules = modules.filter( ( module ) => module.code.includes( 'recharts-wrapper' ) );
	expect( chartModules.length, 'The packaged extension must contain its real chart renderer.' ).toBeGreaterThan( 0 );
	return chartModules.map( ( module ) => new URL( module.path, extensionRoot ).href );
}

/**
 * Reads the authoritative durable document from the disposable extension worker.
 * @param worker - Worker running the packaged extension.
 * @return The validated durable protection state without its storage envelope.
 * @since 0.1.0 Initial implementation.
 */
async function readDurableState( worker: Worker ): Promise<StoredDurableProtectionState> {
	const envelope = await worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		const values = await chrome.storage.local.get( 'tocus.protection.durable.v1' );

		return values[ 'tocus.protection.durable.v1' ];
	} );

	return StoredDurableProtectionStateSchema.parse( ProtectionStorageEnvelopeSchema.parse( envelope ).document );
}

/**
 * Reads native tab mute state from the packaged extension's browser API.
 * @param worker - Worker running the packaged extension.
 * @param url - Exact synthetic destination identifying the tab.
 * @return Whether the browser currently mutes the destination tab.
 * @since 0.1.0 Initial implementation.
 */
async function readTabMuted( worker: Worker, url: string ): Promise<boolean> {
	return worker.evaluate( async ( destination ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		const tab = ( await chrome.tabs.query( {} ) ).find( ( candidate ) => candidate.url === destination );

		if ( tab?.mutedInfo === undefined ) {
			throw new Error( 'The synthetic website tab mute state is unavailable.' );
		}
		return tab.mutedInfo.muted;
	}, url );
}

test.describe( 'packaged Settings loading', () => {
	test.use( { pregrantSite: false } );
	test.beforeEach( async ( { worker } ) => {
		const totals = {
			estimatedReclaimedMilliseconds: 120_000,
			focusedPauseMilliseconds: 60_000,
			reconsideredVisitCount: 1,
			completedWaitCount: 1,
			allowanceGrantedCount: 1,
		};
		await worker.evaluate( async ( seed ) => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			await chrome.storage.local.set( seed );
		}, {
			'tocus.preferences.v1': { ...DefaultPreferencesDocument, language: Language.ENGLISH },
			'tocus.protection.configuration.v1': TestEmptyProtectionConfiguration,
			'tocus.statistics.v1': {
				...createMockStatisticsDocument(),
				firstRecordedDate: '2026-09-16',
				dailyTotals: [ { date: '2026-09-16', ...totals } ],
				scopes: { [ DefaultProtectionScopeId ]: { totals } },
			},
		} );
	} );

	test( 'loads chart code only after navigating to Statistics', async ( { page, extensionRoot } ) => {
		const chartModules = await readChartModuleUrls( extensionRoot );
		const requests = new Set<string>();
		const errors: string[] = [];
		page.on( 'request', ( request ) => requests.add( request.url() ) );
		page.on( 'pageerror', ( error ) => errors.push( error.message ) );

		await test.step( 'Open and navigate ordinary Settings without requesting chart code', async () => {
			await page.goto( new URL( 'options.html#about', extensionRoot ).href );
			await expect( page.getByRole( 'heading', { level: 1, name: 'About', exact: true } ) ).toBeVisible();
			await page.getByRole( 'link', { name: 'Appearance', exact: true } ).click();
			await expect( page.getByRole( 'heading', { level: 1, name: 'Appearance', exact: true } ) ).toBeVisible();
			expect( chartModules.filter( ( url ) => requests.has( url ) ) ).toEqual( [] );
		} );

		await test.step( 'Request the packaged chart and render its local statistics on navigation', async () => {
			await page.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
			await expect( page ).toHaveURL( /#statistics$/u );
			await expect( page.getByRole( 'heading', { level: 1, name: 'Statistics', exact: true } ) ).toBeVisible();
			await expect( page.locator( '.recharts-wrapper svg.recharts-surface' ) ).toBeVisible();
			await expect( page.locator( '.settings-statistics-estimate dd' ) ).toHaveText( 'Approximately 3 minutes' );
			expect( chartModules.filter( ( url ) => requests.has( url ) ) ).toEqual( chartModules );
			expect( errors ).toEqual( [] );
		} );
	} );

	test( 'loads Statistics directly from its Settings URL', async ( { page, extensionRoot } ) => {
		const errors: string[] = [];
		page.on( 'pageerror', ( error ) => errors.push( error.message ) );
		await test.step( 'Open the direct Statistics URL and render its chart', async () => {
			await page.goto( new URL( 'options.html#statistics', extensionRoot ).href );
			await expect( page.getByRole( 'heading', { level: 1, name: 'Statistics', exact: true } ) ).toBeVisible();
			await expect( page.getByRole( 'link', { name: 'Statistics', exact: true } ) ).toHaveAttribute( 'aria-current', 'page' );
			await expect( page.locator( '.recharts-wrapper svg.recharts-surface' ) ).toBeVisible();
			await expect( page.locator( '.settings-statistics-estimate dd' ) ).toHaveText( 'Approximately 3 minutes' );
			expect( errors ).toEqual( [] );
		} );
	} );
} );

test.describe( 'packaged Chrome protection', () => {
	test( 'saves website changes through the departure dialog using the native permission API', async ( { page, worker, extensionRoot } ) => {
		await page.goto( new URL( 'options.html#protected-sites', extensionRoot ).href );
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'example.test' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await page.getByLabel( 'Website address', { exact: true } ).fill( 'https://example.test/again' );
		await page.getByRole( 'button', { name: 'Add site', exact: true } ).click();
		await page.evaluate( () => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			const request = chrome.permissions.request.bind( chrome.permissions );
			// Observe the native API without replacing its permission decision or asynchronous result.
			chrome.permissions.request = ( permissions ) => {
				document.documentElement.dataset.permissionRequest = JSON.stringify( permissions );
				document.documentElement.dataset.permissionActivation = String( navigator.userActivation.isActive );
				return request( permissions );
			};
		} );
		await page.getByRole( 'link', { name: 'About', exact: true } ).click();
		await page.getByRole( 'dialog' ).getByRole( 'button', { name: 'Save', exact: true } ).click();
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-permission-activation', 'true' );
		expect( JSON.parse( await page.locator( 'html' ).getAttribute( 'data-permission-request' ) ?? '{}' ) )
			.toEqual( { permissions: [ 'webNavigation' ], origins: [ '*://example.test/*' ] } );
		await expect( page ).toHaveURL( /#about$/u );
		const stored = await worker.evaluate( async () => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			return ( await chrome.storage.local.get( 'tocus.protection.configuration.v1' ) )[ 'tocus.protection.configuration.v1' ];
		} );
		expect( stored ).toMatchObject( {
			sites: [ { identityHost: 'example.test', rule: {
				host: 'example.test', includeSubdomains: false, scopeId: DefaultProtectionScopeId,
			} } ],
		} );
	} );

	for ( const entry of [ 'popup.html', 'options.html', 'onboarding.html' ] ) {
		test( `opens packaged ${ entry } without preload-world warnings or script errors`, async ( { context, extensionRoot } ) => {
			const page = await context.newPage();
			const failures: string[] = [];
			const log = await context.newCDPSession( page );
			await log.send( 'Log.enable' );
			log.on( 'Log.entryAdded', ( { entry: browserLog } ) => {
				if ( /preload|cross-world/iu.test( browserLog.text ) && [ 'warning', 'error' ].includes( browserLog.level ) ) {
					failures.push( browserLog.text );
				}
			} );
			page.on( 'pageerror', ( error ) => failures.push( error.message ) );
			page.on( 'console', ( message ) => {
				if ( /preload|cross-world/iu.test( message.text() ) && [ 'warning', 'error' ].includes( message.type() ) ) {
					failures.push( message.text() );
				}
			} );
			try {
				await page.goto( new URL( entry, extensionRoot ).href );
				await page.getByText( 'TOCus', { exact: true } ).first().waitFor();
				await page.waitForTimeout( 500 );
				expect( await page.locator( 'link[rel="modulepreload"]' ).count() ).toBe( 0 );
				expect( failures ).toEqual( [] );
			} finally {
				await page.close();
			}
		} );
	}

	test( 'initializes the isolated protected-page listener without changing the website', async ( { context, worker } ) => {
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

	for ( const clickLink of [ false, true ] ) {
		test( `opens the breathing screen from a loading allowed page via ${ clickLink ? 'a link' : 'direct navigation' }`, async ( { context, worker, page } ) => {
			const allowedUrl = 'https://allowed.test/loading';
			const pendingResourceUrl = 'https://allowed.test/pending.js';
			const destination = 'https://example.test/from-loading-page';
			let releasePendingResource: ( () => void ) | undefined;
			const pendingResource = new Promise<void>( ( resolve ) => {
				releasePendingResource = resolve;
			} );
			let resourceRequested = false;
			let allowedRequests = 0;
			await context.route( allowedUrl, ( route ) => {
				allowedRequests += 1;
				return route.fulfill( {
					contentType: 'text/html',
					body: `<!doctype html><html lang="en"><title>Allowed website</title><body><h1>Still loading</h1><a href="${ destination }">Protected website</a><script async src="${ pendingResourceUrl }"></script></body></html>`,
				} );
			} );
			await context.route( pendingResourceUrl, async ( route ) => {
				resourceRequested = true;
				await pendingResource;
				await route.fulfill( { contentType: 'application/javascript', body: '' } );
			} );

			try {
				await worker.evaluate( async ( configuration ) => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
					await chrome.storage.local.set( { 'tocus.protection.configuration.v1': configuration } );
				}, {
					...TestEmptyProtectionConfiguration,
					sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId } } ],
				} );
				await expect.poll( () => worker.evaluate( async () => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
					return chrome.declarativeNetRequest.getDynamicRules();
				} ) ).toEqual( expect.arrayContaining( [ expect.objectContaining( {
					action: { type: 'redirect', redirect: {
						regexSubstitution: expect.stringMatching( /pause\.html#destination=\\0$/u ),
					} },
					condition: {
						regexFilter: '^https?://.*',
						requestDomains: [ 'example.test' ],
						resourceTypes: [ 'main_frame' ],
					},
				} ) ] ) );
				await page.goto( allowedUrl, { waitUntil: 'domcontentloaded' } );
				await expect.poll( () => resourceRequested ).toBe( true );
				expect( await page.evaluate( () => document.readyState ) ).toBe( 'interactive' );
				await page.bringToFront();
				if ( clickLink ) {
					await page.getByRole( 'link', { name: 'Protected website' } ).click( { noWaitAfter: true } );
				} else {
					await page.goto( destination, { waitUntil: 'commit' } );
				}
				await expect( page.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
				await expect( page.locator( 'tocus-f-interruption-screen' ) ).toHaveAttribute( 'progressing', '' );
				await expect( page ).toHaveURL( /\/pause\.html$/u );
				expect( allowedRequests ).toBe( 1 );
			} finally {
				// The isolated context owns its routes, including the fixture's external-request block.
				releasePendingResource?.();
			}
		} );
	}

	for ( const targetBlank of [ false, true ] ) {
		test( `continues to the protected destination after a server redirect in ${ targetBlank ? 'a new tab' : 'the same tab' }`, async ( { context, worker, page } ) => {
			const searchUrl = 'https://allowed.test/search';
			const redirectUrl = 'https://allowed.test/redirect';
			const destination = 'https://example.test/watch%2Fencoded?v=regression&next=https%3A%2F%2Fother.test%2Fx#chapter%201';
			await context.route( searchUrl, ( route ) => route.fulfill( {
				contentType: 'text/html',
				body: `<!doctype html><html lang="en"><title>Search results</title><body><h1>Search results</h1><a href="${ redirectUrl }"${ targetBlank ? ' target="_blank"' : '' }>Protected result</a></body></html>`,
			} ) );
			await context.route( redirectUrl, ( route ) => route.fulfill( {
				status: 302,
				headers: { location: destination },
				body: '',
			} ) );
			await worker.evaluate( async ( configuration ) => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				await chrome.storage.local.set( { 'tocus.protection.configuration.v1': configuration } );
			}, {
				...TestEmptyProtectionConfiguration,
				sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId } } ],
			} );
			await expect.poll( () => worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				return chrome.declarativeNetRequest.getDynamicRules();
			} ) ).toEqual( expect.arrayContaining( [ expect.objectContaining( {
				action: { type: 'redirect', redirect: {
					regexSubstitution: expect.stringMatching( /pause\.html#destination=\\0$/u ),
				} },
				condition: {
					regexFilter: '^https?://.*',
					requestDomains: [ 'example.test' ],
					resourceTypes: [ 'main_frame' ],
				},
			} ) ] ) );

			await page.goto( searchUrl );
			const newPagePromise = targetBlank ? context.waitForEvent( 'page' ) : null;
			await page.getByRole( 'link', { name: 'Protected result', exact: true } ).click( { noWaitAfter: true } );
			const protectedPage = newPagePromise === null ? page : await newPagePromise;
			await protectedPage.bringToFront();
			await expect( protectedPage.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
			const continueButton = protectedPage.getByRole( 'button', { name: 'Continue', exact: true } );
			await expect( continueButton ).toBeVisible( { timeout: 15_000 } );
			await continueButton.click();
			await expect( protectedPage ).toHaveURL( destination );
			await expect( protectedPage.getByRole( 'heading', { name: 'Destination loaded', exact: true } ) ).toBeVisible();
		} );
	}

	test( 'keeps a redacted pause tab calm while its accepted destination remains pending', async ( { context, worker, page } ) => {
		// Phase limits total 70 seconds; allow ten for worker readiness and ten for orchestration.
		// These are failure ceilings, not sleeps: the real wait remains ten seconds plus a two-second observation.
		test.setTimeout( 90_000 );
		const destination = 'https://example.test/slow-entry';
		let releaseDestination: ( () => void ) | undefined;
		const destinationBarrier = new Promise<void>( ( resolve ) => {
			releaseDestination = resolve;
		} );
		let holdDestination = false;
		let destinationWasRequested = false;
		/**
		 * Keeps the accepted destination request pending until the Ready screen is verified.
		 * @param route - Synthetic destination request intercepted by Playwright.
		 * @return Promise resolved after the synthetic destination is fulfilled.
		 * @since 0.1.0 Initial implementation.
		 */
		async function handleDestination( route: Route ): Promise<void> {
			if ( holdDestination ) {
				destinationWasRequested = true;
				await destinationBarrier;
			}

			await route.fulfill( {
				contentType: 'text/html',
				body: '<!doctype html><html lang="en"><title>Example website</title><body><h1>Destination loaded</h1></body></html>',
			} );
		}

		try {
			await context.route( destination, handleDestination );
			await test.step( 'Configure the protected site and wait for its redirect rule', async () => {
				await worker.evaluate( async () => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

					await chrome.storage.local.set( {
						'tocus.protection.configuration.v1': {
							schemaVersion: 5,
							sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: 'scope_default' } } ],
							timingConfiguration: { initialWaitMilliseconds: 10000, ladderIncreaseMilliseconds: 5000, maximumWaitMilliseconds: 60000, allowanceMilliseconds: 300000, completionAction: 'show-continue' },
							schedule: { mode: 'always' },
							measurementRevisionsByScope: { scope_default: 'revision_packaged' },
						},
					} );
				} );
				await expect.poll( () => worker.evaluate( async () => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

					return chrome.declarativeNetRequest.getDynamicRules();
				} ) ).toEqual( expect.arrayContaining( [ expect.objectContaining( {
					action: { type: 'redirect', redirect: {
						regexSubstitution: expect.stringMatching( /pause\.html#destination=\\0$/u ),
					} },
					condition: {
						regexFilter: '^https?://.*',
						requestDomains: [ 'example.test' ],
						resourceTypes: [ 'main_frame' ],
					},
				} ) ] ) );
			}, { timeout: 10_000 } );
			const observedStates: string[] = [];

			await page.exposeFunction( 'reportInterruptionState', ( state: string ) => {
				observedStates.push( state );
			} );

			await test.step( 'Open the redacted pause with browser attention', async () => {
				await page.goto( destination );
				await page.waitForURL( '**/pause.html' );
				await page.bringToFront();
				await expect.poll( () => page.evaluate( () =>
					document.hasFocus() && document.visibilityState === 'visible' ) )
					.toBe( true );
				const pauseTab = await worker.evaluate( async () => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
					const contexts = await chrome.runtime.getContexts( { contextTypes: [ 'TAB' ] } );
					const pauseContext = contexts.find( ( candidate ) => candidate.documentUrl === chrome.runtime.getURL( '/pause.html' ) );

					return ( await chrome.tabs.query( {} ) ).find( ( candidate ) =>
						candidate.id === pauseContext?.tabId );
				} );

				expect( pauseTab ).toBeDefined();
				expect( pauseTab?.url ).toBeUndefined();
				expect( pauseTab?.pendingUrl ).toBeUndefined();
			}, { timeout: 10_000 } );
			const continueButton = page.getByRole( 'button', { name: 'Continue', exact: true } );

			await test.step( 'Complete the real breathing wait without starting an allowance', async () => {
				await expect( continueButton ).toBeVisible( { timeout: 15_000 } );
				const readyDocument = await readDurableState( worker );

				expect( readyDocument.scopes.scope_default?.ready ).toMatchObject( {
					capturedAllowanceDurationMilliseconds: 300_000,
				} );
				expect( readyDocument.scopes.scope_default?.allowance ).toBeUndefined();
			}, { timeout: 20_000 } );
			await test.step( 'Observe the ready screen before entry', async () => {
				await page.evaluate( () => {
					const screen = document.querySelector( 'tocus-f-interruption-screen' );

					if ( screen === null ) {
						throw new Error( 'The interruption screen is unavailable.' );
					}
					const reportState = ( globalThis as typeof globalThis & {
					reportInterruptionState: ( state: string ) => void;
				} ).reportInterruptionState;
					/** Reports one rendered interruption state to the test process. */
					const reportCurrentState = (): void => {
						reportState( screen.getAttribute( 'state' ) ?? '' );
					};

					reportCurrentState();
					new MutationObserver( reportCurrentState ).observe( screen, {
						attributeFilter: [ 'state' ],
						attributes: true,
					} );
				} );
			}, { timeout: 5_000 } );
			const entryRequestedAt = Date.now();

			await test.step( 'Accept entry while holding the destination request pending', async () => {
				holdDestination = true;
				await continueButton.click( { noWaitAfter: true, timeout: 5_000 } );
				await expect.poll( () => destinationWasRequested, { timeout: 5_000 } ).toBe( true );
			}, { timeout: 10_000 } );
			await test.step( 'Keep the pause calm across the pending-navigation observation window', async () => {
				// A negative temporal assertion: the former recovery flash appeared during this window.
				await page.waitForTimeout( 2_000 );
				expect( observedStates ).toEqual( [ 'ready' ] );
			}, { timeout: 5_000 } );
			await test.step( 'Release navigation and verify the granted allowance', async () => {
				releaseDestination?.();
				await page.waitForURL( destination, { timeout: 5_000 } );
				await expect( page.getByRole( 'heading', { name: 'Destination loaded' } ) ).toBeVisible();
				const allowanceDocument = await readDurableState( worker );
				const allowance = allowanceDocument.scopes.scope_default?.allowance;

				expect( allowanceDocument.scopes.scope_default?.ready ).toBeUndefined();
				expect( allowance ).toBeDefined();
				expect( allowance?.startedAtEpochMilliseconds ).toBeGreaterThanOrEqual( entryRequestedAt );
				expect( allowance?.expiresAtEpochMilliseconds ).toBe(
					( allowance?.startedAtEpochMilliseconds ?? 0 ) + 300_000,
				);
			}, { timeout: 10_000 } );
		} finally {
			releaseDestination?.();
			await context.unroute( destination, handleDestination );
		}
	} );

	/* Native two-minute expiry is verified locally to keep CI duration bounded. */
	test.describe( 'real-time expiry', () => {
		test.skip( process.env.CI === 'true', 'The real two-minute expiry remains covered locally.' );
		test( 'holds tab audio through expiry and Ready, then restores playback after Continue without reloading', async ( { context, worker } ) => {
			test.setTimeout( 165_000 );
			await worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				await chrome.storage.local.set( {
					'tocus.protection.configuration.v1': {
						schemaVersion: 5,
						sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: 'scope_default' } } ],
						timingConfiguration: { initialWaitMilliseconds: 10000, ladderIncreaseMilliseconds: 0, maximumWaitMilliseconds: 30000, allowanceMilliseconds: 120000, completionAction: 'show-continue' },
						schedule: { mode: 'always' },
						measurementRevisionsByScope: { scope_default: 'revision_packaged_audio' },
					},
				} );
			} );
			await expect.poll( () => worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
			} ) ).toBeGreaterThan( 0 );
			const page = await context.newPage();
			const accessibility = await context.newCDPSession( page );
			const destination = 'https://example.test/audio-state';

			try {
				await page.goto( destination );
				await page.waitForURL( '**/pause.html' );
				await page.bringToFront();
				const continueButton = page.getByRole( 'button', { name: 'Continue', exact: true } );
				await continueButton.waitFor( { state: 'visible', timeout: 15_000 } );
				await continueButton.click();
				await page.waitForURL( destination, { timeout: 5_000 } );
				const allowance = ( await readDurableState( worker ) ).scopes.scope_default?.allowance;
				expect( allowance ).toBeDefined();
				expect(
					( allowance?.expiresAtEpochMilliseconds ?? 0 ) - ( allowance?.startedAtEpochMilliseconds ?? 0 ),
				).toBe( 120_000 );
				await page.getByRole( 'textbox', { name: 'Unfinished work' } ).fill( 'Preserve my current work' );
				await page.evaluate( () => {
					document.body.dataset.documentIdentity = 'original-audio-document';
				} );
				expect( await readTabMuted( worker, destination ) ).toBe( false );

				await expect.poll( async () => {
					const { nodes } = await accessibility.send( 'Accessibility.getFullAXTree' );
					return nodes.some( ( node ) => ! node.ignored && node.role?.value === 'dialog' );
				}, { timeout: 125_000 } ).toBe( true );
				await expect.poll( () => readTabMuted( worker, destination ) ).toBe( true );
				const waitingTree = await accessibility.send( 'Accessibility.getFullAXTree' );
				expect( waitingTree.nodes.some( ( node ) => ! node.ignored && node.role?.value === 'button' && node.name?.value === 'Continue' ) ).toBe( false );
				expect( page.url() ).toBe( destination );
				expect( await page.getByRole( 'textbox', { name: 'Unfinished work', includeHidden: true } ).inputValue() ).toBe( 'Preserve my current work' );

				await expect.poll( async () => {
					const { nodes } = await accessibility.send( 'Accessibility.getFullAXTree' );
					return nodes.some( ( node ) => ! node.ignored && node.role?.value === 'button' && node.name?.value === 'Continue' );
				}, { timeout: 15_000 } ).toBe( true );
				expect( await readTabMuted( worker, destination ) ).toBe( true );
				expect( ( await readDurableState( worker ) ).scopes.scope_default?.allowance ).toBeUndefined();
				await page.keyboard.press( 'Space' );
				await expect.poll( async () => {
					const { nodes } = await accessibility.send( 'Accessibility.getFullAXTree' );
					return nodes.some( ( node ) => ! node.ignored && node.role?.value === 'dialog' );
				} ).toBe( false );
				await expect.poll( () => readTabMuted( worker, destination ) ).toBe( false );
				expect( page.url() ).toBe( destination );
				expect( await page.getByRole( 'textbox', { name: 'Unfinished work' } ).inputValue() ).toBe( 'Preserve my current work' );
				expect( await page.evaluate( () => document.body.dataset.documentIdentity ) ).toBe( 'original-audio-document' );
			} finally {
				await page.close();
			}
		} );
	} );

	test.describe( 'without optional access', () => {
		test.use( { pregrantSite: false } );
		test( 'resets packaged local data and replaces only the originating Settings tab with new onboarding', async ( { context: resetContext, worker: resetWorker } ) => {
			const optionsUrl = await resetWorker.evaluate( async ( seed ) => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				await chrome.storage.local.set( seed );
				return chrome.runtime.getURL( '/options.html#privacy' );
			}, {
				'tocus.preferences.v1': { ...DefaultPreferencesDocument, palette: 'purple', language: 'en' },
				'tocus.protection.configuration.v1': TestEmptyProtectionConfiguration,
				'tocus.statistics.v1': createMockStatisticsDocument(),
			} );
			const secondSettings = await resetContext.newPage();
			await secondSettings.goto( optionsUrl );
			const unrelated = await resetContext.newPage();
			await unrelated.goto( 'https://example.test/reset-preserves-work' );
			await unrelated.getByRole( 'textbox', { name: 'Unfinished work' } ).fill( 'Preserve work in another tab' );
			const settings = await resetContext.newPage();
			await settings.goto( optionsUrl );
			const resetButton = settings.getByRole( 'button', { name: 'Reset all TOCus data', exact: true } );
			await resetButton.click();
			await settings.getByRole( 'heading', { name: 'Reset all TOCus data?' } ).waitFor();
			await test.step( 'Open new onboarding and close only the Settings tab that confirmed reset', async () => {
				const [ onboarding ] = await Promise.all( [
					resetContext.waitForEvent( 'page' ),
					settings.waitForEvent( 'close' ),
					settings.getByLabel( 'Reset all TOCus data?' ).getByRole( 'button', { name: 'Reset all TOCus data', exact: true } ).click(),
				] );
				await expect( onboarding ).toHaveURL( new URL( '/onboarding.html', optionsUrl ).href );
				await expect( onboarding.getByText( 'TOCus', { exact: true } ).first() ).toBeVisible();
				const confirmation = onboarding.getByRole( 'status' ).filter( { hasText: 'All TOCus data reset.' } );
				await expect( confirmation ).toBeVisible();
				await confirmation.getByRole( 'button', { name: 'Dismiss notification', exact: true } ).click();
				await onboarding.reload();
				await expect( onboarding.getByText( 'TOCus', { exact: true } ).first() ).toBeVisible();
				await expect( onboarding.locator( '.tocus-snackbar' ) ).toHaveCount( 0 );
				expect( settings.isClosed() ).toBe( true );
				await expect( secondSettings ).toHaveURL( optionsUrl );
				await expect( secondSettings.getByRole( 'button', { name: 'Reset all TOCus data', exact: true } ) ).toBeEnabled();
				await expect( unrelated ).toHaveURL( 'https://example.test/reset-preserves-work' );
				await expect( unrelated.getByRole( 'textbox', { name: 'Unfinished work' } ) ).toHaveValue( 'Preserve work in another tab' );
			} );
			const expectedGeneration: unknown = expect.any( String );
			await expect.poll( () => resetWorker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				const values: Record<string, unknown> = await chrome.storage.local.get( null );
				return values[ 'tocus.local-data.generation.v1' ];
			} ) ).toEqual( { generation: expectedGeneration, pending: false, needsOnboarding: false } );
			const stored = await resetWorker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				return {
					local: await chrome.storage.local.get( null ),
					grants: await chrome.permissions.getAll(),
					rules: await chrome.declarativeNetRequest.getDynamicRules(),
				};
			} );
			expect( stored.local ).not.toHaveProperty( 'tocus.preferences.v1' );
			expect( stored.local ).not.toHaveProperty( 'tocus.protection.configuration.v1' );
			expect( stored.local ).not.toHaveProperty( 'tocus.statistics.v1' );
			expect( stored.grants.origins ?? [] ).toEqual( [] );
			expect( stored.grants.permissions ).not.toContain( 'webNavigation' );
			expect( stored.rules ).toEqual( [] );
		} );
	} );
} );
