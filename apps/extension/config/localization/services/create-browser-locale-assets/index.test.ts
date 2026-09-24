import type { CatalogType } from '@lingui/cli/api';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedPublicFile } from 'wxt';
import {
	addBrowserLocaleAssets,
	createBrowserLocaleAssets,
} from './index.ts';

describe( 'createBrowserLocaleAssets', () => {
	it( 'projects every browser locale from canonical translated metadata', async () => {
		const catalog: CatalogType = {
			name: {
				context: 'Extension name',
				message: 'TOCus - Pause before visiting addictive websites',
				translation: 'Localized TOCus',
			},
			description: {
				context: 'Extension description',
				message: 'TOCus adds a short breathing pause before the websites you choose, so you can notice the impulse and decide what to do next.',
				translation: 'Localized description',
			},
		};
		const readCatalog = vi.fn().mockResolvedValue( catalog );

		const assets = await createBrowserLocaleAssets( { readCatalog } );

		expect( assets ).toHaveLength( 10 );
		expect( assets[ 0 ]?.relativeDest ).toBe( '_locales/en/messages.json' );
		expect( JSON.parse( assets[ 0 ]?.contents ?? '' ) ).toEqual( {
			extensionName: { message: 'Localized TOCus', description: 'Extension name.' },
			extensionDescription: {
				message: 'Localized description',
				description: 'Short extension description shown by the browser and extension store.',
			},
		} );
		expect( assets.some( ( asset ) => asset.relativeDest === '_locales/es_419/messages.json' ) ).toBe( true );
	} );

	it( 'rejects a catalog with incomplete browser metadata', async () => {
		const readCatalog = vi.fn().mockResolvedValue( {} );

		await expect( createBrowserLocaleAssets( { readCatalog } ) ).rejects.toThrow(
			'Browser metadata is incomplete for en.',
		);
	} );

	it( 'adds all generated locale assets to a WXT public-asset collection', async () => {
		const files: Array<ResolvedPublicFile> = [];

		await addBrowserLocaleAssets( undefined, files );

		expect( files ).toHaveLength( 10 );
	} );

	it.each( [
		[ 'es', 'TOCus - Haz una pausa antes de visitar sitios adictivos', 'TOCus a\u00f1ade una pausa' ],
		[ 'es_419', 'TOCus - Hac\u00e9 una pausa antes de visitar sitios adictivos', 'TOCus agrega una pausa' ],
	] )( 'exports the intended Spanish name and description for %s', async ( locale, name, description ) => {
		const assets = await createBrowserLocaleAssets();
		const asset = assets.find( ( candidate ) => candidate.relativeDest === `_locales/${ locale }/messages.json` );
		const messages: unknown = JSON.parse( asset?.contents ?? '' );

		expect( messages ).toHaveProperty( 'extensionName.message', name );
		expect( messages ).toHaveProperty( 'extensionDescription.message', expect.stringContaining( description ) );
	} );
} );
