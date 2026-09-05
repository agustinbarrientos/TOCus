import { type RuntimeLocalizationMessages } from '../../../localization/services/create-runtime-localization-messages/types.ts';

/**
 * Creates runtime messages for selected localization source modules.
 * @since 0.1.0 Initial implementation.
 */
export type RuntimeLocalizationMessagesCreator = (
	origins: ReadonlyArray<string>,
) => Promise<RuntimeLocalizationMessages>;

/**
 * Dependencies used by the runtime-localization Vite plugin.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationRuntimeMessagesPluginOptions {
	createRuntimeMessages: RuntimeLocalizationMessagesCreator;
}

/**
 * Focused Vite plugin serving extension runtime translations.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationRuntimeMessagesPlugin {
	/** Plugin identifier exposed to Vite diagnostics. */
	name: string;
	/** Resolves a supported public virtual module identifier. */
	resolveId: ( source: string ) => string | null;
	/** Loads one supported virtual localization module. */
	load: ( id: string ) => Promise<string | null>;
}
