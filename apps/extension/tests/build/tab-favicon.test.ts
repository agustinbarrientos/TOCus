import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';

/**
 * Browser packages that contain standalone extension documents.
 */
const outputs = [ 'chrome-mv3', 'firefox-mv2', 'safari-mv2' ] as const;

/**
 * Extension documents that can appear in a browser tab.
 */
const documents = [ 'onboarding', 'options', 'popup' ] as const;

describe( 'packaged tab favicons', () => {
	test.each( outputs )( 'does not advertise an icon from the %s pause documents into website redirect chains', async ( output ) => {
		for ( const document of [ 'interruption', 'pause' ] ) {
			const html = await readFile(
				new URL( `../../.output/${ output }/${ document }.html`, import.meta.url ),
				'utf8',
			);

			expect( html.match( /<link\b[^>]*\brel="icon"[^>]*>/gu ) ?? [], document ).toHaveLength( 0 );
		}
	} );

	test.each( outputs )( 'declares a local tab favicon for every %s document', async ( output ) => {
		for ( const document of documents ) {
			const html = await readFile(
				new URL( `../../.output/${ output }/${ document }.html`, import.meta.url ),
				'utf8',
			);
			const faviconLinks = html.match( /<link\b[^>]*\brel="icon"[^>]*>/gu ) ?? [];

			expect( faviconLinks, document ).toHaveLength( 1 );
			expect( faviconLinks[ 0 ] ).toContain( 'type="image/png"' );
			expect( faviconLinks[ 0 ] ).toContain( 'href="/icons/tab-light.png"' );
			await expect( readFile(
				new URL( `../../.output/${ output }/icons/tab-light.png`, import.meta.url ),
			) ).resolves.toBeInstanceOf( Buffer );
			await expect( readFile(
				new URL( `../../.output/${ output }/icons/tab-dark.png`, import.meta.url ),
			) ).resolves.toBeInstanceOf( Buffer );
		}
	} );
} );
