import type { WebsiteItemProps } from '../site-item/types';
import type { SiteItemEditorOptions } from '../../services/site-item-editor/types';

/**
 * Original item-owned persistence mode with externally owned access and removal actions.
 * @since 0.1.0
 */
export interface PersistedWebsiteItemProps extends SiteItemEditorOptions,
	Omit<WebsiteItemProps, 'editing' | 'onEdit' | 'onChange' | 'persistedEditing'> {}
