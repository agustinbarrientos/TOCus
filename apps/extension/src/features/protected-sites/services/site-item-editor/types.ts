import type { ProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import type { ProtectedSiteConfiguration, ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import type { ProtectedSiteItemOperationErrorReason } from '../../components/site-item/types';

/**
 * Editable state for the original item-owned save/cancel transaction.
 * @since 0.1.0
 */
export interface SiteItemEditorSnapshot {
	editing: boolean;
	saving: boolean;
	displayName: string;
	independent: boolean;
	error: ProtectedSiteItemOperationErrorReason | null;
}

/**
 * Existing domain boundary and completion notification for a standalone item.
 * @since 0.1.0
 */
export interface SiteItemEditorOptions {
	site: ProtectedSiteConfiguration;
	editor: ProtectionConfigurationEditor | null;
	onSaved: ( configuration: ProtectionConfigurationDocument ) => void;
}

/**
 * Observable item-owned transaction, separate from Settings' page-owned draft.
 * @since 0.1.0
 */
export interface SiteItemEditor {
	getSnapshot: () => Readonly<SiteItemEditorSnapshot>;
	subscribe: ( listener: () => void ) => () => void;
	open: () => void;
	cancel: () => void;
	change: ( displayName: string, independent: boolean ) => void;
	save: () => Promise<void>;
}
