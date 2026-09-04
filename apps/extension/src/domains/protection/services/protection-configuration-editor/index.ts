import {
	ProtectedSiteDisplayNameInputSchema,
	ProtectedSiteConfigurationSetSchema,
	ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import { ScheduleSchema } from '../../types/protection-schedule';
import { CanonicalHostSchema } from '../../types/protected-site-rule';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
	type ProtectionScopeId,
} from '../../types/protection-value';
import { TimingConfigurationSchema } from '../../types/timing-configuration';
import {
	canonicalizeProtectedSite,
	ProtectedSiteCanonicalizationStatus,
} from '../../utils/protected-site-canonicalizer';
import { reconcileProtectionScopeMeasurementRevisions } from '../../utils/reconcile-protection-scope-measurement-revisions';
import { reconcileProtectionScopeSchedules } from '../../utils/reconcile-protection-scope-schedules';
import { normalizeSchedule } from '../../utils/schedule-normalizer';
import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditRejectionReason as ProtectionConfigurationEditRejectionReasonValue,
	type ProtectionConfigurationEditFinalizer,
	type ProtectionConfigurationEditPrePersist,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationEditorOptions,
	type ProtectionConfigurationMutation,
	type ProtectionConfigurationRemovalFinalizer,
	type UpdatedProtectionConfigurationEditResult,
} from './types';

/**
 * Creates one stable rejected edit result.
 * @param reason - Stable edit rejection reason.
 * @return Rejected edit result.
 * @since 0.1.0 Initial implementation.
 */
function createRejectedResult(
	reason: ProtectionConfigurationEditRejectionReasonValue,
): ProtectionConfigurationEditResult {
	return {
		status: ProtectionConfigurationEditStatus.REJECTED,
		reason,
	};
}

/**
 * Creates one validated successful edit result.
 * @param configurationInput - Candidate updated configuration.
 * @return Successful edit result.
 * @since 0.1.0 Initial implementation.
 */
function createUpdatedResult( configurationInput: unknown ): UpdatedProtectionConfigurationEditResult {
	return {
		status: ProtectionConfigurationEditStatus.UPDATED,
		configuration: ProtectionConfigurationDocumentSchema.parse( configurationInput ),
	};
}

/**
 * Finds one exact site identity within a validated configuration.
 * @param configuration - Current validated configuration.
 * @param identityHostInput - Unknown exact canonical identity.
 * @return Matching site or undefined when absent or invalid.
 * @since 0.1.0 Initial implementation.
 */
function findSite(
	configuration: ProtectionConfigurationDocument,
	identityHostInput: unknown,
): ProtectedSiteConfiguration | undefined {
	const identityHostResult = CanonicalHostSchema.safeParse( identityHostInput );

	if ( ! identityHostResult.success ) {
		return undefined;
	}

	return configuration.sites.find(
		( site ) => site.identityHost === identityHostResult.data,
	);
}

/**
 * Replaces one site without mutating the current configuration.
 * @param configuration - Current validated configuration.
 * @param site - Complete replacement site.
 * @return Protected-site configurations with the exact site replaced.
 * @since 0.1.0 Initial implementation.
 */
function replaceSite(
	configuration: ProtectionConfigurationDocument,
	site: ProtectedSiteConfiguration,
): ProtectionConfigurationDocument[ 'sites' ] {
	return configuration.sites.map( ( currentSite ) =>
		currentSite.identityHost === site.identityHost ? site : currentSite,
	);
}

/**
 * Creates one updated configuration after reconciling scope-owned values.
 * @param configuration - Current validated configuration.
 * @param sites - Candidate protected-site configurations.
 * @param rotatedScopeIds - Active scopes whose measurement contract changed.
 * @param options - Editor dependencies containing the revision factory.
 * @return Updated configuration result or null when revision creation fails.
 * @since 0.1.0 Initial implementation.
 */
function createMembershipUpdatedResult(
	configuration: ProtectionConfigurationDocument,
	sites: ProtectionConfigurationDocument[ 'sites' ],
	rotatedScopeIds: ReadonlySet<ProtectionScopeId>,
	options: ProtectionConfigurationEditorOptions,
): UpdatedProtectionConfigurationEditResult | null {
	const measurementRevisionsByScope = reconcileProtectionScopeMeasurementRevisions( {
		sites,
		currentRevisionsByScope: configuration.measurementRevisionsByScope,
		rotatedScopeIds,
		createMeasurementRevision: options.createMeasurementRevision,
	} );

	return measurementRevisionsByScope === null
		? null
		: createUpdatedResult( {
			...configuration,
			sites,
			schedulesByScope: reconcileProtectionScopeSchedules( sites, configuration.schedulesByScope ),
			measurementRevisionsByScope,
		} );
}

/**
 * Resolves a validated scope for one requested behavior.
 * @param independent - Whether an independent scope is required.
 * @param configuration - Current validated configuration whose scope identifiers must remain unique.
 * @param options - Editor dependencies containing the scope factory.
 * @return Shared or independent scope identifier, or null for an invalid generated identifier.
 * @since 0.1.0 Initial implementation.
 */
function resolveRequestedScopeId(
	independent: boolean,
	configuration: ProtectionConfigurationDocument,
	options: ProtectionConfigurationEditorOptions,
): ProtectionScopeId | null {
	if ( ! independent ) {
		return DefaultProtectionScopeId;
	}

	const scopeIdResult = ProtectionScopeIdSchema.safeParse( options.createIndependentScopeId() );

	return scopeIdResult.success &&
		scopeIdResult.data !== DefaultProtectionScopeId &&
		! configuration.sites.some( ( site ) => site.rule.scopeId === scopeIdResult.data )
		? scopeIdResult.data
		: null;
}

/**
 * Preserves an existing independent scope or creates one when a shared site becomes independent.
 * @param currentScopeId - Scope currently owned by the protected site.
 * @param independent - Whether independent behavior is requested.
 * @param configuration - Current validated configuration whose scope identifiers must remain unique.
 * @param options - Editor dependencies containing the scope factory.
 * @return Requested scope identifier, or null for an invalid generated identifier.
 * @since 0.1.0 Initial implementation.
 */
function resolveUpdatedScopeId(
	currentScopeId: ProtectionScopeId,
	independent: boolean,
	configuration: ProtectionConfigurationDocument,
	options: ProtectionConfigurationEditorOptions,
): ProtectionScopeId | null {
	if ( ! independent ) {
		return DefaultProtectionScopeId;
	}

	return currentScopeId === DefaultProtectionScopeId
		? resolveRequestedScopeId( true, configuration, options )
		: currentScopeId;
}

/**
 * Creates validated protected-site editing with local persistence coordination.
 * @param options - Storage and independent-scope dependencies.
 * @return Protected-site configuration editor.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionConfigurationEditor(
	options: ProtectionConfigurationEditorOptions,
): ProtectionConfigurationEditor {
	let mutationQueue: Promise<void> = Promise.resolve();

	/**
	 * Resolves the internal mutation queue after one successful or rejected edit.
	 * @return Undefined queue settlement value.
	 * @since 0.1.0 Initial implementation.
	 */
	function releaseMutationQueue(): undefined {
		return undefined;
	}

	/**
	 * Runs one mutation after every earlier mutation has finished persistence.
	 * @param mutation - Deferred configuration mutation.
	 * @return Exact result promise returned to the caller.
	 * @since 0.1.0 Initial implementation.
	 */
	function serializeMutation(
		mutation: ProtectionConfigurationMutation,
	): Promise<ProtectionConfigurationEditResult> {
		const result = mutationQueue.then( () => options.coordinateMutation( mutation ) );
		mutationQueue = result.then( releaseMutationQueue, releaseMutationQueue );

		return result;
	}

	/**
	 * Loads one current configuration without replacing malformed data.
	 * @return Current configuration, an empty document, or null for malformed data.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(): Promise<ProtectionConfigurationDocument | null> {
		return options.storage.load();
	}

	/**
	 * Persists one successful edit and leaves rejected edits untouched.
	 * @param result - Candidate edit result.
	 * @return Original edit result after any required write.
	 * @since 0.1.0 Initial implementation.
	 */
	async function saveUpdatedResult(
		result: UpdatedProtectionConfigurationEditResult,
	): Promise<ProtectionConfigurationEditResult> {
		await options.storage.save( result.configuration );

		return result;
	}

	/**
	 * Completes one optional effect before returning an authoritative edit result.
	 * @param result - Successful or rejected edit result.
	 * @param configuration - Latest configuration known by the coordinated mutation.
	 * @param finalize - Optional settlement effect.
	 * @return Original edit result after the effect completes.
	 * @since 0.1.0 Initial implementation.
	 */
	async function finalizeResult(
		result: ProtectionConfigurationEditResult,
		configuration: ProtectionConfigurationDocument | null,
		finalize: ProtectionConfigurationEditFinalizer | undefined,
	): Promise<ProtectionConfigurationEditResult> {
		await finalize?.( { configuration, result } );

		return result;
	}

	/**
	 * Completes one optional effect after a coordinated pre-persist or persistence operation rejects.
	 * @param configuration - Configuration loaded before the failed mutation operation.
	 * @param finalize - Optional settlement effect.
	 * @return Promise resolved after the effect completes.
	 * @since 0.1.0 Initial implementation.
	 */
	async function finalizeFailedMutation(
		configuration: ProtectionConfigurationDocument,
		finalize: ProtectionConfigurationEditFinalizer | undefined,
	): Promise<void> {
		await finalize?.( { configuration, result: null } );
	}

	/**
	 * Completes one optional effect before returning an authoritative removal result.
	 * @param result - Successful or rejected edit result.
	 * @param configuration - Latest configuration known by the coordinated mutation.
	 * @param removedSite - Site resolved from authoritative storage, or null when none matched.
	 * @param finalize - Optional removal settlement effect.
	 * @return Original edit result after the effect completes.
	 * @since 0.1.0 Initial implementation.
	 */
	async function finalizeRemovalResult(
		result: ProtectionConfigurationEditResult,
		configuration: ProtectionConfigurationDocument | null,
		removedSite: ProtectedSiteConfiguration | null,
		finalize: ProtectionConfigurationRemovalFinalizer | undefined,
	): Promise<ProtectionConfigurationEditResult> {
		await finalize?.( { configuration, result, removedSite } );

		return result;
	}

	/**
	 * Completes one optional effect after coordinated removal persistence rejects.
	 * @param configuration - Configuration loaded before the failed removal operation.
	 * @param removedSite - Site resolved from authoritative storage.
	 * @param finalize - Optional removal settlement effect.
	 * @return Promise resolved after the effect completes.
	 * @since 0.1.0 Initial implementation.
	 */
	async function finalizeFailedRemoval(
		configuration: ProtectionConfigurationDocument,
		removedSite: ProtectedSiteConfiguration,
		finalize: ProtectionConfigurationRemovalFinalizer | undefined,
	): Promise<void> {
		await finalize?.( { configuration, result: null, removedSite } );
	}

	/**
	 * Adds one hostname or HTTP(S) URL with shared or independent behavior.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own scope.
	 * @param beforePersist - Optional verification performed immediately before persistence.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performAdd(
		siteInput: unknown,
		independent: boolean,
		beforePersist: ProtectionConfigurationEditPrePersist | undefined,
		finalize: ProtectionConfigurationEditFinalizer | undefined,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return finalizeResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ),
				configuration,
				finalize,
			);
		}

		const scopeId = resolveRequestedScopeId( independent, configuration, options );

		if ( scopeId === null ) {
			return finalizeResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID ),
				configuration,
				finalize,
			);
		}

		const canonicalSite = canonicalizeProtectedSite( siteInput, scopeId );

		if ( canonicalSite.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			return finalizeResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SITE ),
				configuration,
				finalize,
			);
		}

		const updatedSites = ProtectedSiteConfigurationSetSchema.safeParse( [
			...configuration.sites,
			{
				identityHost: canonicalSite.identityHost,
				rule: canonicalSite.rule,
			},
		] );

		if ( ! updatedSites.success ) {
			return finalizeResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED ),
				configuration,
				finalize,
			);
		}

		const result = createMembershipUpdatedResult(
			configuration,
			updatedSites.data,
			new Set( [ scopeId ] ),
			options,
		);

		if ( result === null ) {
			return finalizeResult(
				createRejectedResult(
					ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
				),
				configuration,
				finalize,
			);
		}

		try {
			await beforePersist?.( result.configuration );
			await options.storage.save( result.configuration );
		} catch ( error ) {
			await finalizeFailedMutation( configuration, finalize );

			throw error;
		}

		return finalizeResult( result, result.configuration, finalize );
	}

	/**
	 * Queues one hostname or HTTP(S) URL addition.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own scope.
	 * @param beforePersist - Optional verification performed immediately before persistence.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function add(
		siteInput: unknown,
		independent: boolean,
		beforePersist?: ProtectionConfigurationEditPrePersist,
		finalize?: ProtectionConfigurationEditFinalizer,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performAdd( siteInput, independent, beforePersist, finalize ) );
	}

	/**
	 * Updates one exact site's editable display name and scope behavior atomically.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param displayNameInput - Unknown editable name input.
	 * @param independent - Whether the site receives its own scope.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performUpdate(
		identityHostInput: unknown,
		displayNameInput: unknown,
		independent: boolean,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION );
		}

		const currentSite = findSite( configuration, identityHostInput );

		if ( currentSite === undefined ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND );
		}

		const displayNameResult = ProtectedSiteDisplayNameInputSchema.safeParse( displayNameInput );

		if ( ! displayNameResult.success ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_DISPLAY_NAME );
		}

		const scopeId = resolveUpdatedScopeId(
			currentSite.rule.scopeId,
			independent,
			configuration,
			options,
		);

		if ( scopeId === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID );
		}

		const replacementSite = displayNameResult.data === ''
			? {
				identityHost: currentSite.identityHost,
				rule: {
					...currentSite.rule,
					scopeId,
				},
			}
			: {
				...currentSite,
				rule: {
					...currentSite.rule,
					scopeId,
				},
				displayNameOverride: displayNameResult.data,
			};

		const sites = replaceSite( configuration, replacementSite );
		const rotatedScopeIds = currentSite.rule.scopeId === scopeId
			? new Set<ProtectionScopeId>()
			: new Set( [ currentSite.rule.scopeId, scopeId ] );
		const result = createMembershipUpdatedResult(
			configuration,
			sites,
			rotatedScopeIds,
			options,
		);

		return result === null
			? createRejectedResult(
				ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
			)
			: saveUpdatedResult( result );
	}

	/**
	 * Queues one exact site's editable name and scope update.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param displayNameInput - Unknown editable name input.
	 * @param independent - Whether independent behavior is requested.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function update(
		identityHostInput: unknown,
		displayNameInput: unknown,
		independent: boolean,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performUpdate(
			identityHostInput,
			displayNameInput,
			independent,
		) );
	}

	/**
	 * Removes one exact protected-site identity.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performRemove(
		identityHostInput: unknown,
		finalize: ProtectionConfigurationRemovalFinalizer | undefined,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return finalizeRemovalResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ),
				configuration,
				null,
				finalize,
			);
		}

		const currentSite = findSite( configuration, identityHostInput );

		if ( currentSite === undefined ) {
			return finalizeRemovalResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND ),
				configuration,
				null,
				finalize,
			);
		}

		const sites = configuration.sites.filter( ( site ) => site.identityHost !== currentSite.identityHost );

		const result = createMembershipUpdatedResult(
			configuration,
			sites,
			new Set( [ currentSite.rule.scopeId ] ),
			options,
		);

		if ( result === null ) {
			return finalizeRemovalResult(
				createRejectedResult(
					ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
				),
				configuration,
				currentSite,
				finalize,
			);
		}

		try {
			await options.storage.save( result.configuration );
		} catch ( error ) {
			await finalizeFailedRemoval( configuration, currentSite, finalize );

			throw error;
		}

		return finalizeRemovalResult( result, result.configuration, currentSite, finalize );
	}

	/**
	 * Queues removal of one exact protected-site identity.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function remove(
		identityHostInput: unknown,
		finalize?: ProtectionConfigurationRemovalFinalizer,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performRemove(
			identityHostInput,
			finalize,
		) );
	}

	/**
	 * Updates one active scope's schedule atomically.
	 * @param scopeIdInput - Unknown protection scope identifier.
	 * @param scheduleInput - Unknown editable schedule input.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performUpdateSchedule(
		scopeIdInput: unknown,
		scheduleInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION );
		}

		const scopeId = ProtectionScopeIdSchema.safeParse( scopeIdInput );

		if ( ! scopeId.success || ! Object.hasOwn( configuration.schedulesByScope, scopeId.data ) ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.SCOPE_NOT_FOUND );
		}

		const schedule = ScheduleSchema.safeParse( scheduleInput );

		if ( ! schedule.success ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE );
		}

		return saveUpdatedResult( createUpdatedResult( {
			...configuration,
			schedulesByScope: {
				...configuration.schedulesByScope,
				[ scopeId.data ]: normalizeSchedule( schedule.data ),
			},
		} ) );
	}

	/**
	 * Queues one active scope's schedule update.
	 * @param scopeIdInput - Unknown protection scope identifier.
	 * @param scheduleInput - Unknown editable schedule input.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function updateSchedule(
		scopeIdInput: unknown,
		scheduleInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performUpdateSchedule( scopeIdInput, scheduleInput ) );
	}

	/**
	 * Updates the global timing configuration atomically.
	 * @param timingConfigurationInput - Unknown global timing configuration.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performUpdateTiming(
		timingConfigurationInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION );
		}

		const timingConfiguration = TimingConfigurationSchema.safeParse( timingConfigurationInput );

		if ( ! timingConfiguration.success ) {
			return createRejectedResult(
				ProtectionConfigurationEditRejectionReason.INVALID_TIMING_CONFIGURATION,
			);
		}

		const activeScopeIds = new Set<ProtectionScopeId>( [
			DefaultProtectionScopeId,
			...configuration.sites.map( ( site ) => site.rule.scopeId ),
		] );
		const rotatedScopeIds = timingConfiguration.data.allowanceMilliseconds ===
			configuration.timingConfiguration.allowanceMilliseconds
			? new Set<ProtectionScopeId>()
			: activeScopeIds;
		const measurementRevisionsByScope = reconcileProtectionScopeMeasurementRevisions( {
			sites: configuration.sites,
			currentRevisionsByScope: configuration.measurementRevisionsByScope,
			rotatedScopeIds,
			createMeasurementRevision: options.createMeasurementRevision,
		} );

		if ( measurementRevisionsByScope === null ) {
			return createRejectedResult(
				ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION,
			);
		}

		return saveUpdatedResult( createUpdatedResult( {
			...configuration,
			timingConfiguration: timingConfiguration.data,
			measurementRevisionsByScope,
		} ) );
	}

	/**
	 * Queues one global timing configuration update.
	 * @param timingConfigurationInput - Unknown global timing configuration.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function updateTiming(
		timingConfigurationInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performUpdateTiming( timingConfigurationInput ) );
	}

	return { add, load, remove, update, updateSchedule, updateTiming };
}

export * from './types';
