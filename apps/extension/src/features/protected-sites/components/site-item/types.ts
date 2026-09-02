import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { type CanonicalHost } from '../../../../domains/protection/types/protected-site-rule';

/**
 * Stable event name emitted after one protected-site configuration change is persisted.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteConfigurationChangedEventName = 'tocus-protected-site-configuration-changed';

/**
 * Stable protected-site change kinds announced to the owning screen.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectedSiteConfigurationChangeKind = {
	REMOVED: 'removed',
	UPDATED: 'updated',
} as const;

/**
 * Protected-site change kind announced to the owning screen.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectedSiteConfigurationChangeKind =
	typeof ProtectedSiteConfigurationChangeKind[ keyof typeof ProtectedSiteConfigurationChangeKind ];

/**
 * Details emitted after one protected-site configuration change is persisted.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteConfigurationChangedEventDetail {
	kind: ProtectedSiteConfigurationChangeKind;
	identityHost: CanonicalHost;
	configuration: ProtectionConfigurationDocument;
}

/**
 * Form submission event whose current target is the protected-site edit form.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteEditSubmitEvent extends SubmitEvent {
	readonly currentTarget: HTMLFormElement;
}

/**
 * Localizable protected-site item messages.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteItemCopy {
	edit: string;
	displayNameLabel: string;
	useAutomaticName: string;
	behaviorLegend: string;
	sharedBehavior: string;
	sharedBehaviorDescription: string;
	independentBehavior: string;
	independentBehaviorDescription: string;
	saveChanges: string;
	saving: string;
	cancel: string;
	removeSite: string;
	keepSite: string;
	confirmRemove: string;
	operationError: string;
	configurationChangedError: string;
	sharedLabel: string;
	independentLabel: string;
	/**
	 * Formats the protection boundary shown below one site.
	 * @param host - Canonical protection host.
	 * @param includesSubdomains - Whether descendants are protected.
	 * @return Human-readable boundary explanation.
	 * @since 0.1.0 Initial implementation.
	 */
	formatBoundary( host: string, includesSubdomains: boolean ): string;
	/**
	 * Formats one inline removal question.
	 * @param name - Current resolved display name.
	 * @return Human-readable removal question.
	 * @since 0.1.0 Initial implementation.
	 */
	formatRemoveQuestion( name: string ): string;
}

/**
 * Formats the default protection boundary explanation.
 * @param host - Canonical protection host.
 * @param includesSubdomains - Whether descendants are protected.
 * @return Human-readable protection boundary.
 * @since 0.1.0 Initial implementation.
 */
function formatBoundary( host: string, includesSubdomains: boolean ): string {
	return includesSubdomains ? `Protects ${ host } and its subdomains` : `Protects only ${ host }`;
}

/**
 * Formats the default inline removal question.
 * @param name - Current resolved display name.
 * @return Human-readable removal question.
 * @since 0.1.0 Initial implementation.
 */
function formatRemoveQuestion( name: string ): string {
	return `Remove ${ name }?`;
}

/**
 * Default English protected-site item messages.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultProtectedSiteItemCopy: Readonly<ProtectedSiteItemCopy> = Object.freeze( {
	edit: 'Edit',
	displayNameLabel: 'Display name',
	useAutomaticName: 'Use automatic name',
	behaviorLegend: 'Protection behavior',
	sharedBehavior: 'Share with other protected sites',
	sharedBehaviorDescription: 'Uses the shared wait, allowance, and schedule.',
	independentBehavior: 'Protect independently',
	independentBehaviorDescription: 'Uses its own wait, allowance, and schedule.',
	saveChanges: 'Save changes',
	saving: 'Saving...',
	cancel: 'Cancel',
	removeSite: 'Remove site',
	keepSite: 'Keep site',
	confirmRemove: 'Remove',
	operationError: 'Your changes could not be saved. Nothing was replaced.',
	configurationChangedError: 'This site changed elsewhere. Reload settings and try again.',
	sharedLabel: 'Shared',
	independentLabel: 'Independent',
	formatBoundary,
	formatRemoveQuestion,
} );
