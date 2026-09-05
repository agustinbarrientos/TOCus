import { describe, expect, it, vi } from 'vitest';
import { Language } from '../../../../domains/preferences/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { createOnboardingLocalizationCoordinator } from './index';

describe( 'createOnboardingLocalizationCoordinator', () => {
	it( 'applies only the newest language when an older request resolves later', async () => {
		const english = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const japanese = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const apply = vi.fn();
		const coordinator = createOnboardingLocalizationCoordinator( {
			apply,
			load: vi.fn( ( language ) => language === Language.JAPANESE
				? japanese.promise
				: english.promise ),
		} );
		const englishRequest = coordinator.request( Language.ENGLISH );
		const japaneseRequest = coordinator.request( Language.JAPANESE );
		const japaneseBundle = {
			...TestEnglishLocalizationBundle,
			language: Language.JAPANESE,
			languageTag: 'ja',
		};

		japanese.resolve( japaneseBundle );

		await expect( japaneseRequest ).resolves.toBe( true );
		expect( apply ).toHaveBeenCalledOnce();
		expect( apply ).toHaveBeenLastCalledWith( japaneseBundle );

		english.resolve( TestEnglishLocalizationBundle );

		await expect( englishRequest ).resolves.toBe( false );
		expect( apply ).toHaveBeenCalledOnce();
	} );

	it( 'waits for the selected language request before reporting readiness', async () => {
		const localization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const apply = vi.fn();
		const coordinator = createOnboardingLocalizationCoordinator( {
			apply,
			load: vi.fn().mockReturnValue( localization.promise ),
		} );
		const request = coordinator.request( Language.ENGLISH );
		const synchronization = coordinator.synchronize( Language.ENGLISH );
		let settled = false;

		void synchronization.then( () => {
			settled = true;
		} );
		await Promise.resolve();

		expect( settled ).toBe( false );

		localization.resolve( TestEnglishLocalizationBundle );

		await expect( request ).resolves.toBe( true );
		await expect( synchronization ).resolves.toBe( true );
		expect( apply ).toHaveBeenCalledOnce();
	} );

	it( 'reuses one pending request and an already applied language', async () => {
		const localization = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const load = vi.fn().mockReturnValue( localization.promise );
		const coordinator = createOnboardingLocalizationCoordinator( {
			apply: vi.fn(),
			load,
		} );
		const firstRequest = coordinator.request( Language.ENGLISH );
		const duplicateRequest = coordinator.request( Language.ENGLISH );

		expect( duplicateRequest ).toBe( firstRequest );
		expect( load ).toHaveBeenCalledOnce();

		localization.resolve( TestEnglishLocalizationBundle );

		await expect( firstRequest ).resolves.toBe( true );
		await expect( coordinator.request( Language.ENGLISH ) ).resolves.toBe( true );
		expect( load ).toHaveBeenCalledOnce();
	} );

	it( 'does not report an older language ready while a newer request is pending', async () => {
		const japanese = Promise.withResolvers<typeof TestEnglishLocalizationBundle>();
		const coordinator = createOnboardingLocalizationCoordinator( {
			apply: vi.fn(),
			load: vi.fn().mockReturnValue( japanese.promise ),
		} );

		void coordinator.request( Language.JAPANESE );

		await expect( coordinator.synchronize( Language.ENGLISH ) ).resolves.toBe( false );
	} );

	it( 'retries a selected language after its previous load failed', async () => {
		const load = vi.fn()
			.mockRejectedValueOnce( new Error( 'Catalog unavailable.' ) )
			.mockResolvedValueOnce( TestEnglishLocalizationBundle );
		const apply = vi.fn();
		const coordinator = createOnboardingLocalizationCoordinator( { apply, load } );

		await expect( coordinator.request( Language.ENGLISH ) ).rejects.toThrow( 'Catalog unavailable.' );
		await expect( coordinator.synchronize( Language.ENGLISH ) ).resolves.toBe( true );
		expect( load ).toHaveBeenCalledTimes( 2 );
		expect( apply ).toHaveBeenCalledOnce();
	} );

	it( 'reports a requested language unavailable when the applied bundle is an English fallback', async () => {
		const load = vi.fn().mockResolvedValue( TestEnglishLocalizationBundle );
		const apply = vi.fn();
		const coordinator = createOnboardingLocalizationCoordinator( { apply, load } );

		await expect( coordinator.request( Language.SPANISH_TU ) ).resolves.toBe( false );
		expect( apply ).toHaveBeenCalledOnce();
		expect( apply ).toHaveBeenLastCalledWith( TestEnglishLocalizationBundle );
		await expect( coordinator.synchronize( Language.ENGLISH ) ).resolves.toBe( true );
		expect( load ).toHaveBeenCalledOnce();
	} );

	it( 'does not replace a failed newest selection with an older language', async () => {
		const coordinator = createOnboardingLocalizationCoordinator( {
			apply: vi.fn(),
			load: vi.fn().mockRejectedValue( new Error( 'Catalog unavailable.' ) ),
		} );

		await expect( coordinator.request( Language.JAPANESE ) ).rejects.toThrow( 'Catalog unavailable.' );
		await expect( coordinator.synchronize( Language.ENGLISH ) ).resolves.toBe( false );
	} );
} );
