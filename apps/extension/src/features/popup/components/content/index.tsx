import { PopupProjectionStatus, PopupCurrentSiteStatus } from '../../types/popup-projection';
import { Button, Icon, IconName, Stack, Text, Title } from '@tocus/ui';
import { PopupCurrentSite } from '../current-site';
import type { PopupContentProperties, PopupRetryProperties } from './types';

/**
 * Keeps recovery labels and disabled/loading behavior identical across unavailable states.
 * @param properties - Localized recovery labels, pending state, and controller action.
 * @return Accessible packaged retry action.
 * @since 0.1.0
 */
function PopupRetryAction( properties: PopupRetryProperties ) {
	const { copy, retrying, onRetry } = properties;

	return (
		<Button className="retry-action primary-action" loading={ retrying } disabled={ retrying } onClick={ onRetry }>
			{ retrying ? copy.retrying : copy.retry }
		</Button>
	);
}

/**
 * Selects the runtime-recovery, current-site, or unsupported-page presentation.
 * @param properties - Loaded authoritative projection, copy, and controller actions.
 * @return One complete popup content state with a stable focus-recovery target.
 * @since 0.1.0
 */
export function PopupContent( properties: PopupContentProperties ) {
	const { state, copy, projection, onAddSite, onRetry } = properties;
	const retryAction = <PopupRetryAction copy={ copy } retrying={ state.retrying } onRetry={ onRetry } />;

	if ( projection.status === PopupProjectionStatus.UNAVAILABLE ) {
		return (
			<section className="popup-unavailable">
				<div className="popup-unavailable-mark"><Icon name={ IconName.CAPYBARA } /></div>
				<Title order={ 1 }>{ copy.unavailableTitle }</Title>
				<Text>{ copy.unavailableDescription }</Text>
				{ retryAction }
			</section>
		);
	}

	const current = projection.currentSite;
	if ( current.status === PopupCurrentSiteStatus.PROTECTED ||
		current.status === PopupCurrentSiteStatus.UNPROTECTED ) {
		return (
			<PopupCurrentSite
				state={ state }
				copy={ copy }
				current={ current }
				scopes={ projection.activeScopes }
				onAddSite={ onAddSite }
			/>
		);
	}

	const unsupported = current.status === PopupCurrentSiteStatus.UNSUPPORTED;
	return (
		<Stack>
			<Text className="neutral-message" tabIndex={ -1 }>
				{ unsupported ? copy.unsupportedPage : copy.currentWebsiteUnavailable }
			</Text>
			{ ! unsupported && retryAction }
		</Stack>
	);
}

export * from './types';
