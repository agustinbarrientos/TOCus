import { Anchor, Brand, Icon, IconName, TocusProvider } from '@tocus/ui';
import { useDocumentAppearance } from '../../../preferences/services/document-appearance';
import { PopupAddSiteRequestEventName, PopupRetryRequestEventName } from './types';
import { PopupContent } from '../content';
import type { PopupViewProperties } from './types';
import './styles.scss';

/**
 * Composes the compact popup and forwards direct gestures through its existing event port.
 * @param properties - Immutable controller state and live event boundary.
 * @return The themed popup, or null until copy and status are coherent.
 * @since 0.1.0
 */
export function PopupView( properties: PopupViewProperties ) {
	const { state, port } = properties;
	const appearance = useDocumentAppearance();
	const { copy, projection } = state;

	/**
	 * Starts the existing status-recovery flow without changing protection state locally.
	 * @since 0.1.0
	 */
	function handleRetry(): void {
		port.dispatchEvent( new Event( PopupRetryRequestEventName ) );
	}

	/**
	 * Preserves user activation and checks live enrollment state before sending another request.
	 * @since 0.1.0
	 */
	function handleAddSite(): void {
		if ( ! port.adding ) {
			port.dispatchEvent( new Event( PopupAddSiteRequestEventName ) );
		}
	}

	if ( copy === null || projection === null ) {
		return null;
	}

	return (
		<TocusProvider { ...appearance } compact>
			<main className="popup-view" aria-label="TOCus">
				<header className="popup-header"><Brand /></header>
				<div className="popup-content">
					<PopupContent
						state={ state }
						copy={ copy }
						projection={ projection }
						onAddSite={ handleAddSite }
						onRetry={ handleRetry }
					/>
				</div>
				<footer className="popup-footer">
					<Anchor
						href={ state.statisticsPageUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="tocus-navigation-link"
					>
						<Icon name={ IconName.CHART_COLUMN } />{ copy.statistics }
					</Anchor>
					<Anchor
						href={ state.settingsPageUrl }
						target="_blank"
						rel="noopener noreferrer"
						className="tocus-navigation-link"
					>
						<Icon name={ IconName.GEAR } />{ copy.settings }
					</Anchor>
				</footer>
			</main>
		</TocusProvider>
	);
}

export * from './types';
