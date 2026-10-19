import { useEffect, useRef } from 'react';
import { ComponentInterruptionScreen } from '../../../interruption/components/screen';
import { useDocumentAppearance } from '../../../preferences/services/document-appearance';
import type { SettingsPausePreviewProps } from './types';
import './style.scss';

/**
 * Composes draft controls beside an inert, locally looping production pause renderer.
 * @param props - Current unsaved preferences, localized copy and editable form.
 * @return Responsive form and preview, without session or persistence dependencies.
 * @since 1.1.0
 */
export function SettingsPausePreview( props: SettingsPausePreviewProps ) {
	const { preferences, copy } = props;
	const { reducedMotion } = useDocumentAppearance();
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
			screen.current.copy = copy.screen;
			screen.current.mode = preferences.pauseMode;
			screen.current.focusLinks = preferences.focusLinks;
			screen.current.reducedMotion = reducedMotion;
		}
	}, [ copy.screen, preferences.pauseMode, preferences.focusLinks, reducedMotion ] );
	return <div className="settings-preview-container">
		<div className="settings-preview-layout">
			{ props.children }
			<figure className="settings-pause-preview" data-tocus-theme={ preferences.theme }
				data-tocus-palette={ preferences.palette }>
				<figcaption>{ copy.title }</figcaption>
				<div className="settings-pause-preview-viewport" ref={ container } aria-hidden="true" inert />
			</figure>
		</div>
	</div>;
}
