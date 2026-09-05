import { type CatalogType } from '@lingui/cli/api';
import { type Messages } from '@lingui/core';
import { compileMessageOrThrow } from '@lingui/message-utils/compileMessage';
import { Language } from '../../../../src/domains/preferences/types.ts';
import {
	ExtensionCatalogs,
	type ExtensionCatalog,
} from '../../utils/catalog-locales/index.ts';
import { readLocalizationCatalog } from '../read-localization-catalog/index.ts';
import {
	type CreateRuntimeLocalizationMessagesOptions,
	type RuntimeLocalizationMessages,
} from './types.ts';

/**
 * Default catalog dependency for runtime projections.
 * @since 0.1.0 Initial implementation.
 */
const DefaultOptions: Readonly<CreateRuntimeLocalizationMessagesOptions> = Object.freeze( {
	readCatalog: readLocalizationCatalog,
} );

/**
 * Reports whether one catalog entry originated in a selected runtime module.
 * @param entry - Parsed Lingui catalog entry.
 * @param origins - Source-module suffixes included in the runtime projection.
 * @return Whether the selected runtime needs the entry.
 * @since 0.1.0 Initial implementation.
 */
function hasSelectedOrigin(
	entry: CatalogType[ string ],
	origins: ReadonlyArray<string>,
): boolean {
	return entry.origin?.some(
		( [ filename ] ) => origins.some( ( origin ) => filename.endsWith( origin ) ),
	) ?? false;
}

/**
 * Projects selected translated messages from one parsed catalog.
 * @param catalog - Parsed canonical Lingui catalog.
 * @param locale - Canonical catalog locale.
 * @param origins - Source-module suffixes included in the runtime projection.
 * @return Complete runtime message projection.
 * @since 0.1.0 Initial implementation.
 */
function projectRuntimeMessages(
	catalog: CatalogType,
	locale: string,
	origins: ReadonlyArray<string>,
): Readonly<Messages> {
	const messages: Messages = {};

	for ( const [ messageId, entry ] of Object.entries( catalog ) ) {
		if ( ! hasSelectedOrigin( entry, origins ) ) {
			continue;
		}

		if ( ! entry.translation ) {
			throw new Error( `Runtime localization is incomplete for ${ locale }: ${ messageId }.` );
		}

		messages[ messageId ] = compileMessageOrThrow( entry.translation );
	}

	return Object.freeze( messages );
}

/**
 * Loads and projects one canonical runtime localization catalog.
 * @param definition - Canonical catalog definition.
 * @param origins - Source-module suffixes included in the runtime projection.
 * @param options - Injectable catalog dependency.
 * @return Focused translated messages for the catalog language.
 * @since 0.1.0 Initial implementation.
 */
async function loadRuntimeMessages(
	definition: Readonly<ExtensionCatalog>,
	origins: ReadonlyArray<string>,
	options: Readonly<CreateRuntimeLocalizationMessagesOptions>,
): Promise<Readonly<Messages>> {
	return projectRuntimeMessages(
		await options.readCatalog( definition.locale ),
		definition.locale,
		origins,
	);
}

/**
 * Creates a locale map containing only messages used by selected runtime modules.
 * @param origins - Source-module suffixes included in the runtime projection.
 * @param options - Injectable catalog dependency.
 * @return Runtime messages indexed by every supported preference language.
 * @since 0.1.0 Initial implementation.
 */
export async function createRuntimeLocalizationMessages(
	origins: ReadonlyArray<string>,
	options: Readonly<CreateRuntimeLocalizationMessagesOptions> = DefaultOptions,
): Promise<RuntimeLocalizationMessages> {
	const [
		englishMessages,
		spanishTuMessages,
		spanishVosMessages,
		portugueseBrazilMessages,
		portuguesePortugalMessages,
		italianMessages,
		frenchMessages,
		germanMessages,
		japaneseMessages,
		russianMessages,
	] = await Promise.all( [
		loadRuntimeMessages( ExtensionCatalogs[ 0 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 1 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 2 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 3 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 4 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 5 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 6 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 7 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 8 ], origins, options ),
		loadRuntimeMessages( ExtensionCatalogs[ 9 ], origins, options ),
	] );

	return Object.freeze( {
		[ Language.ENGLISH ]: englishMessages,
		[ Language.SPANISH_TU ]: spanishTuMessages,
		[ Language.SPANISH_VOS ]: spanishVosMessages,
		[ Language.PORTUGUESE_BRAZIL ]: portugueseBrazilMessages,
		[ Language.PORTUGUESE_PORTUGAL ]: portuguesePortugalMessages,
		[ Language.ITALIAN ]: italianMessages,
		[ Language.FRENCH ]: frenchMessages,
		[ Language.GERMAN ]: germanMessages,
		[ Language.JAPANESE ]: japaneseMessages,
		[ Language.RUSSIAN ]: russianMessages,
	} );
}

export {
	type CreateRuntimeLocalizationMessagesOptions,
	type RuntimeLocalizationMessages,
} from './types.ts';
