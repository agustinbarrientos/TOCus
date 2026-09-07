import {
	ProtectionConfigurationDocumentSchema,
	ProtectionConfigurationDocumentVersion,
	type ProtectionConfigurationDocument,
	type ProtectionScopeMeasurementRevisionMap,
	type ProtectionScopeScheduleMap,
} from '../../types/protected-site-configuration';
import { DefaultProtectionSchedule } from '../../types/protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	type ProtectionScopeId,
} from '../../types/protection-value';
import {
	DefaultTimingConfiguration,
	TimingConfigurationSchema,
	type TimingConfiguration,
} from '../../types/timing-configuration';
import {
	ProtectionConfigurationStorageKey,
	VersionOneProtectionConfigurationDocumentSchema,
	VersionThreeProtectionConfigurationDocumentSchema,
	VersionTwoProtectionConfigurationDocumentSchema,
	type HistoricalTimingConfiguration,
	type ProtectionConfigurationStorageService,
	type ProtectionConfigurationStorageServiceOptions,
} from './types';

/**
 * Creates deterministic initial revisions for every active scope in a migrated configuration.
 * @param sites - Validated protected-site configurations whose active scopes need revisions.
 * @return Stable initial measurement revisions indexed by active scope.
 * @since 0.1.0 Initial implementation.
 */
function createInitialMeasurementRevisions(
	sites: ProtectionConfigurationDocument[ 'sites' ],
): ProtectionScopeMeasurementRevisionMap {
	const scopeIds = new Set<ProtectionScopeId>( [
		DefaultProtectionScopeId,
		...sites.map( ( site ) => site.rule.scopeId ),
	] );

	return Object.fromEntries(
		[ ...scopeIds ].map( ( scopeId ) => [
			scopeId,
			ProtectionMeasurementRevisionSchema.parse( `revision_initial_${ scopeId }` ),
		] ),
	);
}

/**
 * Creates a current configuration document from validated persisted fields.
 * @param sites - Validated protected-site configurations to retain.
 * @param timingConfiguration - Validated global timing configuration to retain.
 * @param schedulesByScope - Validated normalized schedules to retain.
 * @param measurementRevisionsByScope - Validated measurement revisions to retain or create.
 * @return Current configuration or null when the migrated fields violate current invariants.
 * @since 0.1.0 Initial implementation.
 */
function migrateConfiguration(
	sites: ProtectionConfigurationDocument[ 'sites' ],
	timingConfiguration: TimingConfiguration,
	schedulesByScope: ProtectionScopeScheduleMap,
	measurementRevisionsByScope = createInitialMeasurementRevisions( sites ),
): ProtectionConfigurationDocument | null {
	const configuration = ProtectionConfigurationDocumentSchema.safeParse( {
		schemaVersion: ProtectionConfigurationDocumentVersion,
		sites,
		timingConfiguration,
		schedulesByScope,
		measurementRevisionsByScope,
	} );

	return configuration.success ? configuration.data : null;
}

/**
 * Maps fully validated historical timing onto the version-four control contract.
 * @param timingConfiguration - Complete validated historical timing.
 * @return Timing constrained to the version-four controls.
 * @since 0.1.0 Initial implementation.
 */
function migrateHistoricalTimingConfiguration(
	timingConfiguration: HistoricalTimingConfiguration,
): TimingConfiguration {
	return TimingConfigurationSchema.parse( {
		...timingConfiguration,
		initialWaitMilliseconds: Math.min( timingConfiguration.initialWaitMilliseconds, 30_000 ),
		ladderIncreaseMilliseconds: Math.min( timingConfiguration.ladderIncreaseMilliseconds, 5_000 ),
		maximumWaitMilliseconds: Math.ceil(
			Math.max( timingConfiguration.maximumWaitMilliseconds, 30_000 ) / 30_000,
		) * 30_000,
		allowanceMilliseconds: Math.min(
			Math.max( timingConfiguration.allowanceMilliseconds, 120_000 ),
			1_200_000,
		),
	} );
}

/**
 * Creates the current configuration defaults for one validated protected-site set.
 * @param sites - Validated protected-site configurations to retain.
 * @return Current configuration with global timing and one default schedule per active scope.
 * @since 0.1.0 Initial implementation.
 */
function migrateVersionOneConfiguration(
	sites: ProtectionConfigurationDocument[ 'sites' ],
): ProtectionConfigurationDocument | null {
	const scopeIds = new Set( [ DefaultProtectionScopeId, ...sites.map( ( site ) => site.rule.scopeId ) ] );
	const schedulesByScope = Object.fromEntries(
		[ ...scopeIds ].map( ( scopeId ) => [ scopeId, DefaultProtectionSchedule ] ),
	);

	return migrateConfiguration( sites, DefaultTimingConfiguration, schedulesByScope );
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
		const versionTwoConfiguration = VersionTwoProtectionConfigurationDocumentSchema.safeParse(
			storedConfiguration,
		);
		const versionThreeConfiguration = VersionThreeProtectionConfigurationDocumentSchema.safeParse(
			storedConfiguration,
		);

		if ( versionThreeConfiguration.success ) {
			return migrateConfiguration(
				versionThreeConfiguration.data.sites,
				migrateHistoricalTimingConfiguration(
					versionThreeConfiguration.data.timingConfiguration,
				),
				versionThreeConfiguration.data.schedulesByScope,
				versionThreeConfiguration.data.measurementRevisionsByScope,
			);
		}

		if ( versionTwoConfiguration.success ) {
			return migrateConfiguration(
				versionTwoConfiguration.data.sites,
				migrateHistoricalTimingConfiguration(
					versionTwoConfiguration.data.timingConfiguration,
				),
				versionTwoConfiguration.data.schedulesByScope,
			);
		}

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
