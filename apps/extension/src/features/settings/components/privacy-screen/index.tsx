import {
	useState,
} from 'react';
import {
	Button,
	Title,
} from '@tocus/ui';
import {
	Confirmation,
} from '../confirmation';
import {
	Feedback,
} from '../feedback';
import {
	Page,
} from '../page';
import { PrivacyResetAction,
	type ResetSectionProps,
} from './types';
import type {
	SettingsScreenProps,
} from '../page/types';
import './style.scss';


/**
 * Groups one reset explanation with the action that requests confirmation.
 * @param props - Localized description, availability and confirmation trigger.
 * @return Consistent full-width reset section.
 * @since 0.1.0
 */
function ResetSection( props: ResetSectionProps ) {
	return (
		<section className="tocus-section settings-privacy-reset">
			<h2>{ props.title }</h2>
			<p>{ props.description }</p>
			<Button color="red" disabled={ props.disabled } onClick={ props.onRequest }>{ props.label }</Button>
			{ props.children }
		</section>
	);
}


/**
 * Explains local data and runs only explicitly confirmed reset operations.
 * @param props - Canonical privacy content and background-owned reset actions.
 * @return Read-only privacy disclosures and confirmed data controls.
 * @since 0.1.0
 */
export function Privacy( props: SettingsScreenProps ) {
	const { privacyCopy: copy, privacyActions: actions, supportsCachedFavicons } = props.shell;
	const [ confirmation, setConfirmation ] = useState<PrivacyResetAction | null>( null );
	const [ pending, setPending ] = useState( false );
	const [ failed, setFailed ] = useState( false );
	const [ completed, setCompleted ] = useState<PrivacyResetAction | null>( null );
	const statistics = confirmation === PrivacyResetAction.STATISTICS;
	const permissions = [ copy.websitePermission, copy.toolbarPermission, copy.navigationPermission,
		copy.localToolsPermission, ...( supportsCachedFavicons ? [ copy.faviconPermission ] : [] ) ];

	/**
	 * Opens confirmation and clears feedback from the previous operation.
	 * @param operation - Data reset selected by the user.
	 */
	function requestReset( operation: PrivacyResetAction ): void {
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
			const success = operation === PrivacyResetAction.STATISTICS
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
	const successMessage = completed === PrivacyResetAction.STATISTICS ? copy.statisticsSuccess
		: completed === PrivacyResetAction.ALL ? copy.allSuccess : null;

	/**
	 * Keeps each confirmation mounted in its owning section so the library can return focus safely.
	 * @param operation - Reset action whose inline confirmation is being presented.
	 * @return Contextual confirmation with the existing guarded operation callbacks.
	 */
	function renderConfirmation( operation: PrivacyResetAction ) {
		const resetStatistics = operation === PrivacyResetAction.STATISTICS;
		return <Confirmation inline opened={ confirmation === operation } focusConfirm={ failed }
			title={ resetStatistics ? copy.statisticsConfirmationTitle : copy.allConfirmationTitle }
			description={ resetStatistics ? copy.statisticsConfirmation : copy.allConfirmation }
			cancel={ copy.cancel } confirm={ confirmationLabel } pending={ pending }
			onCancel={ cancelReset } onConfirm={ () => {
				void confirmReset();
			} }>
			<Feedback className="settings-privacy-error tocus-notice-paragraph tocus-notice-compact"
				error={ failed ? copy.resetError : null } />
		</Confirmation>;
	}

	return (
		<Page title={ copy.title } introduction={ copy.introduction }>
			<section className="tocus-section">
				<h2>{ copy.storedTitle }</h2>
				<p>{ copy.storedDescription }</p>
				<p>{ copy.statisticsPrivacy }</p>
				<p>{ copy.recoveryPrivacy }</p>
			</section>
			<details className="tocus-section settings-privacy-permissions">
				<summary>
					<Title order={ 2 } component="span">{ copy.permissionsTitle }</Title>
				</summary>
				<ul>{ permissions.map( ( permission ) => <li key={ permission }>{ permission }</li> ) }</ul>
				<p>{ copy.deniedPermission }</p>
			</details>
			<ResetSection title={ copy.statisticsTitle } description={ copy.statisticsDescription }
				label={ copy.resetStatistics } disabled={ pending || actions === null }
				onRequest={ () => {
					requestReset( PrivacyResetAction.STATISTICS );
				} }>{ renderConfirmation( PrivacyResetAction.STATISTICS ) }</ResetSection>
			<ResetSection title={ copy.allTitle } description={ copy.allDescription }
				label={ copy.resetAll } disabled={ pending || actions === null }
				onRequest={ () => {
					requestReset( PrivacyResetAction.ALL );
				} }>{ renderConfirmation( PrivacyResetAction.ALL ) }</ResetSection>
			{ ( actions === null || successMessage ) && <div className="settings-privacy-feedback">
				<Feedback className="tocus-notice-paragraph"
					error={ actions === null ? copy.unavailable : null } success={ successMessage } />
			</div> }
		</Page>
	);
}
