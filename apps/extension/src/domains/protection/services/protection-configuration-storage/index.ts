import { z } from 'zod';
import {
	ProtectedSiteConfigurationSetSchema,
	ProtectionConfigurationDocumentSchema,
	ProtectionConfigurationDocumentVersion,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../types/protection-schedule';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { DefaultTimingConfiguration } from '../../types/timing-configuration';
import {
	ProtectionConfigurationStorageKey,
	type ProtectionConfigurationStorageService,
	type ProtectionConfigurationStorageServiceOptions,
} from './types';

/**
 * Validates the complete configuration document used before schedules and timing were persisted.
 * @since 0.1.0 Initial implementation.
 */
const VersionOneProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: z.literal( 1 ),
	sites: ProtectedSiteConfigurationSetSchema,
} ).strict();

/**
 * Creates the current configuration defaults for one validated protected-site set.
 * @param sites - Validated protected-site configurations to retain.
 * @return Current configuration with global timing and one default schedule per active scope.
 * @since 0.1.0 Initial implementation.
 */
function migrateVersionOneConfiguration(
	sites: ProtectionConfigurationDocument[ 'sites' ],
): ProtectionConfigurationDocument {
	const scopeIds = new Set( [ DefaultProtectionScopeId, ...sites.map( ( site ) => site.rule.scopeId ) ] );
	const schedulesByScope = Object.fromEntries(
		[ ...scopeIds ].map( ( scopeId ) => [ scopeId, DefaultProtectionSchedule ] ),
	);

	return ProtectionConfigurationDocumentSchema.parse( {
		schemaVersion: ProtectionConfigurationDocumentVersion,
		sites,
		timingConfiguration: DefaultTimingConfiguration,
		schedulesByScope,
	} );
}

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
			return migrateVersionOneConfiguration( [] );
		}

		const storedConfiguration = values[ ProtectionConfigurationStorageKey.CONFIGURATION ];
		const configuration = ProtectionConfigurationDocumentSchema.safeParse( storedConfiguration );

		if ( configuration.success ) {
			return configuration.data;
		}

		const versionOneConfiguration = VersionOneProtectionConfigurationDocumentSchema.safeParse(
			storedConfiguration,
		);

		return versionOneConfiguration.success
			? migrateVersionOneConfiguration( versionOneConfiguration.data.sites )
			: null;
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
