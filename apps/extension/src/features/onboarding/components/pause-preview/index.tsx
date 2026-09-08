import { useEffect, useRef } from 'react';
import { ComponentInterruptionScreen } from '../../../interruption/components/screen';
import type { PausePreviewProps } from '../../types/presentation';

/**
 * Embeds the production pause renderer without registering sessions or analytics.
 * @remarks The browser chrome follows the OS; the page follows the user's TOCus choices.
 * @param props - Current localized pause copy and motion preference.
 * @return A fixed bottom-left browser preview outside the onboarding content grid.
 * @since 0.1.0
 */
export function PausePreview( props: PausePreviewProps ) {
	const { state } = props;
	const container = useRef<HTMLDivElement>( null );
	const screen = useRef<ComponentInterruptionScreen | null>( null );
	useEffect( () => {
		const element = new ComponentInterruptionScreen();
		element.preview = true;
		element.progressing = true;
		element.continueShortcutEnabled = false;
		element.inert = true;
		screen.current = element;
		container.current?.append( element );
		return () => {
			element.remove();
			screen.current = null;
		};
	}, [] );
	useEffect( () => {
		if ( screen.current && state.interruptionCopy ) {
			screen.current.copy = state.interruptionCopy;
			screen.current.reducedMotion = state.reducedMotion;
		}
	}, [ state.interruptionCopy, state.reducedMotion ] );
	return (
		<figure className="onboarding-preview">
			<figcaption>{ state.copy?.appearance.previewTitle }</figcaption>
			<div className="onboarding-browser onboarding-preview-browser" aria-hidden="true">
				<div className="onboarding-preview-chrome">
					<div className="onboarding-preview-tab-strip">
						<span className="onboarding-preview-window-controls" />
						<span className="onboarding-preview-tab">
							<span className="onboarding-preview-tab-icon" />
							<span className="onboarding-preview-tab-label" />
						</span>
					</div>
					<div className="onboarding-preview-toolbar">
						<span className="onboarding-preview-navigation" />
						<span className="onboarding-preview-address">
							<span className="onboarding-preview-address-placeholder" />
							<span className="onboarding-preview-address-placeholder onboarding-preview-address-placeholder-short" />
						</span>
						<span className="onboarding-preview-menu" />
					</div>
				</div>
				<div className="onboarding-browser-page onboarding-preview-viewport" ref={ container } />
			</div>
		</figure>
	);
}
