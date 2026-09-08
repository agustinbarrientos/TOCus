import { ProtectionConfigurationEditStatus } from '../../../../domains/protection/services/protection-configuration-editor';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ProtectedSiteItemOperationErrorReason } from '../../components/site-item/types';
import { resolveSiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import type { SiteItemEditor, SiteItemEditorOptions, SiteItemEditorSnapshot } from './types';

/**
 * Restores the original standalone item transaction while leaving page drafts independent.
 * @param options - Exact site, real domain editor and committed-configuration notification.
 * @return Observable local editor with retained failures and explicit save/cancel operations.
 * @since 0.1.0
 */
export function createSiteItemEditor( options: SiteItemEditorOptions ): SiteItemEditor {
	const initial: SiteItemEditorSnapshot = { editing: false, saving: false, error: null,
		displayName: options.site.displayNameOverride ?? resolveSiteDisplayIdentity( options.site ).name,
		independent: options.site.rule.scopeId !== DefaultProtectionScopeId };
	let snapshot = initial;
	const listeners = new Set<() => void>();

	/**
	 * Publishes a fresh snapshot for subscribed React and framework-neutral consumers.
	 * @param update - Changed local transaction fields.
	 */
	function publish( update: Partial<SiteItemEditorSnapshot> ): void {
		snapshot = { ...snapshot, ...update };
		listeners.forEach( ( listener ) => {
			listener();
		} );
	}

	/**
	 * Saves through the authoritative editor, retaining drafts after rejection or failure.
	 * @return Completion of one accepted attempt; duplicate pending attempts have no effect.
	 */
	async function save(): Promise<void> {
		if ( snapshot.saving ) {
			return;
		}
		if ( options.editor === null ) {
			publish( { error: ProtectedSiteItemOperationErrorReason.OPERATION } );
			return;
		}
		publish( { saving: true, error: null } );
		try {
			const result = await options.editor.update( options.site.identityHost,
				snapshot.displayName,
				snapshot.independent );
			if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
				publish( { error: ProtectedSiteItemOperationErrorReason.CONFIGURATION_CHANGED } );
			} else {
				options.onSaved( result.configuration );
				publish( { editing: false } );
			}
		} catch {
			publish( { error: ProtectedSiteItemOperationErrorReason.OPERATION } );
		} finally {
			publish( { saving: false } );
		}
	}

	return {
		/**
		 * Reads the immutable transaction snapshot consumed by React subscriptions.
		 * @return Latest published local transaction state.
		 */
		getSnapshot: () => snapshot,
		/**
		 * Subscribes to transaction changes without starting a storage read.
		 * @param listener - Callback notified after each published snapshot.
		 * @return Cleanup that removes only this subscription.
		 */
		subscribe: ( listener ) => {
			listeners.add( listener );
			return () => listeners.delete( listener );
		},
		/**
		 * Opens a fresh draft from the last supplied authoritative site.
		 */
		open: () => {
			publish( { ...initial, editing: true } );
		},
		/**
		 * Discards local edits without touching persistence or browser permissions.
		 */
		cancel: () => {
			publish( { ...initial } );
		},
		/**
		 * Updates editable fields and clears an error belonging to the previous attempt.
		 * @param displayName - Raw name displayed by the item-owned text field.
		 * @param independent - Whether the draft requests a separate scope.
		 */
		change: ( displayName, independent ) => {
			publish( { displayName, independent, error: null } );
		},
		save,
	};
}
