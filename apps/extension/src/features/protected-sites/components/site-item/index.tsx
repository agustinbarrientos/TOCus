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
	WebsiteEditor,
} from '../website-editor';
import type {
	WebsiteItemProps,
} from './types';
import './style.scss';
import { ProtectedSiteItemOperationErrorReason } from './types';
import { createWebsiteDetails } from '../../utils/website-draft';
import { fromSchedule } from '../../../settings/utils/schedule-draft';
import { ScheduleMode } from '../../../../domains/protection/types/protection-schedule';


/**
 * Presents a website identity, its active hours, and accessible editing or access-recovery actions.
 * @param props - Controlled website values, current access and explicit row actions.
 * @return Website identity, denied-access recovery and optional draft editor.
 * @since 0.1.0
 */
export function WebsiteItem( props: WebsiteItemProps ) {
	const { site, copy, disabled } = props;
	const details = props.persistedEditing?.state.details ?? props.details ?? createWebsiteDetails( site );
	const identity = resolveSiteDisplayIdentity( { ...site,
		displayNameOverride: details.displayName.trim() || undefined } );
	const automaticIdentity = resolveSiteDisplayIdentity( { ...site, displayNameOverride: undefined } );
	const activeSchedule = details.schedule ?? fromSchedule( props.globalSchedule );
	const summary = activeSchedule.mode === ScheduleMode.ALWAYS ? props.scheduleCopy.alwaysLabel
		: activeSchedule.windows.map( ( window ) =>
			`${ props.scheduleCopy.formatWeekday( window.weekday ) } ${ window.start } - ${ window.fullDay ? '24:00' : window.end }` ).join( ' / ' );
	const error = props.persistedEditing?.state.error;
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
						{ details.schedule !== null && <p className="settings-site-schedule"><Icon name={ IconName.CALENDAR } /><span>{ summary }</span></p> }
					</div>
					<Group className="settings-site-actions" wrap="nowrap" gap="var(--tocus-space-1)">
						<Tooltip label={ copy.removeSite }
							events={ { hover: true, focus: true, touch: true } } withArrow>
							<ActionIcon className="settings-site-remove" color="red" variant="subtle" aria-label={ copy.removeSite }
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
				<WebsiteEditor opened={ props.editing } idPrefix={ `site-${ site.identityHost }` } name={ identity.name }
					automaticName={ automaticIdentity.name }
					value={ details } copy={ copy } scheduleCopy={ props.scheduleCopy } disabled={ disabled }
					error={ error ? error === ProtectedSiteItemOperationErrorReason.CONFIGURATION_CHANGED
						? copy.configurationChangedError : copy.operationError : null }
					submitLabel={ props.persistedEditing ? copy.saveChanges : copy.done }
					onCancel={ props.persistedEditing?.cancel ?? props.onDone ?? props.onEdit }
					onSubmit={ ( nextDetails ) => {
						props.onChange( nextDetails );
						const submit = props.persistedEditing?.save ?? props.onDone ?? props.onEdit;
						submit();
					} } />
			</Stack>
		</li>
	);
}
