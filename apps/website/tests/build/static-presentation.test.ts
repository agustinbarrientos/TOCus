import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const WebsiteOutput = new URL( '../../dist/', import.meta.url );

for ( const browserName of [ 'chromium', 'firefox', 'webkit' ] as const ) {
	const browserTest = test.extend( { browserName } );
	browserTest( `${ browserName }: illustrated sections reflow without clipping text or overlapping cards`, async ( { page } ) => {
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await page.route( 'http://website.test/**', async ( route ) => {
			const url = new URL( route.request().url() );
			const path = url.pathname.endsWith( '/' ) ? `${ url.pathname }index.html` : url.pathname;
			await route.fulfill( { path: fileURLToPath( new URL( `.${ path }`, WebsiteOutput ) ) } );
		} );
		for ( const { width, height, fontSize } of [
			{ width: 1440, height: 900, fontSize: 16 }, { width: 768, height: 700, fontSize: 16 },
			{ width: 360, height: 640, fontSize: 24 }, { width: 320, height: 568, fontSize: 20 },
		] ) {
			await browserTest.step( `${ String( width ) }px viewport with ${ String( fontSize ) }px default text`, async () => {
				await page.setViewportSize( { width, height } );
				await page.goto( 'http://website.test/' );
				await expect( page.locator( '.homepage' ) ).toHaveAttribute( 'data-enhanced', 'true' );
				await page.evaluate( async ( size ) => {
					await document.fonts.ready;
					document.documentElement.style.fontSize = `${ String( size ) }px`;
				}, fontSize );
				await expect( page.locator( '.how-steps > li' ) ).toHaveCount( 4 );
				await expect( page.locator( '.feature-grid > li' ) ).toHaveCount( 6 );
				for ( const selector of [ '.how-steps > li', '.feature-grid > li' ] ) {
					const problems = await page.locator( selector ).evaluateAll( ( items ) => {
						const failures: string[] = [];
						const bounds = items.map( ( item ) => item.getBoundingClientRect() );
						for ( const [ index, item ] of items.entries() ) {
							const box = item.getBoundingClientRect();
							if ( box.left < -1 || box.right > innerWidth + 1 ) {
								failures.push( `Item ${ String( index ) } extends beyond the viewport` );
							}
							for ( const text of item.querySelectorAll( 'h3, p' ) ) {
								const walker = document.createTreeWalker( text, NodeFilter.SHOW_TEXT );
								while ( walker.nextNode() ) {
									const node = walker.currentNode;
									// Hidden service names support copying, not visible text layout.
									if ( node.parentElement?.closest( '[aria-hidden="true"]' ) ) {
										continue;
									}
									const range = document.createRange();
									range.selectNodeContents( node );
									for ( const line of range.getClientRects() ) {
										if ( line.left < box.left - 1 || line.right > box.right + 1 ) {
											failures.push( `Text exceeds item ${ String( index ) }: ${ text.textContent }` );
										}
										// Font metrics can extend past a line box without clipping when overflow is visible.
										for ( let ancestor: Element | null = text; ancestor;
											ancestor = ancestor.parentElement ) {
											const style = getComputedStyle( ancestor );
											const clip = ancestor.getBoundingClientRect();
											if ( ( style.overflowX !== 'visible' &&
												( line.left < clip.left - 1 || line.right > clip.right + 1 ) ) ||
												( style.overflowY !== 'visible' &&
												( line.top < clip.top - 1 || line.bottom > clip.bottom + 1 ) ) ) {
												failures.push( `Text is clipped in item ${ String( index ) }: ${ text.textContent }` );
											}
										}
										for ( const [ otherIndex, other ] of bounds.entries() ) {
											const width = Math.min( line.right, other.right ) -
												Math.max( line.left, other.left );
											const height = Math.min( line.bottom, other.bottom ) -
												Math.max( line.top, other.top );
											if ( otherIndex !== index && width > 1 && height > 1 ) {
												failures.push( `Text in item ${ String( index ) } overlaps another item` );
											}
										}
									}
								}
							}
							for ( const other of bounds.slice( index + 1 ) ) {
								if ( Math.min( box.right, other.right ) - Math.max( box.left, other.left ) > 1 &&
									Math.min( box.bottom, other.bottom ) - Math.max( box.top, other.top ) > 1 ) {
									failures.push( `Item ${ String( index ) } overlaps another item` );
								}
							}
						}
						return failures;
					} );
					expect( problems, selector ).toEqual( [] );
				}
				const download = page.locator( '#downloads [data-download-primary]' );
				await download.scrollIntoViewIfNeeded();
				await expect( download ).toBeInViewport();
				const sun = page.locator( '.download-sun' );
				await sun.evaluate( ( image: HTMLImageElement ) => image.decode() );
				await expect( sun ).toHaveCSS( 'animation-name', 'none' );
				expect( await sun.evaluate( ( image ) => {
					const panel = document.querySelector( '.download-panel' );
					return panel !== null &&
						image.getBoundingClientRect().bottom <= panel.getBoundingClientRect().top - 12;
				} ), 'The sun must remain above the panel with motion reduced' ).toBe( true );
				expect( await download.evaluate( ( element ) => {
					const box = element.getBoundingClientRect();
					return element.contains( document.elementFromPoint(
						box.x + box.width / 2, box.y + box.height / 2,
					) );
				} ), 'Decorative artwork must not cover the download action' ).toBe( true );
				expect( await page.evaluate( () => document.documentElement.scrollWidth <= innerWidth ) ).toBe( true );
			} );
		}
	} );
}
