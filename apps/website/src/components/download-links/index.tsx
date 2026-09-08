import { useSyncExternalStore } from 'react';
import { Button, Icon, IconName } from '@tocus/ui';
import { detectDownloadBrowser, DownloadStores, getDownloadStore, WebsiteBrowser } from '../../config/downloads';
import { ExternalLink } from '../site-links';
import type { DownloadLinkProps, DownloadLinksProps } from './types';
import './style.scss';

/**
 * The user agent is constant during the lifetime of this page.
 * @return Inert cleanup; there are no browser identity events to unsubscribe.
 */
const subscribe = () => () => undefined;

/**
 * Reads browser identity locally without storage or network requests.
 * @return Current browser store identifier.
 */
const getBrowserSnapshot = () => detectDownloadBrowser( navigator.userAgent );

/**
 * Keeps static markup and the first hydration render identical.
 * @return Static browser store fallback.
 */
const getServerSnapshot = () => WebsiteBrowser.CHROME;

/**
 * Resolves the browser after hydration while preserving usable static links.
 * @return Configured store for the current browser.
 */
function useDownloadStore() {
	return getDownloadStore( useSyncExternalStore( subscribe, getBrowserSnapshot, getServerSnapshot ) );
}

/**
 * Shared compact download action for page headers.
 * @param props - Localized download label.
 * @return Direct link to the selected browser store.
 * @since 0.1.0
 */
export function DownloadLink( props: DownloadLinkProps ) {
	const store = useDownloadStore();
	return <ExternalLink href={ store.href } data-download-primary data-store={ store.browser }>
		{ props.label }
	</ExternalLink>;
}

/**
 * Shows one browser badge followed by plain links for the other browser stores.
 * @param props - Localized download and alternate-store labels.
 * @return Primary store artwork and text alternatives.
 * @since 0.1.0
 */
export function DownloadLinks( props: DownloadLinksProps ) {
	const store = useDownloadStore();
	return <div className="store-links" aria-label={ props.label }>
		<Button component="a" href={ store.href } target="_blank" rel="noopener noreferrer"
			className="store-primary" data-download-primary data-store={ store.browser }
			leftSection={ <img src={ `/badges/browser-${ store.browser }.svg` } alt="" width="36" height="36" /> }
			rightSection={ <Icon name={ IconName.ARROW_UP_RIGHT_FROM_SQUARE } /> }>
			{ props.label } { store.name }
		</Button>
		<p className="store-alternatives">
			<span>{ props.alsoAvailable }</span>{ ' ' }
			{ Object.values( DownloadStores ).filter( ( alternative ) => alternative.browser !== store.browser )
				.map( ( alternative, index ) => <span key={ alternative.browser }>
					{ index > 0 && <span aria-hidden="true"> · </span> }
					<ExternalLink href={ alternative.href } data-store={ alternative.browser }>
						{ alternative.name }
					</ExternalLink>
				</span> ) }
		</p>
	</div>;
}
