import {
	useEffect,
	useCallback,
	useRef,
	useState,
} from 'react';
import {
	DefaultPreferencesDocument,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	useDraft,
} from '../settings-draft';
import {
	LoadState,
} from '../../components/recovery/types';
import type {
	PreferencesScreenProps,
} from '../../components/preferences-screen/types';
import type { DraftGuard } from '../../utils/draft-controller/types';


/**
 * Coordinates preference reads, external changes, live previews and partial saves.
 * @param props - Preference services and the subset edited by this destination.
 * @return Observable draft, recovery state and explicit persistence actions.
 * @since 0.1.0
 */
export function usePreferencesState( props: PreferencesScreenProps ) {
	const { shell, register, language = false } = props;
	const [ recovery, setRecovery ] = useState( { pending: false, failed: false, restored: false } );
	/**
	 * Includes explicit default restoration in the shell's pending-write navigation guard.
	 * @param guard - Current editable draft state, or null during destination cleanup.
	 */
	const registerPreferencesDraft = useCallback( ( guard: DraftGuard | null ) => {
		register( guard === null ? null : { ...guard, saving: guard.saving || recovery.pending } );
	}, [ register, recovery.pending ] );
	const state = useDraft( { ...DefaultPreferencesDocument }, registerPreferencesDraft );
	const { draft, value } = state;
	const [ status, setStatus ] = useState<LoadState>( LoadState.LOADING );
	const generation = useRef( 0 );

	/**
	 * Loads preferences without replacing malformed data or a newer external projection.
	 * @return Completion of the latest authoritative read.
	 */
	async function load(): Promise<void> {
		const request = ++generation.current;
		setStatus( LoadState.LOADING );
		try {
			const preferences = await shell.preferencesEditor?.load();
			if ( request !== generation.current ) {
				return;
			}
			if ( preferences ) {
				draft.adopt( preferences );
				setStatus( LoadState.READY );
			} else {
				setStatus( preferences === null ? LoadState.MALFORMED : LoadState.FAILED );
			}
		} catch {
			if ( request === generation.current ) {
				setStatus( LoadState.FAILED );
			}
		}
	}

	useEffect( () => {
		void load();
		return () => {
			generation.current++;
		};
	}, [ shell.preferencesEditor ] );

	useEffect( () => {
		/**
		 * Rebases untouched fields while retaining this page's unsaved choices.
		 * @param preferences - New authoritative projection or malformed-data marker.
		 */
		function receivePreferences( preferences: PreferencesDocument | null ): void {
			generation.current++;
			if ( preferences === null ) {
				setStatus( LoadState.MALFORMED );
			} else {
				draft.rebase( preferences );
				setStatus( LoadState.READY );
			}
		}
		shell.preferencesSource?.addPreferencesChangeListener( receivePreferences );
		return () => shell.preferencesSource?.removePreferencesChangeListener( receivePreferences );
	}, [ shell.preferencesSource, draft ] );

	useEffect( () => {
		if ( status === LoadState.READY ) {
			shell.preferencesPreview?.apply( value );
		}
	}, [ value, shell.preferencesPreview, status ] );

	/** Saves only dirty fields belonging to the current preference destination. */
	function save(): void {
		void draft.save( async ( preferences ) => {
			const fields: ( keyof PreferencesDocument )[] = language
				? [ 'language' ] : [ 'theme', 'palette', 'pauseMode', 'reducedMotion' ];
			const changedFields = fields.filter( ( key ) => preferences[ key ] !== draft.baseline[ key ] );
			const update = Object.fromEntries( changedFields.map( ( key ) => [ key, preferences[ key ] ] ) );
			const updated = await shell.preferencesEditor?.update( update );
			if ( ! updated ) {
				if ( updated === null ) {
					setStatus( LoadState.MALFORMED );
				}
				throw new Error( 'persistence' );
			}
			return updated;
		} );
	}

	/**
	 * Repairs malformed preferences only after the user requests Restore defaults.
	 * @return Completion of explicit recovery and its semantic feedback.
	 */
	async function restore(): Promise<void> {
		if ( recovery.pending || shell.preferencesEditor === null ) {
			return;
		}
		setRecovery( { pending: true, failed: false, restored: false } );
		try {
			const preferences = await shell.preferencesEditor.restoreDefaults();
			draft.adopt( preferences );
			setStatus( LoadState.READY );
			setRecovery( { pending: false, failed: false, restored: true } );
		} catch {
			setRecovery( { pending: false, failed: true, restored: false } );
		}
	}

	return { ...state, status, recovery, load, save, restore };
}
