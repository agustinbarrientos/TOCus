import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { expect, test as base, type Page } from '@playwright/test';
import type { ExtensionManifest, ExtensionWorkerGlobal, FaviconTestFixture, PackagedFaviconFixtures } from './types';
import { DefaultPreferencesDocument, Language } from '../../../src/domains/preferences/types';
import { createMockStatisticsDocument } from '../../../src/domains/statistics/types/__fixtures__/statistics-document';
import { StatisticsDocumentSchema } from '../../../src/domains/statistics/types/statistics-document';
import { ProtectionStorageEnvelopeSchema } from '../../../src/domains/protection/services/protection-storage/types';
import {
	StoredDurableProtectionStateSchema,
	StoredSessionProtectionStateSchema,
	StoredWaitingProtectionScopeStateSchema,
	type StoredWaitingProtectionScopeState,
} from '../../../src/domains/protection/types/stored-protection-state';

/**
 * Creates a distinctive website icon unrelated to any TOCus artwork.
 * @param focusLink - Whether to create the distinct icon for the unprotected quick-link destination.
 * @return Opaque pixels with dimensions matching Chrome's requested favicon.
 * @since 1.0.0 Initial implementation.
 */
function createWebsiteIcon( focusLink = false ): PNG {
	const icon = new PNG( { width: 32, height: 32 } );

	for ( let offset = 0; offset < icon.data.length; offset += 4 ) {
		icon.data.set( focusLink ? [ 211, 51, 68, 255 ] : [ 17, 119, 211, 255 ], offset );
	}
	return icon;
}

/**
 * Reads decoded image pixels without retaining a stale renderer image-cache entry.
 * @param page - An extension document allowed to read the favicon endpoint.
 * @param source - Extension-local image URL.
 * @return SHA-256 fingerprint of the decoded 32-pixel image.
 * @since 1.0.0 Initial implementation.
 */
async function readImageHash( page: Page, source: string ): Promise<string> {
	const pixels = await page.evaluate( async ( url ) => {
		const response = await fetch( url, { cache: 'reload' } );
		const image = await createImageBitmap( await response.blob() );
		const canvas = new OffscreenCanvas( 32, 32 );
		const drawing = canvas.getContext( '2d' );

		if ( drawing === null ) {
			throw new Error( 'The favicon pixel reader is unavailable.' );
		}
		drawing.drawImage( image, 0, 0, 32, 32 );
		image.close();
		return Array.from( drawing.getImageData( 0, 0, 32, 32 ).data );
	}, source );

	return createHash( 'sha256' ).update( Buffer.from( pixels ) ).digest( 'hex' );
}

/**
 * Reads the native favicon associated with an exact website or extension document.
 * @param fixture - Disposable installation with favicon permission.
 * @param pageUrl - Document whose cached icon should be inspected.
 * @return Decoded pixel fingerprint supplied by Chromium's favicon service.
 * @since 1.0.0 Initial implementation.
 */
async function readCachedFavicon( fixture: FaviconTestFixture, pageUrl: string ): Promise<string> {
	const source = new URL( '/_favicon/', fixture.extensionRoot );

	source.searchParams.set( 'pageUrl', pageUrl );
	source.searchParams.set( 'size', '32' );
	return readImageHash( fixture.reader, source.href );
}

/**
 * Reads the actual shared wait so reload cannot silently create another attempt.
 * @param fixture - Disposable extension with one actively protected tab.
 * @return Validated waiting scope retained by the packaged background.
 * @since 1.1.0
 */
async function readWaitingState( fixture: FaviconTestFixture ): Promise<StoredWaitingProtectionScopeState> {
	const records = await fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return chrome.storage.session.get( 'tocus.protection.session.v1' );
	} );
	const state = StoredSessionProtectionStateSchema.parse(
		ProtectionStorageEnvelopeSchema.parse( records[ 'tocus.protection.session.v1' ] ).document,
	);
	return StoredWaitingProtectionScopeStateSchema.parse( state.scopes.scope_default );
}

const test = base.extend<PackagedFaviconFixtures>( {
	legacyBookmarks: [ true, { option: true } ],
	/**
	 * Owns the packaged browser, profile, and loopback server through acquisition and teardown.
	 * @param root0 - Browser runner dependencies.
	 * @param root0.playwright - Instrumented browser APIs retaining configured diagnostics.
	 * @param root0.legacyBookmarks - Whether the legacy scenarios need bookmark access.
	 * @param use - Runs one scenario with its disposable installation.
	 */
	favicon: async ( { playwright, legacyBookmarks }, use ) => {
		const server = createServer( ( request, response ) => {
			const focusLink = request.headers.host === 'project.test';
			if ( request.url === '/favicon.png' ) {
				response.writeHead( 200, { 'Content-Type': 'image/png' } );
				response.end( PNG.sync.write( createWebsiteIcon( focusLink ) ) );
				return;
			}
			response.writeHead( 200, { 'Content-Type': 'text/html' } );
			response.end( `<!doctype html><html lang="en"><title>Independent website</title><link rel="icon" type="image/png" sizes="32x32" href="/favicon.png"><body><h1>${ focusLink ? 'My project' : 'Original website' }</h1></body></html>` );
		} );
		let directory: string | undefined;
		let context: FaviconTestFixture[ 'context' ] | undefined;

		try {
			directory = await mkdtemp( join( tmpdir(), 'tocus-packaged-favicons-' ) );
			const extensionPath = join( directory, 'extension' );
			const profilePath = join( directory, 'profile' );

			await cp( fileURLToPath( new URL( '../../../.output/chrome-mv3/', import.meta.url ) ), extensionPath, { recursive: true } );
			const manifestPath = join( extensionPath, 'manifest.json' );
			const manifest = JSON.parse( await readFile( manifestPath, 'utf8' ) ) as ExtensionManifest;

			expect( manifest.permissions ).not.toContain( 'bookmarks' );
			// Retain every production icon: manifest fallback must participate in this regression.
			// Bookmarks and synthetic host access belong only to this disposable installation.
			manifest.permissions = [ ...manifest.permissions ?? [], ...manifest.optional_permissions ?? [],
				...legacyBookmarks ? [ 'bookmarks' as const ] : [] ];
			manifest.host_permissions = [ '*://*.example.test/*' ];
			delete manifest.optional_permissions;
			await writeFile( manifestPath, JSON.stringify( manifest ) );
			await new Promise<void>( ( resolve, reject ) => {
				server.once( 'error', reject );
				server.listen( 0, '127.0.0.1', () => {
					server.off( 'error', reject );
					resolve();
				} );
			} );
			const address = server.address();

			if ( address === null || typeof address === 'string' ) {
				throw new Error( 'The synthetic favicon server is unavailable.' );
			}
			const port = address.port;
			const siteUrl = 'http://example.test/';
			const focusLinkUrl = 'http://project.test/';
			const protectedLinkUrl = 'http://other.example.test/';

			/**
			 * Opens the same test-owned profile and reinstalls its loopback-only network boundary.
			 * @return Packaged browser handles with the latest context retained for teardown.
			 * @since 1.0.0
			 */
			async function launchBrowser(): Promise<Pick<FaviconTestFixture, 'context' | 'extensionRoot' | 'reader' | 'worker'>> {
				context = await playwright.chromium.launchPersistentContext( profilePath, {
					channel: 'chromium',
					headless: true,
					timeout: 10_000,
					args: [
						`--disable-extensions-except=${ extensionPath }`, `--load-extension=${ extensionPath }`,
						`--host-resolver-rules=MAP example.test 127.0.0.1:${ String( port ) },MAP project.test 127.0.0.1:${ String( port ) },MAP other.example.test 127.0.0.1:${ String( port ) }`, '--no-proxy-server',
					],
				} );
				await context.route( /^https?:\/\//u, ( route ) => {
					const origin = new URL( route.request().url() ).origin;
					return [ siteUrl, focusLinkUrl, protectedLinkUrl ].some(
						( site ) => origin === new URL( site ).origin,
					)
						? route.continue()
						: route.abort();
				} );
				const worker = context.serviceWorkers()[ 0 ] ?? await context.waitForEvent( 'serviceworker' );
				const extensionRoot = await worker.evaluate( () => {
					const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
					return chrome.runtime.getURL( '/' );
				} );
				const reader = await context.newPage();

				await reader.goto( `${ extensionRoot }options.html` );
				return { context, extensionRoot, reader, worker };
			}

			const fixture: FaviconTestFixture = {
				...await launchBrowser(),
				siteUrl,
				focusLinkUrl,
				protectedLinkUrl,
				/**
				 * Reopens the same browser profile so native favicon history survives a fresh runtime.
				 * @return Ready replacement handles after the old context closes completely.
				 * @since 1.0.0
				 */
				async restartBrowser(): Promise<void> {
					await fixture.context.close();
					const replacement = await launchBrowser();

					expect( replacement.extensionRoot ).toBe( fixture.extensionRoot );
					Object.assign( fixture, replacement );
				},
			};
			await use( fixture );
		} finally {
			try {
				await context?.close();
			} finally {
				try {
					if ( server.listening ) {
						await new Promise<void>( ( resolve, reject ) => {
							server.close( ( error ) => {
								if ( error !== undefined ) {
									reject( error );
									return;
								}
								resolve();
							} );
							server.closeAllConnections();
						} );
					}
				} finally {
					if ( directory !== undefined ) {
						await rm( directory, { recursive: true, force: true } );
					}
				}
			}
		}
	},
} );

/**
 * Recreates the explicit favicon declaration made by the former pause document.
 * @param page - Actual pause tab whose redirected URL Chrome will associate with this icon.
 * @return Promise resolved once the document declares the old branded favicon.
 * @since 1.0.0 Initial implementation.
 */
async function declareLegacyFavicon( page: Page ): Promise<void> {
	await page.evaluate( () => {
		for ( const link of document.querySelectorAll( 'link[rel="icon"]' ) ) {
			link.remove();
		}
		const favicon = document.createElement( 'link' );

		favicon.rel = 'icon';
		favicon.href = '/icons/tab-dark.png';
		document.head.append( favicon );
	} );
}

/**
 * Recreates a favicon stored by an older installation without rewriting browser databases.
 * @param fixture - Isolated installation whose legacy document should acquire a branded icon.
 * @return Promise resolved once Chromium serves the old branded document icon from its cache.
 * @since 1.0.0 Initial implementation.
 */
async function seedLegacyFavicon( fixture: FaviconTestFixture ): Promise<void> {
	const legacyPage = await fixture.context.newPage();
	const legacyUrl = `${ fixture.extensionRoot }interruption.html`;
	const brandedHash = await readImageHash( fixture.reader, `${ fixture.extensionRoot }icons/tab-dark.png` );

	try {
		// This seed represents an old static document, not a live protection participant.
		// Disable only its page scripts so modern recovery cannot dismiss it while Chrome learns the icon.
		const legacySession = await fixture.context.newCDPSession( legacyPage );
		await legacySession.send( 'Emulation.setScriptExecutionDisabled', { value: true } );
		await legacyPage.goto( legacyUrl );
		await declareLegacyFavicon( legacyPage );
		await expect.poll( () => readCachedFavicon( fixture, legacyUrl ) ).toBe( brandedHash );
		await expect( legacyPage ).toHaveURL( legacyUrl );
	} finally {
		await legacyPage.close();
	}
}

/**
 * Enables real packaged protection with the shared countdown.
 * @param fixture - Disposable extension whose stored configuration should change.
 * @return Promise resolved once the browser has installed its navigation rules.
 * @since 1.0.0 Initial implementation.
 */
async function enableProtection( fixture: FaviconTestFixture ): Promise<void> {
	await fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;

		await chrome.storage.local.set( {
			'tocus.protection.configuration.v1': {
				schemaVersion: 5,
				sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: 'scope_default' } } ],
				timingConfiguration: { initialWaitMilliseconds: 10000, ladderIncreaseMilliseconds: 5000, maximumWaitMilliseconds: 60000, allowanceMilliseconds: 300000, completionAction: 'show-continue' },
				schedule: { mode: 'always' },
				measurementRevisionsByScope: { scope_default: 'revision_packaged_favicon' },
			},
		} );
	} );
	await expect.poll( () => fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
	} ) ).toBeGreaterThan( 0 );
}

/**
 * Starts a second visit fixture without replacing the browser's repaired favicon cache.
 * Only this disposable extension's runtime state is cleared; real waits and navigation remain intact.
 * @param fixture - Test-owned profile whose completed allowance should not carry into the next scenario.
 * @return Ready packaged worker and icon-reader page after relaunching the same browser profile.
 * @since 1.0.0
 */
async function restartVisitFixture( fixture: FaviconTestFixture ): Promise<void> {
	await fixture.reader.close();
	await fixture.worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		await chrome.storage.local.remove( 'tocus.protection.durable.v1' );
		await chrome.storage.session.remove( 'tocus.protection.session.v1' );
	} );
	await fixture.restartBrowser();
}

/**
 * Visits a protected website and completes the actual focused pause.
 * @param fixture - Browser whose website is protected by packaged navigation rules.
 * @return Interruption tab with its real Continue button visible.
 * @since 1.0.0 Initial implementation.
 */
async function openReadyPause( fixture: FaviconTestFixture ): Promise<Page> {
	const pause = await fixture.context.newPage();

	await pause.goto( fixture.siteUrl );
	await pause.waitForURL( `${ fixture.extensionRoot }**` );
	await pause.bringToFront();
	await pause.getByRole( 'button', { name: 'Continue', exact: true } ).waitFor( { state: 'visible', timeout: 15_000 } );
	return pause;
}

test.describe( 'packaged Chrome Settings favicons', () => {
	test.use( { legacyBookmarks: false } );

	test( 'renders a native cached website icon in Websites and Statistics', async ( { favicon: fixture } ) => {
		const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );
		const website = await fixture.context.newPage();

		await website.goto( fixture.siteUrl );
		await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		await website.close();
		await enableProtection( fixture );
		const today = await fixture.worker.evaluate( () => new Intl.DateTimeFormat( 'en-CA', {
			year: 'numeric', month: '2-digit', day: '2-digit',
		} ).format( new Date() ) );
		const totals = { reconsideredVisitCount: 1, completedWaitCount: 0, allowanceGrantedCount: 0,
			estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0 };
		await fixture.worker.evaluate( async ( seed ) => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			await chrome.storage.local.set( seed );
		}, {
			'tocus.preferences.v1': { ...DefaultPreferencesDocument, language: Language.ENGLISH },
			'tocus.statistics.v1': {
				...createMockStatisticsDocument(), firstRecordedDate: today,
				dailyTotals: [ { date: today, ...totals } ],
				scopes: { scope_default: { totals } },
				visitOutcomes: {
					recordedFromDate: today,
					dailySites: [ { date: today, siteHost: 'example.test', reconsideredVisitCount: 1, visitedAfterPauseCount: 0 } ],
					dailyHours: [ { date: today, hour: 12, reconsideredVisitCount: 1 } ],
				},
			},
		} );
		// Restart the runtime so its in-memory statistics read the stored fixture.
		await fixture.restartBrowser();
		await fixture.reader.getByRole( 'link', { name: 'Websites', exact: true } ).click();
		const websiteIcon = fixture.reader.locator( '.settings-site-item img' );
		await expect( websiteIcon ).toBeVisible();
		await expect.poll( () => websiteIcon.evaluate( ( image: HTMLImageElement ) =>
			image.complete && image.naturalWidth === 32 ) ).toBe( true );
		const websiteSource = await websiteIcon.evaluate( ( image: HTMLImageElement ) => image.src );
		expect( websiteSource ).toContain( `${ fixture.extensionRoot }_favicon/` );
		expect( await readImageHash( fixture.reader, websiteSource ) ).toBe( websiteHash );

		await fixture.reader.getByRole( 'link', { name: 'Statistics', exact: true } ).click();
		const statisticsIcon = fixture.reader.locator( '.settings-statistics-site-list [data-site="example.test"] img' );
		await expect( statisticsIcon ).toBeVisible();
		await expect.poll( () => statisticsIcon.evaluate( ( image: HTMLImageElement ) =>
			image.complete && image.naturalWidth === 32 ) ).toBe( true );
		const statisticsSource = await statisticsIcon.evaluate( ( image: HTMLImageElement ) => image.src );
		expect( statisticsSource ).toBe( websiteSource );
		expect( await readImageHash( fixture.reader, statisticsSource ) ).toBe( websiteHash );
	} );
} );

test.describe( 'packaged Chrome favicon preservation', () => {
	for ( const legacyState of [ false, true ] ) {
		test( `preserves a website favicon through pause and Continue with legacy bookmark state: ${ String( legacyState ) }`, async ( { favicon: fixture } ) => {
			test.setTimeout( 45_000 );
			const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );

			await test.step( 'Prepare the original website favicon and optional legacy bookmark', async () => {
				if ( legacyState ) {
					await seedLegacyFavicon( fixture );
					await fixture.worker.evaluate( async ( url ) => {
						const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
						await chrome.bookmarks.create( { title: 'Independent website', url } );
					}, fixture.siteUrl );
				}
				const website = await fixture.context.newPage();

				await website.goto( fixture.siteUrl );
				await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
				await website.close();
			} );
			const pause = await test.step( 'Complete the real ten-second pause', async () => {
				await enableProtection( fixture );
				return openReadyPause( fixture );
			} );

			await test.step( 'Keep the original favicon before and after Continue', async () => {
				// Ready follows the real ten-second pause, leaving Chrome time to persist favicon updates.
				expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
				await pause.getByRole( 'button', { name: 'Continue', exact: true } ).click();
				await pause.waitForURL( fixture.siteUrl, { timeout: 5_000 } );
				await expect( pause.getByRole( 'heading', { name: 'Original website' } ) ).toBeVisible();
				expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
			} );
		} );
	}

	test( 'relearns a contaminated website favicon after Continue and preserves it at the next pause', async ( { favicon: fixture } ) => {
		test.setTimeout( 75_000 );
		const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );
		const brandedHash = await test.step( 'Seed the former extension favicon and redirect', async () => {
			await seedLegacyFavicon( fixture );
			const legacyHash = await readImageHash( fixture.reader, `${ fixture.extensionRoot }icons/tab-dark.png` );

			await enableProtection( fixture );
			// Recreate the old redirect using the browser API, without editing its favicon database.
			await fixture.worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				const rules = await chrome.declarativeNetRequest.getDynamicRules();

				await chrome.declarativeNetRequest.updateDynamicRules( {
					removeRuleIds: rules.map( ( rule ) => rule.id ),
					addRules: rules.map( ( rule ) => ( {
						...rule,
						action: { type: 'redirect', redirect: { extensionPath: '/interruption.html' } },
					} ) ),
				} );
			} );
			return legacyHash;
		} );
		const legacyPause = await test.step( 'Complete the first real ten-second pause', () => openReadyPause( fixture ) );

		await test.step( 'Observe the contaminated favicon and relearn the website icon after Continue', async () => {
			expect( legacyPause.url() ).toBe( `${ fixture.extensionRoot }interruption.html` );
			// Seeding a separate document does not deterministically populate a redirect's cache entry.
			// Recreate the old declaration on the redirected tab and observe its actual persisted effect.
			await declareLegacyFavicon( legacyPause );
			await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( brandedHash );
			await legacyPause.getByRole( 'button', { name: 'Continue', exact: true } ).click();
			await legacyPause.waitForURL( fixture.siteUrl, { timeout: 5_000 } );
			await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
			await legacyPause.close();
		} );
		await test.step( 'Preserve the repaired favicon through the second real ten-second pause', async () => {
			await restartVisitFixture( fixture );
			await enableProtection( fixture );
			await openReadyPause( fixture );
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		} );
	} );
} );

test.describe( 'packaged Chrome quick-link favicon preservation', () => {
	test.use( { legacyBookmarks: false } );

	test( 'keeps separate website icons after quick-link choices and browser restart', async ( { favicon: fixture } ) => {
		test.setTimeout( 45_000 );
		const websiteHash = createHash( 'sha256' ).update( createWebsiteIcon().data ).digest( 'hex' );
		const focusLinkHash = createHash( 'sha256' ).update( createWebsiteIcon( true ).data ).digest( 'hex' );
		const website = await fixture.context.newPage();

		await website.goto( fixture.siteUrl );
		await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		await website.close();
		await fixture.worker.evaluate( async ( preferences ) => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			await chrome.storage.local.set( { 'tocus.preferences.v1': preferences } );
		}, { ...DefaultPreferencesDocument, language: Language.ENGLISH,
			focusLinks: [ { id: 'focus_link_project', label: 'Return to my project', url: fixture.focusLinkUrl } ] } );
		await enableProtection( fixture );
		const pause = await fixture.context.newPage();
		const tabCount = fixture.context.pages().length;
		await pause.goto( `${ fixture.focusLinkUrl }before-pause` );

		for ( const visit of [ 1, 2 ] ) {
			await test.step( `Keep both native favicons after quick-link visit ${ String( visit ) }`, async () => {
				await pause.goto( fixture.siteUrl );
				await pause.bringToFront();
				await expect( pause ).toHaveURL( `${ fixture.extensionRoot }pause.html` );
				await pause.getByRole( 'button', { name: 'Return to my project', exact: true } ).click();
				await expect( pause ).toHaveURL( fixture.focusLinkUrl );
				await expect( pause.getByRole( 'heading', { name: 'My project' } ) ).toBeVisible();
				await expect.poll( () => readCachedFavicon( fixture, fixture.focusLinkUrl ) ).toBe( focusLinkHash );
				await expect.poll( () => readCachedFavicon( fixture, fixture.siteUrl ), {
					message: 'The blocked website must retain its own native favicon after a quick-link choice.',
				} ).toBe( websiteHash );
				expect( fixture.context.pages() ).toHaveLength( tabCount );

				await expect.poll( async () => {
					const records = await fixture.worker.evaluate( async () => {
						const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
						return chrome.storage.local.get( [ 'tocus.statistics.v1', 'tocus.protection.durable.v1' ] );
					} );
					const statistics = StatisticsDocumentSchema.parse( records[ 'tocus.statistics.v1' ] );
					const state = StoredDurableProtectionStateSchema.parse(
						ProtectionStorageEnvelopeSchema.parse( records[ 'tocus.protection.durable.v1' ] ).document,
					);
					return {
						totals: statistics.scopes.scope_default?.totals,
						sites: statistics.visitOutcomes?.dailySites.map( ( site ) => site.siteHost ),
						allowance: state.scopes.scope_default?.allowance,
					};
				} ).toMatchObject( {
					totals: { reconsideredVisitCount: visit, completedWaitCount: 0, allowanceGrantedCount: 0 },
					sites: [ 'example.test' ], allowance: undefined,
				} );
			} );
		}
		for ( const cycle of [ 1, 2 ] ) {
			await test.step( `Restore protection and Forward navigation on history cycle ${ String( cycle ) }`, async () => {
				await pause.goBack();
				await pause.bringToFront();
				await expect( pause ).toHaveURL( `${ fixture.extensionRoot }pause.html` );
				await expect( pause.getByRole( 'button', { name: 'Return to my project', exact: true } ) ).toBeEnabled();
				await expect( pause.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
				if ( cycle === 1 ) {
					const waiting = await readWaitingState( fixture );
					await pause.reload();
					await expect( pause.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
					const restored = await readWaitingState( fixture );
					expect( restored.waitId ).toBe( waiting.waitId );
					expect( restored.capturedWaitDurationMilliseconds ).toBe(
						waiting.capturedWaitDurationMilliseconds,
					);
					expect( restored.confirmedFocusedDurationMilliseconds ).toBeGreaterThanOrEqual(
						waiting.confirmedFocusedDurationMilliseconds,
					);
					expect( restored.participants.map( ( participant ) => participant.participantId ) ).toEqual(
						waiting.participants.map( ( participant ) => participant.participantId ),
					);
				}
				await pause.goForward();
				await expect( pause ).toHaveURL( fixture.focusLinkUrl );
				await expect( pause.getByRole( 'heading', { name: 'My project' } ) ).toBeVisible();
				expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
				expect( await readCachedFavicon( fixture, fixture.focusLinkUrl ) ).toBe( focusLinkHash );
			} );
		}
		await expect.poll( async () => {
			const records = await fixture.worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				return chrome.storage.local.get( [ 'tocus.statistics.v1', 'tocus.protection.durable.v1' ] );
			} );
			const statistics = StatisticsDocumentSchema.parse( records[ 'tocus.statistics.v1' ] );
			const state = StoredDurableProtectionStateSchema.parse(
				ProtectionStorageEnvelopeSchema.parse( records[ 'tocus.protection.durable.v1' ] ).document,
			);
			return {
				totals: statistics.scopes.scope_default?.totals,
				sites: statistics.visitOutcomes?.dailySites.map( ( site ) => site.siteHost ),
				allowance: state.scopes.scope_default?.allowance,
			};
		} ).toMatchObject( {
			totals: { completedWaitCount: 0, allowanceGrantedCount: 0 },
			sites: [ 'example.test' ], allowance: undefined,
		} );
		await pause.close();
		await fixture.restartBrowser();
		expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		expect( await readCachedFavicon( fixture, fixture.focusLinkUrl ) ).toBe( focusLinkHash );
		const nextVisit = await fixture.context.newPage();
		await nextVisit.goto( fixture.siteUrl );
		await nextVisit.bringToFront();
		await expect( nextVisit ).toHaveURL( `${ fixture.extensionRoot }pause.html` );
		await expect( nextVisit.getByRole( 'button', { name: 'Return to my project', exact: true } ) ).toBeEnabled();
		await expect( nextVisit.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
		expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		await test.step( 'Recheck current protection before restoring a historical pause', async () => {
			await nextVisit.getByRole( 'button', { name: 'Return to my project', exact: true } ).click();
			await expect( nextVisit ).toHaveURL( fixture.focusLinkUrl );
			await fixture.worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				const key = 'tocus.protection.configuration.v1';
				const records = await chrome.storage.local.get( key );
				const configuration = records[ key ] as Record<string, unknown>;
				await chrome.storage.local.set( { [ key ]: { ...configuration, sites: [] } } );
			} );
			await expect.poll( () => fixture.worker.evaluate( async () => {
				const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
				return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
			} ) ).toBe( 0 );
			await nextVisit.goBack();
			await expect( nextVisit ).toHaveURL( fixture.siteUrl );
			await expect( nextVisit.getByRole( 'heading', { name: 'Original website' } ) ).toBeVisible();
			expect( await readCachedFavicon( fixture, fixture.siteUrl ) ).toBe( websiteHash );
		} );
	} );
	test( 'restores the originating destination after Back leaves a protected quick-link target', async ( { favicon: fixture } ) => {
		test.setTimeout( 30_000 );
		await fixture.worker.evaluate( async ( preferences ) => {
			const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
			await chrome.storage.local.set( { 'tocus.preferences.v1': preferences } );
		}, { ...DefaultPreferencesDocument, language: Language.ENGLISH,
			focusLinks: [ { id: 'focus_link_protected', label: 'Another protected website', url: fixture.protectedLinkUrl } ] } );
		await enableProtection( fixture );
		const pause = await fixture.context.newPage();

		await pause.goto( fixture.siteUrl );
		await pause.bringToFront();
		await pause.getByRole( 'button', { name: 'Another protected website', exact: true } ).click();
		await expect( async () => {
			const state = await readWaitingState( fixture );
			expect( state.participants.map( ( participant ) => participant.retainedDestination ) ).toEqual(
				[ fixture.protectedLinkUrl ],
			);
		} ).toPass( { timeout: 5_000 } );
		await pause.goBack();
		await expect( pause ).toHaveURL( `${ fixture.extensionRoot }pause.html` );
		await expect( pause.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
		await expect( async () => {
			const state = await readWaitingState( fixture );
			expect( state.participants.map( ( participant ) => participant.retainedDestination ) ).toEqual(
				[ fixture.siteUrl ],
			);
		} ).toPass( { timeout: 5_000 } );
		await expect( pause.getByRole( 'button', { name: 'Continue', exact: true } ) ).toBeEnabled( { timeout: 15_000 } );
		await pause.getByRole( 'button', { name: 'Continue', exact: true } ).click();
		await expect( pause ).toHaveURL( fixture.siteUrl );
		await expect( pause.getByRole( 'heading', { name: 'Original website' } ) ).toBeVisible();
	} );

} );
