import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { locales, scenes, promos } from './lib/catalog.mjs';
import { createEdgePromos, edgeListings } from './lib/edge.mjs';
import { readOptions } from './lib/options.mjs';
import { captureScene } from './lib/capture.mjs';
import { loadMasters, renderAsset, escapeHtml } from './lib/render.mjs';
import { createOgAssets, loadOgMasters, renderOgAsset, syncOgImages } from './lib/og.mjs';

const root = fileURLToPath( new URL( '../../', import.meta.url ) );
const extensionRequire = createRequire( new URL( '../../apps/extension/package.json', import.meta.url ) );
const sharp = extensionRequire( 'sharp' );
const options = readOptions( process.argv.slice( 2 ), root );

if ( options.help ) {
	console.log( `Generate TOCus store assets locally.

pnpm store:assets                           Capture all 10 languages and both promo tiles
pnpm store:assets --locale en               Capture one language and both promo tiles
pnpm store:assets --locale es-tu,es-vos      Capture selected languages
pnpm store:assets --input /path/to/images   Compose existing 1-en.png \u2026 5-ru.png captures
pnpm store:assets --only promos             Render the 440\u00d7280 and 1400\u00d7560 English tiles
pnpm store:assets --store edge --only promos Render localized Edge tiles, logo and search terms
pnpm store:assets --store firefox           Render all 10 languages at 2400\u00d71800
pnpm store:assets --only screenshots        Skip promotional tiles
pnpm store:assets --only og                 Generate all 10 localized 1200\u00d7628 OG images
pnpm store:assets --only og --sync-website  Also replace the website's finished OG PNGs
pnpm store:assets --output /path/to/output  Choose a local output directory

Default output: tools/store-assets/.output (ignored by Git).
Edge output: tools/store-assets/.output/edge (also ignored).
Firefox output: tools/store-assets/.output/firefox (also ignored).
OG output: tools/store-assets/.output/og (also ignored).
No account, installed extension, user profile, remote API, or image generation is used.` );
	process.exit( 0 );
}

await mkdir( options.output, { recursive: true } );
const og = options.only === 'og';
const screenshots = [ 'all', 'screenshots' ].includes( options.only );
const promotional = [ 'all', 'promos' ].includes( options.only );
const masters = og ? await loadOgMasters( root ) : await loadMasters( root );
const artifacts = [];
let server;
let browser;

/**
 * Encodes opaque RGB artwork or a transparent logo and records the output contract.
 * @param {Buffer} image - Rendered browser pixels.
 * @param {object} asset - Expected dimensions, locale, kind and filename.
 * @return {Promise<void>} Completed file and manifest entry.
 */
async function saveAsset( image, asset ) {
	const path = join( options.output, asset.file );
	await mkdir( fileURLToPath( new URL( './', pathToFileURL( path ) ) ), { recursive: true } );
	const pixels = asset.transparent ? sharp( image ).ensureAlpha() : sharp( image ).removeAlpha();
	const png = await pixels.png( { palette: false } ).toBuffer();
	const metadata = await sharp( png ).metadata();
	if ( metadata.width !== asset.width || metadata.height !== asset.height
		|| metadata.hasAlpha !== Boolean( asset.transparent ) || metadata.channels !== ( asset.transparent ? 4 : 3 ) ) {
		throw new Error( `Invalid output dimensions or color format: ${ asset.file }` );
	}
	await writeFile( path, png );
	artifacts.push( { ...asset, bytes: png.length, sha256: createHash( 'sha256' ).update( png ).digest( 'hex' ) } );
	console.log( `Created ${ asset.file } (${ asset.width }\u00d7${ asset.height }, ${ asset.transparent ? 'RGBA' : 'RGB' } PNG)` );
}

/**
 * Isolates each locale while keeping all browser requests on the local fixture server.
 * @param {import('playwright').Browser} browser - Temporary capture browser.
 * @param {string|undefined} origin - Allowed fixture origin, absent for supplied captures.
 * @param {string} locale - Browser locale matching the production language.
 * @param {number} scale - Device pixel ratio for sharp captures and composition.
 * @return {Promise<import('playwright').BrowserContext>} Localized offline context.
 */
async function createCaptureContext( browser, origin, locale, scale = 1 ) {
	const context = await browser.newContext( {
		deviceScaleFactor: scale, locale, timezoneId: 'UTC', reducedMotion: 'reduce',
	} );
	await context.route( '**/*', ( route ) => {
		const url = new URL( route.request().url() );
		return url.origin === origin || [ 'data:', 'blob:' ].includes( url.protocol ) ? route.continue() : route.abort();
	} );
	return context;
}

try {
	let origin;
	if ( ! options.input && screenshots ) {
		const { createServer } = await import( pathToFileURL( extensionRequire.resolve( 'vite' ) ) );
		server = await createServer( {
			configFile: join( root, 'apps/extension/tests/visual-server/vite.config.ts' ),
			logLevel: 'error',
			server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
		} );
		await server.listen();
		origin = server.resolvedUrls.local[ 0 ].replace( /\/$/, '' );
	}
	browser = await chromium.launch( { headless: true } );
	const context = await createCaptureContext( browser, origin, 'en-US', options.screenshot.scale );
	const compositor = await context.newPage();
	if ( screenshots ) {
		for ( const locale of options.locales ) {
			const captureContext = options.input ? null
				: await createCaptureContext(
					browser, origin, locales[ locale ].browserLocale, options.screenshot.scale,
				);
			try {
				for ( const scene of scenes ) {
					let capture;
					if ( options.input ) {
						capture = await readFile( join( options.input, `${ scene.number }-${ locales[ locale ].input }.png` ) );
					} else {
						const page = await captureContext.newPage();
						const errors = [];
						page.on( 'pageerror', ( error ) => errors.push( error.message ) );
						try {
							capture = await captureScene( page, origin, scene, locale );
							if ( errors.length ) {
								throw new Error( errors.join( '\n' ) );
							}
						} finally {
							await page.close();
						}
					}
					const rawDirectory = join( options.output, 'captures', locale );
					await mkdir( rawDirectory, { recursive: true } );
					await writeFile( join( rawDirectory, `${ scene.number }-${ scene.id }.png` ), capture );
					const asset = { kind: 'screenshot', scene: scene.id, locale, store: options.store, ...options.screenshot,
						caption: locales[ locale ].captions[ scene.number - 1 ], file: `${ locale }/${ scene.number }-${ scene.id }.png` };
					await saveAsset( await renderAsset( compositor, masters, { ...asset, capture } ), asset );
				}
			} finally {
				await captureContext?.close();
			}
		}
	}
	if ( promotional ) {
		const promotionalAssets = options.store === 'edge' ? createEdgePromos( options.locales ) : promos;
		for ( const asset of promotionalAssets ) {
			await saveAsset( await renderAsset( compositor, masters, asset ), asset );
		}
		if ( options.store === 'edge' ) {
			await saveAsset( await sharp( masters.icon, { density: 450 } ).resize( 300, 300, { fit: 'fill' } ).png().toBuffer(), {
				kind: 'logo', width: 300, height: 300, transparent: true, file: 'extension-logo-300x300.png',
			} );
			const terms = options.locales.map( ( locale ) => `${ locale }\n${ edgeListings[ locale ].searchTerms.join( ', ' ) }` ).join( '\n\n' );
			await writeFile( join( options.output, 'search-terms.txt' ), `${ terms }\n` );
		}
	}
	if ( og ) {
		for ( const asset of createOgAssets( options.locales ) ) {
			await saveAsset( await renderOgAsset( compositor, masters, asset ), asset );
		}
		if ( options.syncWebsite ) {
			await syncOgImages( root, options.output, options.locales );
			console.log( 'Updated website OG images; only finished locale PNGs were copied.' );
		}
	}
	await writeFile( join( options.output, 'manifest.json' ), `${ JSON.stringify( {
		store: og ? null : options.store,
		captureSource: og ? 'local-og-masters' : ( options.input ? 'provided-screenshots' : 'production-ui-fixtures' ),
		...( screenshots ? { statistics: 'Deterministic example data, not measured usage or a promised outcome.' } : {} ),
		artifacts,
	}, null, 2 ) }\n` );
	const cards = artifacts.map( ( asset ) => `<figure><img src="${ asset.file }" loading="lazy" alt="${ escapeHtml( asset.caption ?? asset.kind ) }"><figcaption>${ escapeHtml( asset.file ) }</figcaption></figure>` ).join( '\n' );
	await writeFile( join( options.output, 'index.html' ), `<!doctype html><html lang="en"><meta charset="utf-8"><title>TOCus store assets</title><style>body{background:#fff8f0;color:#332216;font:16px system-ui;margin:40px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:32px}figure{margin:0}img{width:100%;height:auto}figcaption{padding:10px 0}</style><h1>TOCus store assets</h1><main>${ cards }</main></html>` );
	console.log( `\nPreview: ${ join( options.output, 'index.html' ) }` );
} finally {
	await browser?.close();
	await server?.close();
}
