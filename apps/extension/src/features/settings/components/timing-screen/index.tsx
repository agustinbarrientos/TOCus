import { TimingScreenSaveErrorReason } from './types';
import { ProtectionConfigurationEditStatus } from '../../../../domains/protection/services/protection-configuration-editor/types';
import {
	useEffect,
	useState,
} from 'react';
import {
	Stack,
} from '@tocus/ui';
import {
	DefaultTimingConfiguration,
} from '../../../../domains/protection/types/timing-configuration';
import {
	DraftActions,
} from '../draft-actions';
import {
	Feedback,
} from '../feedback';
import {
	Page,
} from '../page';
import {
	Recovery,
} from '../recovery';
import {
	useDraft,
} from '../../services/settings-draft';
import {
	TimingControls,
} from '../timing-controls';
import type {
	EditableSettingsScreenProps,
} from '../page/types';
import {
	LoadState,
} from '../recovery/types';


/**
 * Edits global timing through the existing validated configuration editor.
 * @param props - Localized destination content, editor and navigation registration.
 * @return Timing form with persistence feedback and an authoritative discard baseline.
 * @since 0.1.0
 */
export function Timing( props: EditableSettingsScreenProps ) {
	const { shell, register } = props;
	const copy = shell.timingCopy;
	const { draft, value, saving, saved, error } = useDraft( { ...DefaultTimingConfiguration }, register );
	const [ status, setStatus ] = useState<LoadState>( LoadState.LOADING );

	/**
	 * Loads validated timing without overwriting malformed local data.
	 * @return Completion of the current storage read and recovery-state update.
	 */
	async function load(): Promise<void> {
		setStatus( LoadState.LOADING );
		try {
			const configuration = await shell.editor?.load();
			if ( configuration ) {
				draft.adopt( configuration.timingConfiguration );
				setStatus( LoadState.READY );
			} else {
				setStatus( configuration === null ? LoadState.MALFORMED : LoadState.FAILED );
			}
		} catch {
			setStatus( LoadState.FAILED );
		}
	}

	useEffect( () => {
		void load();
	}, [ shell.editor ] );

	/** Persists a complete candidate while retaining any rejected edits. */
	function save(): void {
		void draft.save( async ( timing ) => {
			const result = await shell.editor?.updateTiming( timing );
			if ( ! result ) {
				throw new Error( 'persistence' );
			}
			if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
				throw new Error( result.reason );
			}
			return result.configuration.timingConfiguration;
		} );
	}

	const errorMessage = error === TimingScreenSaveErrorReason.INVALID_TIMING_CONFIGURATION
		? copy.invalidTimingConfigurationError
		: error === TimingScreenSaveErrorReason.INVALID_CONFIGURATION
			? copy.invalidConfigurationError : error ? copy.saveError : null;

	return (
		<Page title={ copy.title } eyebrow={ copy.eyebrow } introduction={ copy.introduction }>
			<Recovery status={ status } copy={ copy } retry={ () => {
				void load();
			} } />
			{ status === LoadState.READY && <form aria-label={ copy.formLabel } aria-busy={ saving }
				onSubmit={ ( event ) => {
					event.preventDefault(); save();
				} }>
				<Stack gap={ 0 }>
					<TimingControls copy={ copy } value={ value } disabled={ saving } onChange={ draft.change } />
					<Feedback error={ errorMessage } success={ saved ? copy.saved : null } />
					<DraftActions draft={ draft } copy={ copy } onSave={ save } />
				</Stack>
			</form> }
		</Page>
	);
}
