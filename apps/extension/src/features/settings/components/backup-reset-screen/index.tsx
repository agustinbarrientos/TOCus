import { useLayoutEffect, useState } from 'react';
import { BackupControls } from '../backup-controls';
import { Confirmation } from '../confirmation';
import { Feedback } from '../feedback';
import { Page } from '../page';
import { DataResetAction } from './types';
import type { EditableSettingsScreenProps } from '../page/types';
import { DraftSaveResult } from '../../utils/draft-controller/types';
import './style.scss';
import { ResetSection } from '../reset-section';

/**
 * Groups explicit local backup and reset operations behind their existing confirmation controls.
 * @param props - Localized settings and background-owned data actions.
 * @return Backup, restore and reset controls with one shared operation owner.
 * @since 1.1.0
 */
export function BackupReset( props: EditableSettingsScreenProps ) {
	const { register } = props;
	const { backupResetCopy: copy, privacyActions: actions } = props.shell;
	const [ confirmation, setConfirmation ] = useState<DataResetAction | null>( null );
	const [ pending, setPending ] = useState( false );
	const [ backupBusy, setBackupBusy ] = useState( false );
	const [ failed, setFailed ] = useState( false );
	const [ completed, setCompleted ] = useState<DataResetAction | null>( null );
	const statistics = confirmation === DataResetAction.STATISTICS;
	useLayoutEffect( () => {
		// Keep file reads, replacement decisions and recovery mounted until their owner releases them.
		register( {
			dirty: false, saving: backupBusy,
			/**
			 * Leaves cancellation to the backup operation's explicit controls.
			 * @return No editable draft is discarded.
			 */
			discard: () => undefined,
			/**
			 * Prevents navigation from treating a backup operation as an editable draft.
			 * @return Failed draft result; the backup operation owns its own completion.
			 */
			save: () => Promise.resolve( DraftSaveResult.FAILED ),
		} );
		return () => {
			register( null );
		};
	}, [ register, backupBusy ] );

	/**
	 * Opens confirmation and clears feedback from the previous operation.
	 * @param operation - Data reset selected by the user.
	 */
	function requestReset( operation: DataResetAction ): void {
		if ( pending || backupBusy || confirmation !== null ) {
			return;
		}
		setConfirmation( operation );
		setFailed( false );
		setCompleted( null );
	}

	/** Closes confirmation without changing local data. */
	function cancelReset(): void {
		setConfirmation( null );
		setFailed( false );
	}

	/**
	 * Retains failed confirmation for an explicit retry and announces success.
	 * @return Completion of the authoritative background operation.
	 */
	async function confirmReset(): Promise<void> {
		if ( pending || confirmation === null || actions === null ) {
			return;
		}
		const operation = confirmation;
		setPending( true );
		setFailed( false );
		try {
			const success = operation === DataResetAction.STATISTICS
				? await actions.resetStatistics() : await actions.resetAllData();
			if ( success ) {
				setConfirmation( null );
				setCompleted( operation );
			} else {
				setFailed( true );
			}
		} catch {
			setFailed( true );
		} finally {
			setPending( false );
		}
	}

	const confirmationLabel = pending ? copy.resetting : failed ? copy.retry
		: statistics ? copy.resetStatistics : copy.resetAll;
	const successMessage = completed === DataResetAction.STATISTICS ? copy.statisticsSuccess
		: completed === DataResetAction.ALL ? copy.allSuccess : null;

	/**
	 * Keeps each confirmation mounted in its owning section so the library can return focus safely.
	 * @param operation - Reset action whose inline confirmation is being presented.
	 * @return Contextual confirmation with the existing guarded operation callbacks.
	 */
	function renderConfirmation( operation: DataResetAction ) {
		const resetStatistics = operation === DataResetAction.STATISTICS;
		return <Confirmation inline opened={ confirmation === operation } focusConfirm={ failed }
			title={ resetStatistics ? copy.statisticsConfirmationTitle : copy.allConfirmationTitle }
			description={ resetStatistics ? copy.statisticsConfirmation : copy.allConfirmation }
			cancel={ copy.cancel } confirm={ confirmationLabel } pending={ pending }
			onCancel={ cancelReset } onConfirm={ () => {
				void confirmReset();
			} }>
			<Feedback error={ failed ? copy.resetError : null } />
		</Confirmation>;
	}

	return (
		<Page title={ copy.title }>
			<BackupControls shell={ props.shell } disabled={ pending || confirmation !== null }
				onBusyChange={ setBackupBusy } />
			<ResetSection title={ copy.statisticsTitle } description={ copy.statisticsDescription }
				label={ copy.resetStatistics } disabled={ pending || backupBusy || actions === null }
				onRequest={ () => {
					requestReset( DataResetAction.STATISTICS );
				} }>{ renderConfirmation( DataResetAction.STATISTICS ) }</ResetSection>
			<ResetSection title={ copy.allTitle } description={ copy.allDescription }
				label={ copy.resetAll } disabled={ pending || backupBusy || actions === null }
				onRequest={ () => {
					requestReset( DataResetAction.ALL );
				} }>{ renderConfirmation( DataResetAction.ALL ) }</ResetSection>
			{ ( actions === null || successMessage ) && <Feedback
				error={ actions === null ? copy.unavailable : null } success={ successMessage } /> }
		</Page>
	);
}
