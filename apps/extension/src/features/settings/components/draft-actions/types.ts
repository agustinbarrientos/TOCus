import type {
	Draft,
} from '../../utils/draft-controller/types';


/**
 * Localized common draft actions.
 * @since 0.1.0
 */
export interface DraftActionCopy {
	save: string;
	discard: string;
	saving: string;
}


/**
 * Consistent Save and Discard actions for one observable draft.
 * @since 0.1.0
 */
export interface DraftActionsProps<T extends object> {
	draft: Draft<T>;
	copy: DraftActionCopy;
	onSave: () => void;
}
