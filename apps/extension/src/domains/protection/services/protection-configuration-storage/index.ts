import {
	ProtectionConfigurationDocumentSchema,
	ProtectionConfigurationDocumentVersion,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import {
	ProtectionConfigurationStorageKey,
	type ProtectionConfigurationStorageService,
	type ProtectionConfigurationStorageServiceOptions,
} from './types';

/**
 * Creates local persistence for protected-site configuration and editable display names.
 * @param options - Local browser storage dependency.
 * @return Protected-site configuration persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionConfigurationStorageService(
	options: ProtectionConfigurationStorageServiceOptions,
): ProtectionConfigurationStorageService {
	/**
	 * Loads the current protected-site configuration without replacing malformed stored data.
	 * @return Current configuration, an empty document, or null for malformed stored data.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(): Promise<ProtectionConfigurationDocument | null> {
		const values = await options.area.get( ProtectionConfigurationStorageKey.CONFIGURATION );

		if ( ! Object.hasOwn( values, ProtectionConfigurationStorageKey.CONFIGURATION ) ) {
			return ProtectionConfigurationDocumentSchema.parse( {
				schemaVersion: ProtectionConfigurationDocumentVersion,
				sites: [],
			} );
		}

		const configuration = ProtectionConfigurationDocumentSchema.safeParse(
			values[ ProtectionConfigurationStorageKey.CONFIGURATION ],
		);

		return configuration.success ? configuration.data : null;
	}

	/**
	 * Validates and stores one protected-site configuration document.
	 * @param input - Unknown configuration document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the configuration violates its storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function save( input: unknown ): Promise<void> {
		const configuration = ProtectionConfigurationDocumentSchema.parse( input );

		await options.area.set( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: configuration,
		} );
	}

	return { load, save };
}

export * from './types';
