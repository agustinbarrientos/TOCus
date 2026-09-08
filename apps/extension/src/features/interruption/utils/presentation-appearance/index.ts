import { TocusAppearance, TocusPalette } from '@tocus/ui';
import type { PresentationAppearance } from './types';

/**
 * Collects appearance owners through DOM ancestors and closed shadow boundaries.
 * @param element - Extension-owned presentation element.
 * @return Nearest-first appearance owners.
 */
function appearanceOwners( element: Element ): Element[] {
	const owners: Element[] = [];
	let current: Element | null = element;
	while ( current !== null ) {
		owners.push( current );
		const root = current.getRootNode();
		current = current.parentElement ?? ( root instanceof ShadowRoot ? root.host : null );
	}
	return owners;
}

/**
 * Reads controlled preferences without modifying the protected document.
 * @since 0.1.0
 * @param element - Extension-owned presentation element.
 * @return Validated appearance preferences.
 */
export function readPresentationAppearance( element: Element ): PresentationAppearance {
	const owners = appearanceOwners( element );
	const appearance = owners.map( ( owner ) => owner.getAttribute( 'data-tocus-theme' ) ).find( Boolean );
	const palette = owners.map( ( owner ) => owner.getAttribute( 'data-tocus-palette' ) ).find( Boolean );
	const appearances = Object.values( TocusAppearance );
	const palettes = Object.values( TocusPalette );
	return {
		appearance: appearances.find( ( candidate ) => candidate === appearance ) ?? TocusAppearance.SYSTEM,
		palette: palettes.find( ( candidate ) => candidate === palette ) ?? TocusPalette.BROWN,
	};
}

/**
 * Observes only attributes that affect extension appearance.
 * @since 0.1.0
 * @param element - Extension-owned presentation element.
 * @param onChange - Requests a fresh React projection after an appearance change.
 * @return Cleanup that releases every observed owner.
 */
export function observePresentationAppearance( element: Element, onChange: () => void ): () => void {
	const observer = new MutationObserver( onChange );
	for ( const owner of appearanceOwners( element ) ) {
		observer.observe( owner, { attributes: true, attributeFilter: [ 'data-tocus-theme', 'data-tocus-palette', 'style', 'class' ] } );
	}
	return () => {
		observer.disconnect();
	};
}
