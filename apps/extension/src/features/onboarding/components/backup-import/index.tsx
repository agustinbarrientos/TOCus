import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, Button, Group, Icon, IconName, Modal, Stack, Text } from '@tocus/ui';
import { BackupFileError, readBackupFile } from '../../../settings/utils/backup-file';
import type { BackupPreview } from '../../../settings/services/backup-data-actions/types';
import type { BackupResetScreenCopy } from '../../../settings/components/backup-reset-screen/types';
import type { OnboardingBackupActions } from '../../services/onboarding-backup/types';
import type { OnboardingBackupImportProps } from './types';
import './style.scss';

/**
 * Reviews a local backup without changing setup drafts until durable restoration succeeds.
 * @param props - Localized page state, operation guard and completion callback.
 * @return Quiet header action and its accessible local import decision.
 * @since 1.1.0
 */
export function BackupImport( props: OnboardingBackupImportProps ) {
	const copy = props.state.copy?.backup;
	const actions = props.state.backupActions;
	const input = useRef<HTMLInputElement>( null );
	const mounted = useRef( true );
	const selection = useRef( 0 );
	const active = useRef( false );
	const importing = useRef( false );
	const recovery = useRef( false );
	const owner = useRef<OnboardingBackupActions | null>( null );
	const [ opened, setOpened ] = useState( false );
	const [ reading, setReading ] = useState( false );
	const [ pending, setPending ] = useState( false );
	const [ recoveryPending, setRecoveryPending ] = useState( false );
	const [ preview, setPreview ] = useState<BackupPreview | null>( null );
	const [ filename, setFilename ] = useState( '' );
	const [ errorKey, setError ] = useState<keyof BackupResetScreenCopy | null>( null );

	useEffect( () => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			selection.current++;
		};
	}, [] );
	/**
	 * Contains a late asynchronous result after cancellation or unmount.
	 * @param current - Selection identity captured before the asynchronous operation.
	 * @return Whether the operation still owns this mounted dialog.
	 */
	function isCurrent( current: number ): boolean {
		return mounted.current && current === selection.current;
	}

	/** Opens the local file explanation while retaining the manual setup form. */
	function open(): void {
		if ( props.disabled || ! actions || active.current || opened ) {
			return;
		}
		setOpened( true );
		setPreview( null );
		setError( null );
	}

	/** Cancels an unconfirmed read or review without letting a late read reopen it. */
	function cancel(): void {
		if ( importing.current || recovery.current ) {
			return;
		}
		selection.current++;
		active.current = false;
		owner.current = null;
		setOpened( false );
		setReading( false );
		setPreview( null );
		setError( null );
	}

	/**
	 * Validates the actual native selection before asking the authority for a read-only preview.
	 * @param event - Local file selection; a canceled picker leaves the review unchanged.
	 * @return Completion of the contained file read and readiness check.
	 */
	async function selectFile( event: ChangeEvent<HTMLInputElement> ): Promise<void> {
		const file = event.currentTarget.files?.[ 0 ];
		event.currentTarget.value = '';
		if ( ! file || ! actions || active.current || recovery.current || props.disabled || ! opened ) {
			return;
		}
		const current = ++selection.current;
		active.current = true;
		owner.current = actions;
		setReading( true );
		setError( null );
		setPreview( null );
		setFilename( file.name );
		try {
			const backup = await readBackupFile( file );
			if ( ! isCurrent( current ) ) {
				return;
			}
			const next = await actions.preview( backup );
			if ( isCurrent( current ) ) {
				setPreview( next );
			}
		} catch ( error ) {
			if ( isCurrent( current ) ) {
				const reasons = { oversize: 'backupOversizeError', read: 'backupReadError', json: 'backupJsonError',
					application: 'backupApplicationError', unsupported: 'backupUnsupportedError', invalid: 'backupInvalidError' } as const;
				setError( error instanceof BackupFileError ? reasons[ error.reason ] : 'backupPendingError' );
			}
		} finally {
			if ( isCurrent( current ) ) {
				active.current = false;
				setReading( false );
			}
		}
	}

	/**
	 * Starts browser consent in the confirmation gesture and retains uncertain request identity.
	 * @return Completion of the generation-bound background replacement.
	 */
	async function confirm(): Promise<void> {
		const authority = owner.current;
		if ( active.current || ! preview || ! authority || props.disabled ) {
			return;
		}
		const current = selection.current;
		active.current = true;
		importing.current = true;
		setPending( true );
		setError( null );
		try {
			const result = await authority.confirmImport( preview );
			if ( ! isCurrent( current ) ) {
				return;
			}
			if ( result.status === 'completed' ) {
				setOpened( false );
				props.onImported( result.missingAccess );
				return;
			}
			const failures = { stale: 'backupStaleError', invalid: 'backupInvalidError', busy: 'backupPendingError',
				failed: 'backupImportError', 'recovery-pending': 'backupRecoveryError',
				'permission-error': 'backupPermissionError' } as const;
			const unresolved = recovery.current && result.status !== 'stale';
			setError( unresolved ? 'backupRecoveryError' : failures[ result.status ] );
			recovery.current = unresolved || result.status === 'recovery-pending' || result.status === 'busy';
			setRecoveryPending( recovery.current );
			if ( result.status === 'stale' ) {
				setPreview( null );
				owner.current = null;
			}
		} catch {
			if ( isCurrent( current ) ) {
				setError( 'backupRecoveryError' );
				recovery.current = true;
				setRecoveryPending( true );
			}
		} finally {
			if ( isCurrent( current ) ) {
				active.current = false;
				importing.current = false;
				setPending( false );
			}
		}
	}

	if ( ! copy || ( ! actions && ! opened ) ) {
		return null;
	}
	const totalVisits = preview ? Object.values( preview.backup.statistics.scopes )
		.reduce( ( sum, scope ) => sum + scope.reconsideredVisitCount, 0 ) : 0;
	const locked = pending || recoveryPending;
	return <>
		<Button type="button" variant="transparent" className="onboarding-import-entry"
			style={ { paddingInline: 'var(--tocus-space-3)', fontWeight: 400 } }
			leftSection={ <Icon name={ IconName.FILE_IMPORT } /> }
			disabled={ props.disabled || opened || ! actions } onClick={ open }>{ copy.entryLabel }</Button>
		<input ref={ input } type="file" accept=".json,application/json" hidden aria-label={ copy.chooseFile }
			disabled={ props.disabled || reading || locked } onChange={ ( event ) => {
				void selectFile( event );
			} } />
		<Modal opened={ opened } onClose={ cancel } title={ preview ? copy.reviewTitle : copy.importTitle }
			aria-busy={ reading || pending } closeOnClickOutside={ false } closeOnEscape={ ! locked }
			withCloseButton={ false } centered size="md">
			<Stack gap="var(--tocus-space-5)" className="onboarding-import-dialog">
				<Text>{ preview ? copy.reviewDescription : copy.importDescription }</Text>
				{ preview && <>
					<Group wrap="nowrap" gap="var(--tocus-space-3)" className="onboarding-import-file">
						<Icon name={ IconName.FILE_IMPORT } />
						<div><Text fw={ 600 }>{ filename }</Text>
							<Text size="sm" c="dimmed">{ copy.formatCreatedAt( preview.backup.exportedAt ) }</Text></div>
					</Group>
					<dl className="onboarding-import-summary">
						<div><dt>{ copy.websitesLabel }</dt>
							<dd>{ preview.backup.settings.sites.length }</dd></div>
						<div><dt>{ copy.settingsLabel }</dt><dd>{ copy.includedLabel }</dd></div>
						<div><dt>{ copy.statisticsLabel }</dt>
							<dd>{ copy.formatReconsideredVisits( totalVisits ) }</dd></div>
					</dl>
					<Text size="sm" c="dimmed">{ copy.replacementDescription }</Text>
					<Text size="sm" c="dimmed">{ copy.common.missingPermissionDescription }</Text>
				</> }
				{ errorKey && <Alert color="red" role="alert" icon={ <Icon name={ IconName.CIRCLE_EXCLAMATION } /> }>
					{ copy.common[ errorKey ] }
				</Alert> }
				<Group justify="flex-end" className="onboarding-import-actions">
					<Button variant="outline" data-autofocus disabled={ locked } onClick={ cancel }>{ copy.common.cancel }</Button>
					<Button disabled={ reading || pending || props.disabled } onClick={ () => {
						if ( preview ) {
							void confirm();
						} else {
							input.current?.click();
						}
					} }>{ pending ? copy.common.importingBackup : preview
							? errorKey ? copy.common.retry : copy.restoreBackup : copy.chooseFile }</Button>
				</Group>
				{ preview && <Button type="button" variant="transparent" className="onboarding-import-another"
					style={ { paddingInline: 0, fontWeight: 400 } }
					disabled={ reading || locked || props.disabled } onClick={ () => input.current?.click() }>
					{ copy.chooseDifferentFile }
				</Button> }
			</Stack>
		</Modal>
	</>;
}
