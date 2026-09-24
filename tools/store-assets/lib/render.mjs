/* global document */
import { readFile } from 'node:fs/promises';
import { scenes } from './catalog.mjs';

/**
 * Escapes copy before it enters the local composition document.
 * @param {string} value - Caption or filename to escape.
 * @return {string} Safe HTML text.
 * @since 1.0.0
 */
export function escapeHtml( value ) {
	return value.replaceAll( '&', '&amp;' ).replaceAll( '<', '&lt;' ).replaceAll( '>', '&gt;' )
		.replaceAll( '"', '&quot;' ).replaceAll( "'", '&#39;' );
}

/**
 * Encodes an existing local asset without fetching any remote resources.
 * @param {Buffer} bytes - Encoded asset bytes.
 * @param {string} mime - Asset media type.
 * @return {string} Self-contained data URL.
 * @since 1.0.0
 */
export function dataUrl( bytes, mime = 'image/png' ) {
	return `data:${ mime };base64,${ bytes.toString( 'base64' ) }`;
}

/**
 * Loads reusable brand assets once for the entire batch.
 * @param {string} root - Repository root.
 * @return {Promise<object>} Local composition styles and masters.
 * @since 1.0.0
 */
export async function loadMasters( root ) {
	const font = await readFile( `${ root }/packages/theme/node_modules/@fontsource-variable/fredoka/files/fredoka-latin-ext-wght-normal.woff2` );
	const latin = await readFile( `${ root }/packages/theme/node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2` );
	let css = await readFile( new URL( './composition.css', import.meta.url ), 'utf8' );
	css = css.replace( '__FONT__', dataUrl( latin, 'font/woff2' ) );
	css += `\n@font-face{font-family:Fredoka;src:url('${ dataUrl( font, 'font/woff2' ) }');font-weight:300 700;unicode-range:U+0100-02FF,U+1E00-1EFF;}`;
	// Keep the original vector paths, with transparent face details and one dark ink.
	const logo = ( await readFile( `${ root }/packages/theme/assets/logo.svg`, 'utf8' ) )
		.replace( /<defs>.*?<\/defs>/s, '' )
		.replace( /<path[^>]+style="fill:#ffd5c2;"\/>/, '' )
		.replaceAll( 'fill:url(#b)', 'fill:#332216' )
		.replaceAll( 'fill:#b56e46', 'fill:#332216' );
	const artwork = {};
	for ( const name of [
		'riverside-background', 'capybara-thumbs-up', 'capybara-tango', 'capybara-point', 'capybara-agenda', 'capybara-medals',
		'promo-riverside', 'promo-closeup',
	] ) {
		artwork[ name ] = dataUrl( await readFile( new URL( `../assets/${ name }.png`, import.meta.url ) ) );
	}
	return { css, logo: dataUrl( Buffer.from( logo ), 'image/svg+xml' ), artwork };
}

/**
 * Renders a full-bleed composition with editable text and a centered, undistorted capture.
 * @param {import('playwright').Page} page - Offline composition document.
 * @param {object} masters - Local brand artwork and CSS.
 * @param {object} asset - Output kind, dimensions, locale and optional screenshot bytes.
 * @return {Promise<Buffer>} Rendered canvas ready to encode as an opaque PNG.
 * @since 1.0.0
 */
export async function renderAsset( page, masters, asset ) {
	await page.setViewportSize( { width: asset.width, height: asset.height } );
	const promo = asset.kind !== 'screenshot';
	const companion = promo ? null : scenes.find( ( scene ) => scene.id === asset.scene ).companion;
	const backdrop = promo ? ( asset.kind === 'small' ? 'promo-closeup' : 'promo-riverside' ) : 'riverside-background';
	const content = promo
		? `<img class="brand" src="${ masters.logo }" alt="TOCus">
			<h1>${ asset.headline.map( escapeHtml ).join( '<br>' ) }</h1>`
		: `<h1 class="caption">${ escapeHtml( asset.caption ) }</h1>
			<div class="frame-area"><img class="capture" src="${ dataUrl( asset.capture ) }" alt=""></div>
			<div class="companion companion-${ companion.side } ${ companion.pose }">
				<img src="${ masters.artwork[ `capybara-${ companion.pose }` ] }" alt="">
			</div>`;
	await page.setContent( `<!doctype html>
		<html lang="${ asset.locale ?? 'en' }">
			<head><meta charset="utf-8"><style>${ masters.css }</style></head>
			<body>
				<main class="canvas ${ promo ? 'promo' : '' } ${ asset.kind === 'small' ? 'small' : '' }">
					<img class="scenery" src="${ masters.artwork[ backdrop ] }" alt="">
					${ content }
				</main>
			</body>
		</html>` );
	await page.evaluate( async () => {
		await document.fonts.ready;
		await Promise.all( Array.from( document.images, ( image ) => image.decode() ) );
		const caption = document.querySelector( '.caption' );
		if ( caption ) {
			let size = 48;
			while ( caption.scrollWidth > caption.clientWidth && size > 28 ) {
				caption.style.fontSize = `${ --size }px`;
			}
			if ( caption.scrollWidth > caption.clientWidth ) {
				throw new Error( 'Caption exceeds the single-line canvas width.' );
			}
		}
	} );
	return page.screenshot( { type: 'png', animations: 'disabled' } );
}
