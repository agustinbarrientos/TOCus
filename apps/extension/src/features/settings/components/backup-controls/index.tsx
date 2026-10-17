import { useRef, useState, type ChangeEvent } from 'react';
import { Button, Group } from '@tocus/ui';
import { Confirmation } from '../confirmation';
import { Feedback } from '../feedback';
import type { SettingsScreenProps } from '../page/types';
import type { BackupPreview } from '../../services/backup-data-actions';
import { BackupFileError, downloadBackup, readBackupFile } from '../../utils/backup-file';
import { BackupPreviewContent } from './preview';
import './style.scss';

/**
 * Runs local file operations only after an explicit user choice and replacement confirmation.
 * @param props - Current localized settings shell and backup actions.
 * @return Accessible backup controls with a readable, text-only preview.
 * @since 1.1.0
 */
export function BackupControls( props: SettingsScreenProps ) {
	const { shell } = props;
	const copy = shell.privacyCopy;
	const actions = shell.backupActions;
	const input = useRef<HTMLInputElement>( null );
	const active = useRef( false );
	const selection = useRef( 0 );
	const [ pending, setPending ] = useState( false );
	const [ preview, setPreview ] = useState<BackupPreview | null>( null );
	const [ errorKey, setError ] = useState<keyof typeof copy | null>( null );
	const [ successKey, setSuccess ] = useState<keyof typeof copy | null>( null );

	/**
	 * Reads the actual selected file and resets the input so the same file can be retried.
	 * @param event - Native file selection, possibly canceled by the user.
	 * @return Completion of local decoding and authority readiness inspection.
	 */
	async function selectFile( event: ChangeEvent<HTMLInputElement> ): Promise<void> {
		const file = event.currentTarget.files?.[ 0 ];
		event.currentTarget.value = '';
		if ( ! file || ! actions || active.current ) {
			return;
		}
		const current = ++selection.current;
		setError( null ); setSuccess( null ); setPreview( null );
		try {
			const backup = await readBackupFile( file );
			const next = await actions.preview( backup );
			if ( current === selection.current ) {
				setPreview( next );
			}
		} catch ( error ) {
			if ( current !== selection.current ) {
				return;
			}
			const reasons = { oversize: 'backupOversizeError', read: 'backupReadError', json: 'backupJsonError',
				application: 'backupApplicationError', unsupported: 'backupUnsupportedError', invalid: 'backupInvalidError' } as const;
			setError( error instanceof BackupFileError ? reasons[ error.reason ] : 'backupPendingError' );
		}
	}

	/**
	 * Starts the browser permission prompt directly in the confirmation gesture.
	 * @return Completion of the background-owned replacement and coherent settings refresh.
	 */
	async function confirm(): Promise<void> {
		if ( active.current || ! preview || ! actions ) {
			return;
		}
		active.current = true; setPending( true ); setError( null );
		try {
			const result = await actions.confirmImport( preview );
			if ( result.status === 'completed' ) {
				setPreview( null );
				setSuccess( result.missingAccess ? 'importMissingAccessSuccess' : 'importSuccess' );
			} else {
				const failures = { stale: 'backupStaleError', invalid: 'backupInvalidError', busy: 'backupPendingError',
					failed: 'backupImportError', 'recovery-pending': 'backupRecoveryError',
					'permission-error': 'backupPermissionError' } as const;
				setError( failures[ result.status ] );
			}
		} catch {
			setError( 'backupRecoveryError' );
		} finally {
			active.current = false; setPending( false );
		}
	}

	/**
	 * Downloads only a validated authoritative snapshot.
	 * @return Completion of the local download request.
	 */
	async function exportFile(): Promise<void> {
		if ( active.current || ! actions ) {
			return;
		}
		active.current = true; setPending( true ); setError( null ); setSuccess( null );
		try {
			const result = await actions.export();
			if ( result.status === 'available' ) {
				downloadBackup( result.backup ); setSuccess( 'exportSuccess' );
			} else {
				setError( result.status === 'busy' ? 'backupPendingError' : 'exportError' );
			}
		} catch {
			setError( 'exportError' );
		} finally {
			active.current = false; setPending( false );
		}
	}
	return <section className="tocus-section settings-backup" aria-busy={ pending }>
		<h2>{ copy.backupTitle }</h2><p>{ copy.backupDescription }</p><p>{ copy.backupPrivacy }</p>
		<Group>
			<Button disabled={ pending || !! preview || ! actions } onClick={ () => {
				void exportFile();
			} }>
				{ pending && ! preview ? copy.exportingBackup : copy.exportBackup }</Button>
			<Button variant="outline" disabled={ pending || ! actions } onClick={ () => {
				input.current?.click();
			} }>
				{ copy.importBackup }</Button>
		</Group>
		<input ref={ input } type="file" accept=".json,application/json" hidden aria-label={ copy.importBackup }
			disabled={ pending || ! actions } onChange={ ( event ) => {
				void selectFile( event );
			} } />
		<Confirmation inline opened={ preview !== null } title={ copy.replaceConfirmationTitle }
			description={ copy.replaceConfirmation } cancel={ copy.cancel }
			confirm={ pending ? copy.importingBackup : errorKey ? copy.retry : copy.replaceBackup }
			pending={ pending } focusConfirm={ errorKey !== null }
			onCancel={ () => {
				selection.current++; setPreview( null ); setError( null );
			} }
			onConfirm={ () => {
				void confirm();
			} }>
			<p>{ copy.missingPermissionDescription }</p>
			{ preview && <BackupPreviewContent shell={ shell } backup={ preview.backup } /> }
			<Feedback error={ errorKey ? copy[ errorKey ] : null } />
		</Confirmation>
		{ ! preview && <Feedback error={ errorKey ? copy[ errorKey ] : null }
			success={ successKey ? copy[ successKey ] : null } /> }
	</section>;
}
