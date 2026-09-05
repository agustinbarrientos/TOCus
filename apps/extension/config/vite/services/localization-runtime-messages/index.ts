import { createRuntimeLocalizationMessages } from '../../../localization/services/create-runtime-localization-messages/index.ts';
import { serializeRuntimeLocalizationMessages } from '../../../localization/utils/serialize-runtime-localization-messages/index.ts';
import {
	type LocalizationRuntimeMessagesPlugin,
	type LocalizationRuntimeMessagesPluginOptions,
} from './types.ts';

/**
 * Public virtual module containing only toolbar localization messages.
 * @since 0.1.0 Initial implementation.
 */
export const ToolbarLocalizationModuleId = 'virtual:tocus/toolbar-localization';

/**
 * Public virtual module containing only protected-page localization messages.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedPageLocalizationModuleId = 'virtual:tocus/protected-page-localization';

/**
 * Internal Vite identifier for the toolbar localization module.
 * @since 0.1.0 Initial implementation.
 */
const ResolvedToolbarLocalizationModuleId = `\0${ ToolbarLocalizationModuleId }`;

/**
 * Internal Vite identifier for the protected-page localization module.
 * @since 0.1.0 Initial implementation.
 */
const ResolvedProtectedPageLocalizationModuleId = `\0${ ProtectedPageLocalizationModuleId }`;

/**
 * Source modules whose messages are needed by the toolbar background runtime.
 * @since 0.1.0 Initial implementation.
 */
const ToolbarMessageOrigins = Object.freeze( [
	'localization/utils/create-toolbar-copy/index.ts',
] );

/**
 * Source modules whose messages are needed by the injected protected-page runtime.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedPageMessageOrigins = Object.freeze( [
	'localization/utils/format-localized-duration/index.ts',
	'localization/utils/create-interruption-copy/index.ts',
	'localization/utils/create-protected-page-layer-copy/index.ts',
	'localization/utils/create-wellbeing-copy/index.ts',
] );

/**
 * Default runtime-message dependency for extension builds.
 * @since 0.1.0 Initial implementation.
 */
const DefaultOptions: Readonly<LocalizationRuntimeMessagesPluginOptions> = Object.freeze( {
	createRuntimeMessages: createRuntimeLocalizationMessages,
} );

/**
 * Resolves a supported public runtime-localization module identifier.
 * @param source - Imported module identifier.
 * @return Internal virtual identifier or null for another plugin.
 * @since 0.1.0 Initial implementation.
 */
export function resolveLocalizationRuntimeModuleId( source: string ): string | null {
	switch ( source ) {
		case ToolbarLocalizationModuleId:
			return ResolvedToolbarLocalizationModuleId;
		case ProtectedPageLocalizationModuleId:
			return ResolvedProtectedPageLocalizationModuleId;
		default:
			return null;
	}
}

/**
 * Loads a supported focused runtime-localization virtual module.
 * @param id - Resolved virtual module identifier.
 * @param options - Injectable runtime-message dependency.
 * @return Generated JavaScript module or null for another plugin.
 * @since 0.1.0 Initial implementation.
 */
export async function loadLocalizationRuntimeModule(
	id: string,
	options: Readonly<LocalizationRuntimeMessagesPluginOptions> = DefaultOptions,
): Promise<string | null> {
	switch ( id ) {
		case ResolvedToolbarLocalizationModuleId:
			return serializeRuntimeLocalizationMessages(
				await options.createRuntimeMessages( ToolbarMessageOrigins ),
			);
		case ResolvedProtectedPageLocalizationModuleId:
			return serializeRuntimeLocalizationMessages(
				await options.createRuntimeMessages( ProtectedPageMessageOrigins ),
			);
		default:
			return null;
	}
}

/**
 * Creates virtual modules that exclude settings-only translations from classic runtimes.
 * @param options - Injectable runtime-message dependency.
 * @return Vite plugin serving toolbar and protected-page locale projections.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizationRuntimeMessagesPlugin(
	options: Readonly<LocalizationRuntimeMessagesPluginOptions> = DefaultOptions,
): LocalizationRuntimeMessagesPlugin {
	return {
		name: 'tocus-localization-runtime-messages',
		resolveId: resolveLocalizationRuntimeModuleId,
		/**
		 * Loads one focused runtime localization module.
		 * @param id - Resolved virtual module identifier.
		 * @return Generated JavaScript module or null for another plugin.
		 * @since 0.1.0 Initial implementation.
		 */
		async load( id ) {
			return loadLocalizationRuntimeModule( id, options );
		},
	};
}

export {
	type LocalizationRuntimeMessagesPlugin,
	type LocalizationRuntimeMessagesPluginOptions,
	type RuntimeLocalizationMessagesCreator,
} from './types.ts';
