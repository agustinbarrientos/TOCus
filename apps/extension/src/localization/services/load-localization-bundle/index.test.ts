import { describe, expect, it, vi } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import {
	createEnglishLocalizationBundle,
	loadLocalizationBundle,
} from './index';

describe( 'loadLocalizationBundle', () => {
	it( 'loads the requested language through the injected catalog boundary', async () => {
		const messagesLoader = vi.fn().mockResolvedValue( {} );

		const bundle = await loadLocalizationBundle( Language.FRENCH, messagesLoader );

		expect( messagesLoader ).toHaveBeenCalledOnce();
		expect( messagesLoader ).toHaveBeenCalledWith( Language.FRENCH );
		expect( bundle.language ).toBe( Language.FRENCH );
	} );

	it( 'falls back to packaged English when the requested catalog fails', async () => {
		const bundle = await loadLocalizationBundle(
			Language.FRENCH,
			() => Promise.reject( new Error( 'Unavailable catalog.' ) ),
		);

		expect( bundle.language ).toBe( Language.ENGLISH );
		expect( bundle.document.settingsTitle ).toBe( 'TOCus settings' );
	} );

	it( 'creates packaged English recovery copy without a catalog request', () => {
		const bundle = createEnglishLocalizationBundle();

		expect( bundle.language ).toBe( Language.ENGLISH );
		expect( bundle.onboarding.startupErrorTitle ).toBe( 'TOCus could not finish opening' );
	} );
} );
