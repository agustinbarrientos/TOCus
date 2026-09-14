import {
	useEffect,
	useState,
	useSyncExternalStore,
} from 'react';
import {
	createDraft,
} from '../../utils/draft-controller';
import type {
	RegisterDraft,
	DraftEquality,
	SaveDraft,
} from '../../utils/draft-controller/types';


/**
 * Connects one observable draft to React and the destination navigation guard.
 * @param initial - Safe value before authoritative storage is loaded.
 * @param register - Shell callback receiving current dirty and saving state.
 * @param save - Page-owned validation and persistence called from the original Save gesture.
 * @param equals - Optional domain-aware comparison for persistence-relevant edits.
 * @return Draft controller and its current immutable snapshot.
 * @since 0.1.0
 */
export function useDraft<T extends object>(
	initial: T, register: RegisterDraft, save: SaveDraft, equals?: DraftEquality<T>,
) {
	const [ draft ] = useState( () => createDraft( initial, equals ) );
	const state = useSyncExternalStore( draft.subscribe, () => draft.snapshot );
	useEffect( () => {
		register( {
			/**
			 * Reads live edits even before React renders a persistence transition.
			 * @return Whether the current candidate differs from its baseline.
			 */
			get dirty() {
				return draft.snapshot.dirty;
			},
			/**
			 * Reads the controller's synchronous lock rather than a captured render.
			 * @return Whether persistence currently owns the draft.
			 */
			get saving() {
				return draft.snapshot.saving;
			},
			discard: draft.discard,
			save,
		} );
	}, [ draft, register, save ] );
	useEffect( () => () => {
		register( null );
	}, [ register ] );
	return { draft, ...state };
}
