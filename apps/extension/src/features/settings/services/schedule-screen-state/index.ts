import { DraftSaveResult } from '../../utils/draft-controller/types';
import { ProtectionConfigurationEditStatus } from '../../../../domains/protection/services/protection-configuration-editor/types';
import {
	useEffect,
	useState,
} from 'react';
import {
	ScheduleMode,
	NormalizedScheduleSchema,
} from '../../../../domains/protection/types/protection-schedule';
import {
	useDraft,
} from '../settings-draft';
import {
	blankWindow,
	fromSchedule,
	toSchedule,
	schedulesEqual,
	windowErrors,
} from '../../utils/schedule-draft';
import type {
	EditableSettingsScreenProps,
} from '../../components/page/types';
import {
	LoadState,
} from '../../components/recovery/types';
import type {
	ScheduleDraft,
	ScheduleWindowDraft,
} from '../../utils/schedule-draft/types';


/**
 * Coordinates editing of one selected schedule and its authoritative configuration.
 * @param props - Domain editor, localized schedule content and draft registration.
 * @return Observable window draft, selectable destinations and explicit editing actions.
 * @since 0.1.0
 */
export function useScheduleState( props: EditableSettingsScreenProps ) {
	const { shell, register } = props;
	const copy = shell.scheduleCopy;
	const state = useDraft<ScheduleDraft>( { mode: ScheduleMode.ALWAYS, windows: [] }, register, save, schedulesEqual );
	const { draft, value, saving } = state;
	const [ status, setStatus ] = useState<LoadState>( LoadState.LOADING );
	const [ validate, setValidate ] = useState( false );

	/**
	 * Loads current configuration and initializes the default schedule draft.
	 * @return Completion of the authoritative load and recovery-state update.
	 */
	async function load(): Promise<void> {
		setStatus( LoadState.LOADING );
		try {
			const config = await shell.editor?.load();
			if ( config ) {
				const schedule = NormalizedScheduleSchema.parse( config.schedule );
				draft.adopt( fromSchedule( schedule ) );
				setStatus( LoadState.READY );
			} else {
				setStatus( config === null ? LoadState.MALFORMED : LoadState.FAILED );
			}
		} catch {
			setStatus( LoadState.FAILED );
		}
	}
	useEffect( () => {
		void load();
	}, [ shell.editor ] );

	/**
	 * Updates one window without mutating its siblings.
	 * @param id - Stable draft identifier.
	 * @param update - Changed weekday or time fields.
	 */
	function updateWindow( id: number, update: Partial<ScheduleWindowDraft> ): void {
		draft.change( { ...value,
			windows: value.windows.map( ( window ) => window.id === id ? { ...window, ...update } : window ),
		} );
	}

	/** Appends a required blank window with a stable identity. */
	function addWindow(): void {
		const nextId = Math.max( -1, ...value.windows.map( ( window ) => window.id ) ) + 1;
		draft.change( { ...value, windows: [ ...value.windows, blankWindow( nextId ) ] } );
	}

	/**
	 * Removes one window; the view preserves at least one editable custom window.
	 * @param id - Window selected by the contextual remove action.
	 */
	function removeWindow( id: number ): void {
		if ( value.windows.length > 1 ) {
			draft.change( { ...value, windows: value.windows.filter( ( window ) => window.id !== id ) } );
		}
	}

	/**
	 * Switches schedule mode while retaining the currently edited custom windows.
	 * @param mode - Selected always or custom mode.
	 */
	function changeMode( mode: ScheduleMode ): void {
		draft.change( { mode,
			windows: mode === ScheduleMode.CUSTOM && value.windows.length === 0 ? [ blankWindow( 0 ) ] : value.windows,
		} );
	}

	/**
	 * Validates required fields before persisting a normalized schedule through the domain editor.
	 * @return Explicit persistence success or a retained invalid draft.
	 */
	function save(): Promise<DraftSaveResult> {
		setValidate( true );
		const invalidWindow = value.windows.some( ( window ) => {
			const errors = windowErrors( window, copy );
			return errors.start !== null || errors.end !== null;
		} );
		if ( saving || value.mode === ScheduleMode.CUSTOM && ( invalidWindow || value.windows.length === 0 ) ) {
			return Promise.resolve( DraftSaveResult.FAILED );
		}
		return draft.save( async ( candidate ) => {
			const result = await shell.editor?.updateSchedule( toSchedule( candidate ) );
			if ( ! result ) {
				throw new Error( 'persistence' );
			}
			if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
				throw new Error( result.reason );
			}
			setValidate( false );
			return fromSchedule( NormalizedScheduleSchema.parse( result.configuration.schedule ) );
		} );
	}

	return { ...state, status, validate, load, save, updateWindow, addWindow, removeWindow, changeMode };
}
