import { z } from 'zod';
import { type ProtectionConfigurationDocument } from '../../types/protected-site-configuration';
import { type ProtectionConfigurationStorageService } from '../protection-configuration-storage';

/**
 * Stable outcomes returned by protected-site configuration edits.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationEditStatus = {
	REJECTED: 'rejected',
	UPDATED: 'updated',
} as const;

/**
 * Validates a protected-site configuration edit outcome.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationEditStatusSchema = z.enum( ProtectionConfigurationEditStatus );

/**
 * Outcome returned by a protected-site configuration edit.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationEditStatus = z.infer<typeof ProtectionConfigurationEditStatusSchema>;

/**
 * Stable reasons why a protected-site configuration edit can be rejected.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationEditRejectionReason = {
	ALREADY_PROTECTED: 'already-protected',
	INVALID_CONFIGURATION: 'invalid-configuration',
	INVALID_DISPLAY_NAME: 'invalid-display-name',
	INVALID_SCOPE_ID: 'invalid-scope-id',
	INVALID_SITE: 'invalid-site',
	SITE_NOT_FOUND: 'site-not-found',
} as const;

/**
 * Validates a stable protected-site configuration edit rejection reason.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionConfigurationEditRejectionReasonSchema = z.enum(
	ProtectionConfigurationEditRejectionReason,
);

/**
 * Stable reason why a protected-site configuration edit was rejected.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationEditRejectionReason = z.infer<
	typeof ProtectionConfigurationEditRejectionReasonSchema
>;

/**
 * Successful immutable protected-site configuration edit.
 * @since 0.1.0 Initial implementation.
 */
export interface UpdatedProtectionConfigurationEditResult {
	status: typeof ProtectionConfigurationEditStatus.UPDATED;
	configuration: ProtectionConfigurationDocument;
}

/**
 * Rejected protected-site configuration edit with a stable explanation.
 * @since 0.1.0 Initial implementation.
 */
export interface RejectedProtectionConfigurationEditResult {
	status: typeof ProtectionConfigurationEditStatus.REJECTED;
	reason: ProtectionConfigurationEditRejectionReason;
}

/**
 * Complete protected-site configuration edit result.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationEditResult =
	UpdatedProtectionConfigurationEditResult |
	RejectedProtectionConfigurationEditResult;

/**
 * One deferred protected-site configuration mutation.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationMutation = () => Promise<ProtectionConfigurationEditResult>;

/**
 * Coordinates one configuration mutation with every editor context that shares the same authority.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionConfigurationMutationCoordinator = (
	mutation: ProtectionConfigurationMutation,
) => Promise<ProtectionConfigurationEditResult>;

/**
 * Creates one new stable scope identifier for an independent protected site.
 * @since 0.1.0 Initial implementation.
 */
export type IndependentProtectionScopeIdFactory = () => unknown;

/**
 * Dependencies used by protected-site configuration editing.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionConfigurationEditorOptions {
	storage: ProtectionConfigurationStorageService;
	createIndependentScopeId: IndependentProtectionScopeIdFactory;
	coordinateMutation: ProtectionConfigurationMutationCoordinator;
}

/**
 * Validated protected-site configuration editing operations.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionConfigurationEditor {
	/**
	 * Loads the current protected-site configuration without altering malformed data.
	 * @return Current configuration, an empty document, or null for malformed data.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null>;

	/**
	 * Adds one hostname or HTTP(S) URL with shared or independent scope behavior.
	 * @param siteInput - Unknown user-entered hostname or URL.
	 * @param independent - Whether the site receives its own protection scope.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	add( siteInput: unknown, independent: boolean ): Promise<ProtectionConfigurationEditResult>;

	/**
	 * Updates one exact site's editable display name and scope behavior atomically.
	 * @param identityHost - Exact canonical site identity.
	 * @param displayNameInput - Unknown editable name input; an empty value restores automatic naming.
	 * @param independent - Whether the site receives its own protection scope.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	update(
		identityHost: unknown,
		displayNameInput: unknown,
		independent: boolean,
	): Promise<ProtectionConfigurationEditResult>;

	/**
	 * Removes one exact protected-site identity.
	 * @param identityHost - Exact canonical site identity.
	 * @return Updated configuration or a stable rejection.
	 * @since 0.1.0 Initial implementation.
	 */
	remove( identityHost: unknown ): Promise<ProtectionConfigurationEditResult>;
}
