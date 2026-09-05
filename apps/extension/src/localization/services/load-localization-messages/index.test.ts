import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { loadLocalizationMessages } from './index';

describe( 'loadLocalizationMessages', () => {
	it( 'loads only the requested packaged catalog', async () => {
		const messages = await loadLocalizationMessages( Language.JAPANESE );

		expect( Object.keys( messages ).length ).toBeGreaterThan( 0 );
	} );
} );
