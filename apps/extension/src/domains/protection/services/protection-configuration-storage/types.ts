import { z } from 'zod';
import {
	ProtectedSiteConfigurationSetSchema,
	ProtectionScopeMeasurementRevisionMapSchema,
	ProtectionScopeScheduleMapSchema,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import { AllowanceDurationMillisecondsSchema } from '../../types/allowance-duration';
import { CompletionActionSchema } from '../../types/completion-action';
import { DurationMillisecondsSchema } from '../../types/protection-value';

const ONE_SECOND_MILLISECONDS = 1_000;
const FIVE_SECONDS_MILLISECONDS = 5_000;
const TEN_SECONDS_MILLISECONDS = 10_000;
const SIXTY_SECONDS_MILLISECONDS = 60_000;

/**
 * Validates waits persisted before the version-four timing-control contract.
 * @since 0.1.0 Initial implementation.
 */
const HistoricalWaitDurationMillisecondsSchema = DurationMillisecondsSchema
	.min( TEN_SECONDS_MILLISECONDS )
	.max( SIXTY_SECONDS_MILLISECONDS )
	.multipleOf( FIVE_SECONDS_MILLISECONDS );

/**
 * Validates the original increase ladder persisted by versions two and three.
 * @since 0.1.0 Initial implementation.
 */
const HistoricalLadderIncreaseMillisecondsSchema = DurationMillisecondsSchema
	.min( TEN_SECONDS_MILLISECONDS )
	.max( SIXTY_SECONDS_MILLISECONDS )
	.multipleOf( FIVE_SECONDS_MILLISECONDS );

/**
 * Validates the interim increase ladder that version-three documents could persist.
 * @since 0.1.0 Initial implementation.
 */
const InterimLadderIncreaseMillisecondsSchema = DurationMillisecondsSchema
	.max( FIVE_SECONDS_MILLISECONDS )
	.multipleOf( ONE_SECOND_MILLISECONDS );

/**
 * Validates timing persisted before the version-four control contract.
 * @since 0.1.0 Initial implementation.
 */
export const HistoricalTimingConfigurationSchema = z.object( {
	initialWaitMilliseconds: HistoricalWaitDurationMillisecondsSchema,
	ladderIncreaseMilliseconds: z.union( [
		InterimLadderIncreaseMillisecondsSchema,
		HistoricalLadderIncreaseMillisecondsSchema,
	] ),
	maximumWaitMilliseconds: HistoricalWaitDurationMillisecondsSchema,
	allowanceMilliseconds: AllowanceDurationMillisecondsSchema,
	completionAction: CompletionActionSchema,
} ).strict().superRefine( ( configuration, context ) => {
	if ( configuration.maximumWaitMilliseconds < configuration.initialWaitMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Maximum wait must be greater than or equal to the initial wait.',
			path: [ 'maximumWaitMilliseconds' ],
		} );
	}
} );

/**
 * Timing persisted before the version-four control contract.
 * @since 0.1.0 Initial implementation.
 */
export type HistoricalTimingConfiguration = z.infer<typeof HistoricalTimingConfigurationSchema>;

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
	timingConfiguration: HistoricalTimingConfigurationSchema,
	schedulesByScope: ProtectionScopeScheduleMapSchema,
} ).strict();

/**
 * Validates the complete configuration document used before timing controls were narrowed.
 * @since 0.1.0 Initial implementation.
 */
export const VersionThreeProtectionConfigurationDocumentSchema = z.object( {
	schemaVersion: z.number().int().nonnegative().refine( ( version ) => version === 3 ),
	sites: ProtectedSiteConfigurationSetSchema,
	timingConfiguration: HistoricalTimingConfigurationSchema,
	schedulesByScope: ProtectionScopeScheduleMapSchema,
	measurementRevisionsByScope: ProtectionScopeMeasurementRevisionMapSchema,
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
