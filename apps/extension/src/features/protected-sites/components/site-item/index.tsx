import {
	Avatar,
	Alert,
	ActionIcon,
	Button,
	Group,
	Stack,
	Tooltip,
	Icon,
	IconName,
} from '@tocus/ui';
import {
	resolveSiteDisplayIdentity,
} from '../../utils/site-display-name-resolver';
import {
	WebsiteDetails,
} from '../website-details';
import type {
	WebsiteItemProps,
} from './types';
import './style.scss';
import { Feedback } from '../../../settings/components/feedback';
import { ProtectedSiteItemOperationErrorReason } from './types';
import { useState, type SubmitEvent } from 'react';
import { createWebsiteDetails } from '../../utils/website-draft';
import { fromSchedule, toSchedule } from '../../../settings/utils/schedule-draft';
import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';


/**
 * Presents a website identity, its active hours, and accessible editing or access-recovery actions.
 * @param props - Controlled website values, current access and explicit row actions.
 * @return Website identity, denied-access recovery and optional draft editor.
 * @since 0.1.0
 */
export function WebsiteItem( props: WebsiteItemProps ) {
	const { site, copy, disabled } = props;
	const [ validate, setValidate ] = useState( false );
	const details = props.persistedEditing?.state.details ?? props.details ?? createWebsiteDetails( site );
	const identity = resolveSiteDisplayIdentity( { ...site,
		displayNameOverride: details.displayName.trim() || undefined } );
	const activeSchedule = details.schedule ?? fromSchedule( props.globalSchedule );
	const summary = activeSchedule.mode === ScheduleMode.ALWAYS ? props.scheduleCopy.alwaysLabel
		: activeSchedule.windows.map( ( window ) =>
			`${ props.scheduleCopy.formatWeekday( window.weekday ) } ${ window.start } - ${ window.fullDay ? '24:00' : window.end }` ).join( ' / ' );
	const error = props.persistedEditing?.state.error;
	/**
	 * Completes the current editor through its existing owner without duplicating persistence.
	 * @param event - Native form submission from Enter or the primary action.
	 */
	function submitEditor( event: SubmitEvent<HTMLFormElement> ): void {
		event.preventDefault();
		if ( disabled ) {
			return;
		}
		setValidate( true );
		try {
			if ( details.schedule !== null ) {
				toSchedule( details.schedule );
			}
		} catch {
			return;
		}
		const submit = props.persistedEditing?.save ?? props.onDone ?? props.onEdit;
		submit();
	}
	return (
		<li className="settings-site-item">
			<Stack gap={ 0 }>
				<Group className="settings-site-row" wrap="nowrap" gap="var(--tocus-space-3)">
					<Avatar className="tocus-native-avatar" src={ props.favicon }
						size="2.25rem" radius="var(--tocus-radius-small)" aria-hidden="true">
						<span className="settings-site-monogram">{ identity.monogram }</span>
					</Avatar>
					<div className="settings-site-identity">
						<h2>{ identity.name }</h2>
						<p>{ site.rule.host }</p>
						{ details.schedule !== null && <p className="settings-site-schedule"><Icon name={ IconName.CALENDAR } />{ summary }</p> }
					</div>
					<Group className="settings-site-actions" wrap="nowrap" gap="var(--tocus-space-1)">
						<Tooltip label={ copy.removeSite }
							events={ { hover: true, focus: true, touch: true } } withArrow>
							<ActionIcon className="settings-site-remove" variant="subtle" aria-label={ copy.removeSite }
								disabled={ disabled } onClick={ props.onRemove }>
								<Icon name={ IconName.TRASH } />
							</ActionIcon>
						</Tooltip>
						<Tooltip label={ copy.edit } events={ { hover: true, focus: true, touch: true } } withArrow>
							<ActionIcon className="settings-site-manage" variant="subtle" aria-label={ copy.edit }
								disabled={ disabled } onClick={ props.onEdit }>
								<Icon name={ IconName.SLIDERS } />
							</ActionIcon>
						</Tooltip>
					</Group>
				</Group>
				{ props.confirmation }
				{ props.accessRequired && <Alert role="status" color="yellow" className="settings-site-access tocus-alert-actionable"
					icon={ <Icon name={ IconName.CIRCLE_EXCLAMATION } /> }>
					<div className="tocus-alert-layout">
						<div className="tocus-alert-copy">{ copy.accessRequired }</div>
						<Group className="tocus-alert-actions">
							<Button className="tocus-native-button" variant="outline" disabled={ props.accessDisabled } onClick={ props.onGrant }>
								{ props.accessPending ? copy.allowingAccess : copy.allowAccess }
							</Button>
						</Group>
					</div>
				</Alert> }
				{ props.editing && <form className="settings-site-editor" onSubmit={ submitEditor }>
					<WebsiteDetails idPrefix={ `site-${ site.identityHost }` } copy={ copy } scheduleCopy={ props.scheduleCopy }
						value={ details } disabled={ disabled } validate={ validate || props.validate === true }
						showName onChange={ props.onChange } />
					{ error && <Feedback nativeError
						error={ error === ProtectedSiteItemOperationErrorReason.CONFIGURATION_CHANGED
							? copy.configurationChangedError : copy.operationError } />
					}
					<Group className="tocus-form-actions settings-site-editor-footer" justify="flex-end" gap="var(--tocus-space-2)">
						{ props.persistedEditing && <Button className="tocus-native-button" variant="outline" disabled={ disabled }
							onClick={ props.persistedEditing.cancel }>{ copy.cancel }</Button> }
						<Button className="tocus-native-button" type="submit" disabled={ disabled }>
							{ props.persistedEditing ? copy.saveChanges : copy.done }
						</Button>
					</Group>
				</form> }
			</Stack>
		</li>
	);
}
