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
	type ProtectionScopeId,
} from '../../types/protection-value';
import { TimingConfigurationSchema } from '../../types/timing-configuration';
import {
	canonicalizeProtectedSite,
	ProtectedSiteCanonicalizationStatus,
} from '../../utils/protected-site-canonicalizer';
import { reconcileProtectionScopeMeasurementRevisions } from '../../utils/reconcile-protection-scope-measurement-revisions';
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
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
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
 * @since 1.0.0 Initial implementation.
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
			measurementRevisionsByScope,
		} );
}

/**
 * Creates validated protected-site editing with local persistence coordination.
 * @param options - Storage and coordinated-edit dependencies.
 * @return Protected-site configuration editor.
 * @since 1.0.0 Initial implementation.
 */
export function createProtectionConfigurationEditor(
	options: ProtectionConfigurationEditorOptions,
): ProtectionConfigurationEditor {
	let mutationQueue: Promise<void> = Promise.resolve();

	/**
	 * Resolves the internal mutation queue after one successful or rejected edit.
	 * @return Undefined queue settlement value.
	 * @since 1.0.0 Initial implementation.
	 */
	function releaseMutationQueue(): undefined {
		return undefined;
	}

	/**
	 * Runs one mutation after every earlier mutation has finished persistence.
	 * @param mutation - Deferred configuration mutation.
	 * @return Exact result promise returned to the caller.
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
	 */
	async function load(): Promise<ProtectionConfigurationDocument | null> {
		return options.storage.load();
	}

	/**
	 * Persists one successful edit and leaves rejected edits untouched.
	 * @param result - Candidate edit result.
	 * @return Original edit result after any required write.
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
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
	 * @param error - Original pre-persist or persistence failure.
	 * @return Promise resolved after the effect completes.
	 * @since 1.0.0 Initial implementation.
	 */
	async function finalizeFailedMutation(
		configuration: ProtectionConfigurationDocument | null,
		finalize: ProtectionConfigurationEditFinalizer | undefined,
		error: unknown,
	): Promise<void> {
		await finalize?.( { configuration, result: null, error } );
	}

	/**
	 * Completes one optional effect before returning an authoritative removal result.
	 * @param result - Successful or rejected edit result.
	 * @param configuration - Latest configuration known by the coordinated mutation.
	 * @param removedSite - Site resolved from authoritative storage, or null when none matched.
	 * @param finalize - Optional removal settlement effect.
	 * @return Original edit result after the effect completes.
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
	 */
	async function finalizeFailedRemoval(
		configuration: ProtectionConfigurationDocument,
		removedSite: ProtectedSiteConfiguration,
		finalize: ProtectionConfigurationRemovalFinalizer | undefined,
	): Promise<void> {
		await finalize?.( { configuration, result: null, removedSite } );
	}

	/**
	 * Adds unique hostnames or HTTP(S) URLs with shared countdown behavior atomically.
	 * @param siteInputs - User-entered hostnames or URLs.
	 * @param beforePersist - Optional verification performed immediately before persistence.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	async function performAdd(
		siteInputs: readonly unknown[],
		beforePersist: ProtectionConfigurationEditPrePersist | undefined,
		finalize: ProtectionConfigurationEditFinalizer | undefined,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		try {
			await options.validateAddition?.();
		} catch ( error ) {
			await finalizeFailedMutation( configuration, finalize, error );
			throw error;
		}

		if ( configuration === null ) {
			return finalizeResult(
				createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ),
				configuration,
				finalize,
			);
		}

		const scopeId = DefaultProtectionScopeId;
		const additions = new Map<string, ProtectedSiteConfiguration>();

		for ( const siteInput of siteInputs ) {
			const canonicalSite = canonicalizeProtectedSite( siteInput, scopeId );

			if ( canonicalSite.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
				return finalizeResult(
					createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SITE ),
					configuration,
					finalize,
				);
			}

			if ( ! additions.has( canonicalSite.rule.host ) ) {
				additions.set( canonicalSite.rule.host, {
					identityHost: canonicalSite.identityHost,
					rule: canonicalSite.rule,
				} );
			}
		}

		if ( additions.size === 0 ) {
			return finalizeResult( createUpdatedResult( configuration ), configuration, finalize );
		}

		const updatedSites = ProtectedSiteConfigurationSetSchema.safeParse( [
			...configuration.sites,
			...additions.values(),
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
			await finalizeFailedMutation( configuration, finalize, error );

			throw error;
		}

		return finalizeResult( result, result.configuration, finalize );
	}

	/**
	 * Queues one hostname or HTTP(S) URL addition.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param beforePersist - Optional verification performed immediately before persistence.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	function add(
		siteInput: unknown,
		beforePersist?: ProtectionConfigurationEditPrePersist,
		finalize?: ProtectionConfigurationEditFinalizer,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performAdd( [ siteInput ], beforePersist, finalize ) );
	}

	/**
	 * Queues one atomic addition of shared protected sites.
	 * @param siteInputs - User-entered hostnames or URLs.
	 * @param beforePersist - Optional verification immediately before persistence.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	function addMany(
		siteInputs: readonly string[],
		beforePersist?: ProtectionConfigurationEditPrePersist,
		finalize?: ProtectionConfigurationEditFinalizer,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performAdd( siteInputs, beforePersist, finalize ) );
	}

	/**
	 * Updates one exact site's editable display name and active hours atomically.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param displayNameInput - Unknown editable name input.
	 * @param scheduleInput - Optional site-specific active hours; omitted to use the global schedule.
	 * @return Updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	async function performUpdate(
		identityHostInput: unknown,
		displayNameInput: unknown,
		scheduleInput: unknown,
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

		const schedule = scheduleInput === undefined ? undefined : ScheduleSchema.safeParse( scheduleInput );
		if ( schedule !== undefined && ! schedule.success ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE );
		}
		const replacementSite: ProtectedSiteConfiguration = {
			identityHost: currentSite.identityHost,
			rule: currentSite.rule,
			...( displayNameResult.data === '' ? {} : { displayNameOverride: displayNameResult.data } ),
			...( schedule === undefined ? {} : { schedule: normalizeSchedule( schedule.data ) } ),
		};
		const sites = replaceSite( configuration, replacementSite );

		return saveUpdatedResult( createUpdatedResult( { ...configuration, sites } ) );
	}

	/**
	 * Queues one exact site's editable name and active hours update.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param displayNameInput - Unknown editable name input.
	 * @param scheduleInput - Optional site-specific active hours; omitted to use the global schedule.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	function update(
		identityHostInput: unknown,
		displayNameInput: unknown,
		scheduleInput?: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performUpdate(
			identityHostInput,
			displayNameInput,
			scheduleInput,
		) );
	}

	/**
	 * Removes one exact protected-site identity.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @param finalize - Optional effect completed before mutation coordination is released.
	 * @return Updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
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
	 * Updates the global schedule atomically.
	 * @param scheduleInput - Unknown editable schedule input.
	 * @return Updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	async function performUpdateSchedule(
		scheduleInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION );
		}

		const schedule = ScheduleSchema.safeParse( scheduleInput );

		if ( ! schedule.success ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SCHEDULE );
		}

		return saveUpdatedResult( createUpdatedResult( {
			...configuration,
			schedule: normalizeSchedule( schedule.data ),
		} ) );
	}

	/**
	 * Queues the global schedule update.
	 * @param scheduleInput - Unknown editable schedule input.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
	 */
	function updateSchedule(
		scheduleInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performUpdateSchedule( scheduleInput ) );
	}

	/**
	 * Updates the global timing configuration atomically.
	 * @param timingConfigurationInput - Unknown global timing configuration.
	 * @return Updated configuration or a stable rejection.
	 * @since 1.0.0 Initial implementation.
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
	 * @since 1.0.0 Initial implementation.
	 */
	function updateTiming(
		timingConfigurationInput: unknown,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performUpdateTiming( timingConfigurationInput ) );
	}

	/**
	 * Replaces one whole website draft under the existing mutation lock.
	 * @param expectedSites - Complete website baseline observed by the page.
	 * @param nextSites - Complete validated draft to commit.
	 * @param beforePersist - Permission verification before the single write.
	 * @param finalize - Permission settlement before releasing coordination.
	 * @return Authoritative update or rejection without partial writes.
	 * @since 1.0.0 Initial implementation.
	 */
	function replaceSites(
		expectedSites: unknown,
		nextSites: unknown,
		beforePersist?: ProtectionConfigurationEditPrePersist,
		finalize?: ProtectionConfigurationEditFinalizer,
	): Promise<ProtectionConfigurationEditResult> {
		const expected = ProtectedSiteConfigurationSetSchema.safeParse( expectedSites );
		const next = ProtectedSiteConfigurationSetSchema.safeParse( nextSites );
		return serializeMutation( async () => {
			const configuration = await options.storage.load();
			try {
				await options.validateAddition?.();
			} catch ( error ) {
				await finalizeFailedMutation( configuration, finalize, error );
				throw error;
			}
			if ( configuration === null || ! expected.success || ! next.success ) {
				return finalizeResult(
					createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ),
					configuration,
					finalize,
				);
			}
			if ( JSON.stringify( expected.data ) !== JSON.stringify( configuration.sites ) ) {
				return finalizeResult(
					createRejectedResult( ProtectionConfigurationEditRejectionReason.SITES_CHANGED ),
					configuration,
					finalize,
				);
			}
			if ( JSON.stringify( next.data ) === JSON.stringify( configuration.sites ) ) {
				return finalizeResult( createUpdatedResult( configuration ), configuration, finalize );
			}
			const rotatedScopeIds = new Set<ProtectionScopeId>();
			for ( const site of [ ...configuration.sites, ...next.data ] ) {
				const previous = configuration.sites.find(
					( candidate ) => candidate.identityHost === site.identityHost,
				);
				const replacement = next.data.find( ( candidate ) => candidate.identityHost === site.identityHost );
				if ( JSON.stringify( previous?.rule ) !== JSON.stringify( replacement?.rule ) ) {
					rotatedScopeIds.add( site.rule.scopeId );
				}
			}
			const result = createMembershipUpdatedResult( configuration, next.data, rotatedScopeIds, options );
			if ( result === null ) {
				return finalizeResult(
					createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION ),
					configuration,
					finalize,
				);
			}
			try {
				await beforePersist?.( result.configuration );
				await options.storage.save( result.configuration );
			} catch ( error ) {
				await finalizeFailedMutation( configuration, finalize, error );
				throw error;
			}
			return finalizeResult( result, result.configuration, finalize );
		} );
	}

	return {
		add, addMany, load, remove, update, updateSchedule, updateTiming, replaceSites,
	};
}

export * from './types';
