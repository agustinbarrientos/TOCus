import { z } from 'zod';
import {
	ProtectedSiteConfigurationSetSchema,
	ProtectionScopeScheduleMapSchema,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import { TimingConfigurationSchema } from '../../types/timing-configuration';

/**
 * Validates the complete configuration document used before schedules and timing were persisted.
 * @since 0.1.0 Initial implementation.
 */
export const VersionOneProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: z.number().int().nonnegative().refine( ( version ) => version === 1 ),
	sites: ProtectedSiteConfigurationSetSchema,
} ).strict();

/**
 * Validates the complete configuration document used before measurement revisions were persisted.
 * @since 0.1.0 Initial implementation.
 */
export const VersionTwoProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: z.number().int().nonnegative().refine( ( version ) => version === 2 ),
	sites: ProtectedSiteConfigurationSetSchema,
	timingConfiguration: TimingConfigurationSchema,
	schedulesByScope: ProtectionScopeScheduleMapSchema,
} ).strict();

/**
 * Stable key for the current protected-site configuration document.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationStorageKey = Object.freeze( {
	CONFIGURATION: 'tocus.protection.configuration.v1',
} as const );

/**
 * Local browser storage operations used by protected-site configuration persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionConfigurationStorageArea {
	/**
	 * Reads one storage key.
	 * @param key - Requested storage key.
	 * @return Stored values indexed by key.
	 * @since 0.1.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>>;

	/**
	 * Writes values indexed by storage key.
	 * @param values - Values to store.
	 * @return Promise resolved after the write completes.
	 * @since 0.1.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void>;
}

/**
 * Dependencies used by protected-site configuration persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionConfigurationStorageServiceOptions {
	area: ProtectionConfigurationStorageArea;
}

/**
 * Local protected-site configuration persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionConfigurationStorageService {
	/**
	 * Loads the current protected-site configuration document.
	 * @return Current configuration, an empty document, or null for malformed stored data.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null>;

	/**
	 * Validates and stores one protected-site configuration document.
	 * @param input - Unknown configuration document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the configuration violates its storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void>;
}
