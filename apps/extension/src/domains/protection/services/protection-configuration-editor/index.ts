import {
	ProtectedSiteDisplayNameInputSchema,
	ProtectionConfigurationDocumentSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../types/protected-site-configuration';
import { CanonicalHostSchema } from '../../types/protected-site-rule';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
	type ProtectionScopeId,
} from '../../types/protection-value';
import {
	canonicalizeProtectedSite,
	ProtectedSiteCanonicalizationStatus,
} from '../../utils/protected-site-canonicalizer';
import {
	ProtectionConfigurationEditRejectionReason,
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditRejectionReason as ProtectionConfigurationEditRejectionReasonValue,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationEditorOptions,
	type ProtectionConfigurationMutation,
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
 * @return Validated updated configuration result.
 * @since 0.1.0 Initial implementation.
 */
function replaceSite(
	configuration: ProtectionConfigurationDocument,
	site: ProtectedSiteConfiguration,
): UpdatedProtectionConfigurationEditResult {
	return createUpdatedResult( {
		...configuration,
		sites: configuration.sites.map( ( currentSite ) =>
			currentSite.identityHost === site.identityHost ? site : currentSite,
		),
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
	 * Adds one hostname or HTTP(S) URL with shared or independent behavior.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own scope.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performAdd(
		siteInput: unknown,
		independent: boolean,
	): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION );
		}

		const scopeId = resolveRequestedScopeId( independent, configuration, options );

		if ( scopeId === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SCOPE_ID );
		}

		const canonicalSite = canonicalizeProtectedSite( siteInput, scopeId );

		if ( canonicalSite.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_SITE );
		}

		const updatedConfiguration = ProtectionConfigurationDocumentSchema.safeParse( {
			...configuration,
			sites: [
				...configuration.sites,
				{
					identityHost: canonicalSite.identityHost,
					rule: canonicalSite.rule,
				},
			],
		} );

		if ( ! updatedConfiguration.success ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED );
		}

		return saveUpdatedResult( createUpdatedResult( updatedConfiguration.data ) );
	}

	/**
	 * Queues one hostname or HTTP(S) URL addition.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own scope.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function add(
		siteInput: unknown,
		independent: boolean,
	): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performAdd( siteInput, independent ) );
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

		return saveUpdatedResult( replaceSite( configuration, replacementSite ) );
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
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	async function performRemove( identityHostInput: unknown ): Promise<ProtectionConfigurationEditResult> {
		const configuration = await options.storage.load();

		if ( configuration === null ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.INVALID_CONFIGURATION );
		}

		const currentSite = findSite( configuration, identityHostInput );

		if ( currentSite === undefined ) {
			return createRejectedResult( ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND );
		}

		return saveUpdatedResult( createUpdatedResult( {
			...configuration,
			sites: configuration.sites.filter( ( site ) => site.identityHost !== currentSite.identityHost ),
		} ) );
	}

	/**
	 * Queues removal of one exact protected-site identity.
	 * @param identityHostInput - Unknown exact canonical identity.
	 * @return Serialized updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	function remove( identityHostInput: unknown ): Promise<ProtectionConfigurationEditResult> {
		return serializeMutation( () => performRemove( identityHostInput ) );
	}

	return { add, load, remove, update };
}

export * from './types';
