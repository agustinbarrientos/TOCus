import { useEffect, useRef } from 'react';
import { ComponentInterruptionScreen, InterruptionScreenMode } from '../screen';
import type { PausePreviewProps } from './types';
import './style.scss';

/**
 * Embeds the production pause in decorative browser chrome without session or storage work.
 * @remarks Browser chrome follows the OS while the scene follows optional draft choices.
 * @param props - Localized copy, motion preference and optional personalization draft.
 * @return An inert browser preview positioned by its owning screen.
 * @since 1.1.0
 */
export function PausePreview( props: PausePreviewProps ) {
	const { copy, preferences, reducedMotion } = props;
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
		if ( screen.current ) {
			if ( copy ) {
				screen.current.copy = copy;
			}
			screen.current.mode = preferences?.pauseMode ?? InterruptionScreenMode.BREATHING;
			screen.current.focusLinks = preferences?.focusLinks ?? [];
			screen.current.reducedMotion = reducedMotion;
		}
	}, [ copy, preferences, reducedMotion ] );
	return <figure className={ `pause-preview ${ props.className }` } data-tocus-theme={ preferences?.theme }
		data-tocus-palette={ preferences?.palette }>
		<figcaption>{ props.title }</figcaption>
		<div className="pause-preview-browser" aria-hidden="true" inert>
			<div className="pause-preview-chrome">
				<div className="pause-preview-tab-strip">
					<span className="pause-preview-window-controls" />
					<span className="pause-preview-tab">
						<span className="pause-preview-tab-icon" />
						<span className="pause-preview-tab-label" />
					</span>
				</div>
				<div className="pause-preview-toolbar">
					<span className="pause-preview-navigation" />
					<span className="pause-preview-address">
						<span className="pause-preview-address-placeholder" />
						<span className="pause-preview-address-placeholder pause-preview-address-placeholder-short" />
					</span>
					<span className="pause-preview-menu" />
				</div>
			</div>
			<div className="pause-preview-viewport">
				<div className="pause-preview-screen" ref={ container } />
			</div>
		</div>
	</figure>;
}
