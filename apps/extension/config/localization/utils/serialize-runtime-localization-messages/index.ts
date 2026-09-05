import { type RuntimeLocalizationMessages } from '../../services/create-runtime-localization-messages/types.ts';

/**
 * Serializes one locale map as an immutable virtual JavaScript module.
 * @param messages - Runtime messages indexed by preference language.
 * @return JavaScript source exporting the immutable locale map.
 * @since 0.1.0 Initial implementation.
 */
export function serializeRuntimeLocalizationMessages( messages: RuntimeLocalizationMessages ): string {
	return `export const messagesByLanguage = Object.freeze(${ JSON.stringify( messages ) });`;
}
