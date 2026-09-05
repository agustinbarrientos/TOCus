import { type CatalogType } from '@lingui/cli/api';
import { describe, expect, it, vi } from 'vitest';
import { type ResolvedPublicFile } from 'wxt';
import {
	addBrowserLocaleAssets,
	createBrowserLocaleAssets,
} from './index.ts';

describe( 'createBrowserLocaleAssets', () => {
	it( 'projects every browser locale from canonical translated metadata', async () => {
		const catalog: CatalogType = {
			name: {
				context: 'Extension name',
				message: 'TOCus',
				translation: 'Localized TOCus',
			},
			description: {
				context: 'Extension description',
				message: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
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
} );
