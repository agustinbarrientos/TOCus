import { PopupCurrentSiteStatus } from '../../types/popup-projection';
import { useEffect, useState } from 'react';
import { Alert, Avatar, Button, Group, Stack, Text, Title } from '@tocus/ui';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import { PopupOperationError } from '../shell/types';
import {
	getPopupCurrentScope,
	getPopupOperationMessage,
	getPopupRemainingTime,
	getPopupSiteIdentityInput,
	getPopupSiteStatus,
} from '../../utils/popup-presentation';
import type { PopupCurrentSiteProperties } from './types';

/**
 * Presents one current website and forwards enrollment to the controller-owned flow.
 * @param properties - Validated site, local favicon, localized copy, and synchronous enrollment action.
 * @return Current-site identity, status, optional timer, and enrollment or management action.
 * @since 0.1.0
 */
export function PopupCurrentSite( properties: PopupCurrentSiteProperties ) {
	const { state, copy, current, scopes, onAddSite } = properties;
	const [ failedFavicon, setFailedFavicon ] = useState( false );
	const site = getPopupSiteIdentityInput( current );
	const identity = resolveSiteDisplayIdentity( site );
	const scope = getPopupCurrentScope( current, scopes );
	const status = getPopupSiteStatus( current, scope, copy );
	const remaining = getPopupRemainingTime( scope, state.nowEpochMilliseconds );

	useEffect( () => {
		setFailedFavicon( false );
	}, [ state.faviconSource, state.projection ] );

	/**
	 * Replaces an unavailable cached favicon with the site's deterministic local monogram.
	 * @since 0.1.0
	 */
	function handleFaviconError(): void {
		setFailedFavicon( true );
	}

	return (
		<Stack gap={ 0 } className="popup-website-card" aria-busy={ state.adding }>
			<Text className="popup-eyebrow">{ copy.currentWebsite }</Text>
			<Group className="popup-site-overview" wrap="nowrap" align="center" gap="var(--tocus-space-3)">
				<Avatar
					className="popup-site-mark"
					classNames={ { placeholder: 'popup-site-placeholder' } }
					size={ 44 }
					radius="md"
					src={ failedFavicon ? null : state.faviconSource }
					imageProps={ { alt: '', onError: handleFaviconError } }
					aria-hidden="true"
				>
					{ identity.monogram }
				</Avatar>
				<div className="popup-identity">
					<Title className="popup-site-name" order={ 1 }>{ identity.name }</Title>
					<Text className="popup-site-host">{ site.identityHost }</Text>
				</div>
			</Group>
			{ status !== null && <Text className="popup-site-status">{ status }</Text> }
			{ remaining !== null && (
				<section className="popup-time" aria-label={ copy.timeLeft }>
					<Text className="popup-time-label">{ copy.timeLeft }</Text>
					<Text component="strong" className="popup-countdown">{ copy.formatCountdown( remaining ) }</Text>
				</section>
			) }
			{ current.status === PopupCurrentSiteStatus.UNPROTECTED ? (
				<Button
					className="primary-action"
					fullWidth
					loading={ state.adding }
					disabled={ state.adding }
					onClick={ onAddSite }
				>
					{ state.adding ? copy.addingPause : copy.pauseSite }
				</Button>
			) : (
				<Button
					component="a"
					className="manage-action"
					href={ state.settingsPageUrl }
					target="_blank"
					rel="noopener noreferrer"
					variant="outline"
					px="var(--tocus-space-4)"
					fullWidth
				>
					{ copy.manageWebsite }
				</Button>
			) }
			{ state.operationError !== null && (
				<Alert color={ state.operationError === PopupOperationError.PERMISSION_RETAINED ? 'yellow' : 'red' } role="alert">
					{ getPopupOperationMessage( state.operationError, copy ) }
				</Alert>
			) }
		</Stack>
	);
}

export * from './types';
