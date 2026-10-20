import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { useEffect, useState } from 'react';
import {
	Avatar,
	Alert,
	ActionIcon,
	Button,
	Checkbox,
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
	WebsiteFaviconResolution,
} from './types';
import './style.scss';
import { ProtectedSiteItemOperationErrorReason } from './types';
import { createWebsiteDetails } from '../../utils/website-draft';


/**
 * Presents a website identity, its active hours, and accessible editing or access-recovery actions.
 * @param props - Controlled website values, current access and explicit row actions.
 * @return Website identity, denied-access recovery and optional draft editor.
 * @since 1.0.0
 */
export function WebsiteItem( props: WebsiteItemProps ) {
	const { site, copy, disabled } = props;
	const rootPeer = props.presentation?.rootPeer ?? false;
	const faviconProvider = props.presentation?.exception || rootPeer ? null : props.faviconProvider;
	const faviconHost = props.presentation?.groupHost ?? site.identityHost;
	const [ resolvedFavicon, setResolvedFavicon ] = useState<WebsiteFaviconResolution | null>( null );
	useEffect( () => {
		if ( faviconProvider?.resolveSource === undefined ) {
			return;
		}
		let active = true;
		void Promise.resolve().then( () => faviconProvider.resolveSource?.( faviconHost ) ?? null )
			.catch( () => null ).then( ( source ) => {
				if ( active ) {
					setResolvedFavicon( { host: faviconHost, provider: faviconProvider, source } );
				}
			} );
		return () => {
			active = false;
		};
	}, [ faviconProvider, faviconHost ] );
	const favicon = faviconProvider?.resolveSource === undefined ? props.favicon :
		resolvedFavicon?.host === faviconHost && resolvedFavicon.provider === faviconProvider
			? resolvedFavicon.source : null;
	const presentationOnly = props.presentation?.presentationOnly ?? false;
	const displaySite = presentationOnly ? { identityHost: faviconHost,
		rule: { ...site.rule, host: faviconHost }, displayNameOverride: undefined } : site;
	const details = props.persistedEditing?.state.details ?? props.details ?? createWebsiteDetails( site );
	const identity = resolveSiteDisplayIdentity( { ...displaySite,
		displayNameOverride: presentationOnly ? undefined : details.displayName.trim() || undefined } );
	const automaticIdentity = resolveSiteDisplayIdentity( { ...site, displayNameOverride: undefined } );
	const exception = props.presentation?.exception ?? false;
	const address = `${ site.rule.host }${ site.rule.pathPrefix ?? '' }`;
	const editLabel = exception ? copy.exceptionEdit : copy.edit;
	const coverageLabel = props.presentation?.rootPeers
		? site.rule.includeSubdomains ? copy.includingSubdomains : copy.thisDomainOnly : null;
	const error = props.persistedEditing?.state.error;
	return (
		<li ref={ props.itemRef } className={ `settings-site-item${ exception ? ' settings-site-exception' : '' }${ rootPeer ? ' settings-site-root-peer' : '' }` }
			data-root-coverage={ props.presentation?.rootPeers ? site.rule.includeSubdomains ? 'broad' : 'exact' : undefined }
			data-highlighted={ props.highlighted || undefined }
			data-selectable={ props.selection !== undefined || undefined }
			data-selection-active={ props.selection?.active || undefined }>
			{ props.selection && <Checkbox.Card className="settings-site-select" withBorder={ false }
				aria-label={ copy.formatSelectSite( exception ? address : rootPeer
					? `${ identity.name } (${ coverageLabel ?? copy.thisDomainOnly })` : identity.name ) }
				checked={ props.selection.checked }
				onChange={ props.selection.onChange } disabled={ disabled }>
				<Checkbox.Indicator size="sm" disabled={ disabled } aria-hidden="true" />
			</Checkbox.Card> }
			<Stack gap={ 0 }>
				<Group className="settings-site-row" wrap="nowrap" gap="var(--tocus-space-3)">
					{ rootPeer ? <span className="settings-site-root-indent" aria-hidden="true" /> : exception ? <Icon className="settings-site-exception-arrow" name={ IconName.ARROW_TURN_DOWN_RIGHT } /> : <Avatar className="tocus-native-avatar" src={ favicon }
						size="2.25rem" radius="var(--tocus-radius-small)" aria-hidden="true">
						<span className="settings-site-monogram">{ identity.monogram }</span>
					</Avatar> }
					<div className="settings-site-identity">
						{ ! exception && ! rootPeer && <h2>{ identity.name }</h2> }
						{ rootPeer && details.displayName.trim() && <p className="settings-site-root-name">{ details.displayName }</p> }
						<p>{ presentationOnly ? faviconHost : address }{ coverageLabel && ` (${ coverageLabel })` }</p>
						{ ! presentationOnly && <div className="settings-site-tags">
							{ details.schedule !== null && <span className="settings-site-schedule"><Icon name={ IconName.CALENDAR } />{ copy.customScheduleTag }</span> }
							{ details.timingConfiguration !== null && details.behavior !== 'allow' && <span><Icon name={ IconName.PAUSE } />{ copy.customTimingTag }</span> }
							{ details.behavior === 'allow' && <span><Icon name={ IconName.CHEVRONS_RIGHT } />{ copy.noPauseLabel }</span> }
						</div> }
					</div>
					<Group className="settings-site-actions" wrap="nowrap" gap="var(--tocus-space-1)">
						<Tooltip label={ copy.removeSite }
							events={ { hover: true, focus: true, touch: true } } withArrow>
							<ActionIcon className="settings-site-remove" color="red" variant="subtle" aria-label={ copy.removeSite }
								disabled={ disabled } onClick={ props.onRemove }>
								<Icon name={ IconName.TRASH } />
							</ActionIcon>
						</Tooltip>
						{ ! presentationOnly && <Tooltip label={ editLabel }
							events={ { hover: true, focus: true, touch: true } } withArrow>
							<ActionIcon className="settings-site-manage" variant="subtle" aria-label={ editLabel }
								disabled={ disabled } onClick={ props.onEdit }>
								<Icon name={ IconName.SLIDERS } />
							</ActionIcon>
						</Tooltip> }
					</Group>
				</Group>
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
				<WebsiteEditor opened={ props.editing } idPrefix={ `site-${ getProtectedSiteRuleKey( site.rule ) }` } name={ exception ? address : identity.name }
					exception={ exception } timingCopy={ props.timingCopy } inheritedTiming={ props.inheritedTiming }
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
