import { useEffect, useState } from 'react';
import { Palette, PaletteSchema, ThemeMode, ThemeModeSchema } from '../../../../domains/preferences/types';

/**
 * Reads the preference controller's extension-owned document projection.
 * @return Validated appearance values with safe first-render defaults.
 */
function readAppearance() {
	const root = document.documentElement;
	const appearance = ThemeModeSchema.safeParse( root.getAttribute( 'data-tocus-theme' ) );
	const palette = PaletteSchema.safeParse( root.getAttribute( 'data-tocus-palette' ) );
	return {
		appearance: appearance.success ? appearance.data : ThemeMode.SYSTEM,
		palette: palette.success ? palette.data : Palette.BROWN,
		reducedMotion: root.getAttribute( 'data-tocus-reduced-motion' ) === 'true',
	};
}

/**
 * Observes extension-owned appearance without maintaining another preference store.
 * @remarks Injected UI must use its owned root instead of this document-level hook.
 * @return The current effective document appearance.
 * @since 0.1.0
 */
export function useDocumentAppearance() {
	const [ appearance, setAppearance ] = useState( readAppearance );
	useEffect( () => {
		const observer = new MutationObserver( () => {
			setAppearance( readAppearance() );
		} );
		observer.observe( document.documentElement, {
			attributes: true,
			attributeFilter: [ 'data-tocus-theme', 'data-tocus-palette', 'data-tocus-reduced-motion' ],
		} );
		setAppearance( readAppearance() );
		return () => {
			observer.disconnect();
		};
	}, [] );
	return appearance;
}
