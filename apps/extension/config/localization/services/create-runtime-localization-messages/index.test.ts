import { type CatalogType } from '@lingui/cli/api';
import { setupI18n } from '@lingui/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Language } from '../../../../src/domains/preferences/types.ts';
import { createRuntimeLocalizationMessages } from './index.ts';

/**
 * Runtime projections and their complete expected message counts.
 * @since 0.1.0 Initial implementation.
 */
const RuntimeProjectionCases = [
	{
		expectedMessageCount: 16,
		label: 'toolbar',
		origins: [ 'localization/utils/create-toolbar-copy/index.ts' ],
	},
	{
		expectedMessageCount: 30,
		label: 'protected page',
		origins: [
			'localization/utils/format-localized-duration/index.ts',
			'localization/utils/create-interruption-copy/index.ts',
			'localization/utils/create-protected-page-layer-copy/index.ts',
			'localization/utils/create-wellbeing-copy/index.ts',
		],
	},
] as const;

describe( 'createRuntimeLocalizationMessages', () => {
	afterEach( () => {
		vi.unstubAllEnvs();
	} );

	it( 'keeps only messages originating in the selected runtime modules', async () => {
		const catalog: CatalogType = {
			included: {
				message: 'Included',
				origin: [ [ 'localization/utils/create-toolbar-copy/index.ts', 1 ] ],
				translation: 'Included translation',
			},
			excluded: {
				message: 'Excluded',
				origin: [ [ 'localization/utils/create-language-screen-copy/index.ts', 1 ] ],
				translation: 'Excluded translation',
			},
			unattributed: {
				message: 'Unattributed',
				translation: 'Unattributed translation',
			},
		};
		const readCatalog = vi.fn().mockResolvedValue( catalog );

		const messages = await createRuntimeLocalizationMessages(
			[ 'localization/utils/create-toolbar-copy/index.ts' ],
			{ readCatalog },
		);

		expect( messages[ Language.ENGLISH ] ).toEqual( { included: [ 'Included translation' ] } );
		expect( Object.keys( messages ) ).toHaveLength( 10 );
	} );

	it( 'rejects an untranslated selected runtime message', async () => {
		const catalog: CatalogType = {
			missing: {
				message: 'Missing',
				origin: [ [ 'selected.ts', 1 ] ],
				translation: '',
			},
		};
		const readCatalog = vi.fn().mockResolvedValue( catalog );

		await expect(
			createRuntimeLocalizationMessages( [ 'selected.ts' ], { readCatalog } ),
		).rejects.toThrow( 'Runtime localization is incomplete for en: missing.' );
	} );

	it( 'formats interpolated and plural messages without the development compiler', async () => {
		const catalog: CatalogType = {
			greeting: {
				message: 'Hello, {name}',
				origin: [ [ 'selected.ts', 1 ] ],
				translation: 'Hello, {name}',
			},
			items: {
				message: '{count, plural, one {# item} other {# items}}',
				origin: [ [ 'selected.ts', 2 ] ],
				translation: '{count, plural, one {# item} other {# items}}',
			},
		};
		const messages = await createRuntimeLocalizationMessages(
			[ 'selected.ts' ],
			{ readCatalog: vi.fn().mockResolvedValue( catalog ) },
		);

		vi.stubEnv( 'NODE_ENV', 'production' );
		const i18n = setupI18n( {
			locale: 'en',
			messages: { en: messages[ Language.ENGLISH ] },
		} );

		expect( i18n._( 'greeting', { name: 'Mara' } ) ).toBe( 'Hello, Mara' );
		expect( i18n._( 'items', { count: 1 } ) ).toBe( '1 item' );
		expect( i18n._( 'items', { count: 2 } ) ).toBe( '2 items' );
	} );

	it.each( RuntimeProjectionCases )(
		'projects the complete translated $label catalog for every supported language',
		async ( { expectedMessageCount, origins } ) => {
			const messages = await createRuntimeLocalizationMessages( origins );
			const englishMessageIds = Object.keys( messages[ Language.ENGLISH ] ).sort();

			expect( englishMessageIds ).toHaveLength( expectedMessageCount );

			for ( const language of Object.values( Language ) ) {
				expect( Object.keys( messages[ language ] ).sort(), language ).toEqual(
					englishMessageIds,
				);
				expect(
					Object.values( messages[ language ] ).every( ( message ) => message.length > 0 ),
					language,
				).toBe( true );
			}
		},
	);
} );
