import { type CatalogType } from '@lingui/cli/api';
import { type ResolvedPublicFile } from 'wxt';
import { readLocalizationCatalog } from '../read-localization-catalog/index.ts';
import { ExtensionCatalogs } from '../../utils/catalog-locales/index.ts';
import {
	type BrowserLocaleAsset,
	type CreateBrowserLocaleAssetsOptions,
} from './types.ts';

/**
 * Source message and translator context identifying the extension name.
 * @since 0.1.0 Initial implementation.
 */
const ExtensionNameMessage = Object.freeze( {
	context: 'Extension name',
	message: 'TOCus',
} );

/**
 * Source message and translator context identifying the extension description.
 * @since 0.1.0 Initial implementation.
 */
const ExtensionDescriptionMessage = Object.freeze( {
	context: 'Extension description',
	message: 'A gentle pause before distracting websites, designed to help you return to your intentions.',
} );

/**
 * Default catalog dependency for extension builds.
 * @since 0.1.0 Initial implementation.
 */
const DefaultOptions: Readonly<CreateBrowserLocaleAssetsOptions> = Object.freeze( {
	readCatalog: readLocalizationCatalog,
} );

/**
 * Finds one translated browser metadata message by its source and context.
 * @param catalog - Parsed canonical Lingui catalog.
 * @param message - English source message.
 * @param context - Translator context disambiguating the source message.
 * @param locale - Locale reported when the translation is missing.
 * @return Complete translated browser metadata value.
 * @since 0.1.0 Initial implementation.
 */
function getBrowserMetadataTranslation(
	catalog: CatalogType,
	message: string,
	context: string,
	locale: string,
): string {
	const translation = Object.values( catalog ).find(
		( candidate ) => candidate.message === message && candidate.context === context,
	)?.translation;

	if ( ! translation ) {
		throw new Error( `Browser metadata is incomplete for ${ locale }.` );
	}

	return translation;
}

/**
 * Serializes browser-managed metadata from one canonical catalog.
 * @param catalog - Parsed canonical Lingui catalog.
 * @param locale - Canonical catalog locale.
 * @return Pretty-printed browser localization file contents.
 * @since 0.1.0 Initial implementation.
 */
function serializeBrowserLocaleMessages( catalog: CatalogType, locale: string ): string {
	const name = getBrowserMetadataTranslation(
		catalog,
		ExtensionNameMessage.message,
		ExtensionNameMessage.context,
		locale,
	);
	const description = getBrowserMetadataTranslation(
		catalog,
		ExtensionDescriptionMessage.message,
		ExtensionDescriptionMessage.context,
		locale,
	);

	return `${ JSON.stringify( {
		extensionName: {
			message: name,
			description: 'Extension name.',
		},
		extensionDescription: {
			message: description,
			description: 'Short extension description shown by the browser and extension store.',
		},
	}, null, '\t' ) }\n`;
}

/**
 * Creates browser-managed metadata assets from canonical PO catalogs.
 * @param options - Injectable catalog dependency.
 * @return Complete generated browser locale assets.
 * @since 0.1.0 Initial implementation.
 */
export async function createBrowserLocaleAssets(
	options: Readonly<CreateBrowserLocaleAssetsOptions> = DefaultOptions,
): Promise<ReadonlyArray<BrowserLocaleAsset>> {
	const assets: Array<BrowserLocaleAsset> = [];

	for ( const catalogDefinition of ExtensionCatalogs ) {
		if ( catalogDefinition.browserLocales.length === 0 ) {
			continue;
		}

		const catalog = await options.readCatalog( catalogDefinition.locale );
		const contents = serializeBrowserLocaleMessages( catalog, catalogDefinition.locale );

		for ( const browserLocale of catalogDefinition.browserLocales ) {
			assets.push( {
				relativeDest: `_locales/${ browserLocale }/messages.json`,
				contents,
			} );
		}
	}

	return Object.freeze( assets );
}

/**
 * Adds browser-managed localization assets to one WXT build.
 * @param _wxt - Active WXT build context.
 * @param files - Mutable public-asset collection for the build.
 * @return Promise resolved after every locale asset is appended.
 * @since 0.1.0 Initial implementation.
 */
export async function addBrowserLocaleAssets(
	_wxt: unknown,
	files: Array<ResolvedPublicFile>,
): Promise<void> {
	files.push( ...await createBrowserLocaleAssets() );
}

export {
	type BrowserLocaleAsset,
	type CreateBrowserLocaleAssetsOptions,
} from './types.ts';
