import { describe, expect, it } from 'vitest';
import { readLocalizationCatalog } from './index.ts';

describe( 'readLocalizationCatalog', () => {
	it( 'reads one canonical extension PO catalog', async () => {
		const catalog = await readLocalizationCatalog( 'en' );
		const extensionName = Object.values( catalog ).find( ( entry ) => entry.context === 'Extension name' );

		expect( extensionName?.message ).toBe( 'TOCus' );
		expect( extensionName?.translation ).toBe( 'TOCus' );
	} );
} );
