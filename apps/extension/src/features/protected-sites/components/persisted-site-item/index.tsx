import { useMemo, useSyncExternalStore } from 'react';
import { createSiteItemEditor } from '../../services/site-item-editor';
import { WebsiteItem } from '../site-item';
import type { PersistedWebsiteItemProps } from './types';

/**
 * Binds the original standalone item presentation to the real atomic domain editor.
 * @param props - Saved site, editor boundary and owner-provided access/removal actions.
 * @return Reusable standalone editor without changing Settings' page-wide draft transaction.
 * @since 0.1.0
 */
export function PersistedWebsiteItem( props: PersistedWebsiteItemProps ) {
	const editor = useMemo( () => createSiteItemEditor( props ), [ props.site, props.editor, props.onSaved ] );
	const state = useSyncExternalStore( editor.subscribe, editor.getSnapshot );
	/** Starts the existing asynchronous domain operation from the explicit save gesture. */
	function save(): void {
		void editor.save();
	}
	return <WebsiteItem { ...props } editing={ state.editing } disabled={ props.disabled || state.saving }
		onEdit={ editor.open } onChange={ editor.change }
		persistedEditing={ { state, save, cancel: editor.cancel } } />;
}
