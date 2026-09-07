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
} from '../../utils/draft-controller/types';


/**
 * Connects one observable draft to React and the destination navigation guard.
 * @param initial - Safe value before authoritative storage is loaded.
 * @param register - Shell callback receiving current dirty and saving state.
 * @param equals - Optional domain-aware comparison for persistence-relevant edits.
 * @return Draft controller and its current immutable snapshot.
 * @since 0.1.0
 */
export function useDraft<T extends object>( initial: T, register: RegisterDraft, equals?: DraftEquality<T> ) {
	const [ draft ] = useState( () => createDraft( initial, equals ) );
	const state = useSyncExternalStore( draft.subscribe, () => draft.snapshot );
	useEffect( () => {
		register( { dirty: state.dirty, saving: state.saving, discard: draft.discard } );
	}, [ draft, register, state.dirty, state.saving ] );
	useEffect( () => () => {
		register( null );
	}, [ register ] );
	return { draft, ...state };
}
