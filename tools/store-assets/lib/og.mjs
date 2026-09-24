/* global document */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataUrl, escapeHtml, loadBrand } from './render.mjs';

/**
 * Reviewed line breaks and typography matching the original 1200 by 628 artwork.
 * @since 1.0.0
 */
export const ogLayouts = {
	en: { size: 76, headline: [ 'Pause before', 'visiting addictive', 'websites' ] },
	'es-tu': { size: 70, headline: [ 'Haz una pausa', 'antes de visitar', 'sitios adictivos' ] },
	'es-vos': { size: 70, headline: [ 'Hac\u00e9 una pausa', 'antes de visitar', 'sitios adictivos' ] },
	de: { size: 62, headline: [ 'Halte kurz inne, bevor', 'du s\u00fcchtig machende', 'Seiten \u00f6ffnest' ] },
	fr: { size: 70, headline: [ 'Fais une pause', "avant d'ouvrir des", 'sites addictifs' ] },
	it: { size: 68, headline: [ 'Fai una pausa prima', 'di aprire siti che', 'creano dipendenza' ] },
	ja: { font: 'Chiron GoRound TC', size: 76, weight: 700, headline: [
		'\u4e2d\u6bd2\u6027\u306e\u3042\u308b', '\u30b5\u30a4\u30c8\u3092\u958b\u304f', '\u524d\u306b\u3001\u3072\u3068\u547c\u5438',
	] },
	'pt-BR': { size: 72, headline: [ 'Fa\u00e7a uma pausa', 'antes de visitar', 'sites viciantes' ] },
	'pt-PT': { size: 70, headline: [ 'Faz uma pausa', 'antes de visitares', 'sites viciantes' ] },
	ru: { font: 'Nunito', size: 60, weight: 800, headline: [
		'\u0421\u0434\u0435\u043b\u0430\u0439 \u043f\u0430\u0443\u0437\u0443 \u043f\u0435\u0440\u0435\u0434',
		'\u0432\u0445\u043e\u0434\u043e\u043c \u043d\u0430',
		'\u0437\u0430\u0442\u044f\u0433\u0438\u0432\u0430\u044e\u0449\u0438\u0435 \u0441\u0430\u0439\u0442\u044b',
	] },
};

/**
 * Selects localized share cards using the filenames already referenced by social metadata.
 * @param {string[]} localeCodes - Validated application locales.
 * @return {object[]} Fixed-size output contracts with editable text and typography.
 * @since 1.0.0
 */
export function createOgAssets( localeCodes ) {
	return localeCodes.map( ( locale ) => {
		if ( ! Object.hasOwn( ogLayouts, locale ) ) {
			throw new Error( `Unknown OG locale: ${ locale }` );
		}
		return { kind: 'og', locale, width: 1200, height: 628, file: `${ locale.toLowerCase() }.png`,
			font: 'Fredoka', weight: 600, ...ogLayouts[ locale ] };
	} );
}

/**
 * Loads only local assets; full character coverage keeps future headline edits portable.
 * @param {string} root - Repository root.
 * @return {Promise<object>} Self-contained background, fonts, wordmark and supported browser icons.
 * @since 1.0.0
 */
export async function loadOgMasters( root ) {
	const fonts = [
		[ 'Fredoka', '300 700', `${ root }/packages/theme/node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2` ],
		[ 'Chiron GoRound TC', '200 900', new URL( '../assets/fonts/chiron-go-round-tc.woff2', import.meta.url ) ],
		[ 'Nunito', '200 1000', new URL( '../assets/fonts/nunito.woff2', import.meta.url ) ],
	];
	let css = await readFile( new URL( './og.css', import.meta.url ), 'utf8' );
	for ( const [ family, weight, path ] of fonts ) {
		css += `\n@font-face{font-family:'${ family }';src:url('${ dataUrl( await readFile( path ), 'font/woff2' ) }');font-weight:${ weight };}`;
	}
	const browsers = [];
	for ( const browser of [ 'chrome', 'edge', 'firefox' ] ) {
		browsers.push( { name: browser, image: dataUrl( await readFile( `${ root }/apps/website/public/badges/browser-${ browser }.svg` ), 'image/svg+xml' ) } );
	}
	return { css, ...await loadBrand( root, '#2d2017' ), browsers,
		background: dataUrl( await readFile( new URL( '../assets/og-background.png', import.meta.url ) ) ) };
}

/**
 * Composes the original share-card layout and rejects missing fonts or overflowing headlines.
 * @param {import('playwright').Page} page - Offline composition document.
 * @param {object} masters - Reusable local artwork and fonts.
 * @param {object} asset - Locale, headline, size and typography contract.
 * @return {Promise<Buffer>} Opaque 1200 by 628 card pixels.
 * @since 1.0.0
 */
export async function renderOgAsset( page, masters, asset ) {
	await page.setViewportSize( { width: asset.width, height: asset.height } );
	await page.setContent( `<!doctype html><html lang="${ asset.locale }"><meta charset="utf-8">
		<style>${ masters.css }</style><body><main>
		<img class="og-background" src="${ masters.background }" alt="">
		<img class="og-brand" src="${ masters.logo }" alt="TOCus">
		<h1 style="font-family:'${ asset.font }';font-size:${ asset.size }px;font-weight:${ asset.weight }">
			${ asset.headline.map( ( line ) => `<span>${ escapeHtml( line ) }</span>` ).join( '' ) }
		</h1><div class="og-browsers">${ masters.browsers.map( ( browser ) =>
			`<img src="${ browser.image }" alt="${ browser.name }">` ).join( '' ) }</div>
		</main></body></html>` );
	await page.evaluate( async ( { font, weight, size, headline } ) => {
		await document.fonts.ready;
		await Promise.all( Array.from( document.images, ( image ) => image.decode() ) );
		const loaded = await document.fonts.load( `${ weight } ${ size }px "${ font }"`, headline.join( '' ) );
		if ( ! loaded.length || loaded.some( ( face ) => face.status !== 'loaded' ) ) {
			throw new Error( `OG font failed to load: ${ font }` );
		}
		const title = document.querySelector( 'h1' );
		const bounds = title.getBoundingClientRect();
		for ( const line of title.children ) {
			if ( line.scrollWidth > title.clientWidth ) {
				throw new Error( `OG headline exceeds its text area: ${ line.textContent }` );
			}
		}
		if ( bounds.bottom > document.querySelector( '.og-browsers' ).getBoundingClientRect().top ) {
			throw new Error( 'OG headline overlaps the browser icons.' );
		}
	}, asset );
	return page.screenshot( { type: 'png', animations: 'disabled' } );
}

/**
 * Copies only generated locale PNGs into the existing website asset directory.
 * @param {string} root - Repository root, never a deployment destination.
 * @param {string} output - Private generation directory.
 * @param {string[]} localeCodes - Selected application locales.
 * @return {Promise<void>} Updated public images; tooling and previews stay private.
 * @since 1.0.0
 */
export async function syncOgImages( root, output, localeCodes ) {
	const assets = createOgAssets( localeCodes );
	const destination = join( root, 'apps/website/public/images/og' );
	await mkdir( destination, { recursive: true } );
	for ( const asset of assets ) {
		await copyFile( join( output, asset.file ), join( destination, asset.file ) );
	}
}
