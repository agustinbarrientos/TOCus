import { useEffect, useMemo } from 'react';
import type { TocusColorScheme } from './types';

/**
 * Creates a portal mount inside the caller's container without using document.body.
 * A nested scheme element lets scoped Mantine descendant selectors match correctly.
 * @since 0.1.0
 * @param target - Optional caller-owned portal container.
 * @param scheme - Resolved light or dark appearance.
 * @return The provider-owned mount, removed during cleanup.
 */
export function useOwnedPortal( target: HTMLElement | undefined, scheme: TocusColorScheme ) {
	const mount = useMemo( () => target?.ownerDocument.createElement( 'div' ), [ target ] );
	useEffect( () => {
		if ( ! mount || ! target ) {
			return;
		}
		target.appendChild( mount );
		return () => {
			mount.remove();
		};
	}, [ mount, target ] );
	useEffect( () => {
		mount?.setAttribute( 'data-mantine-color-scheme', scheme );
	}, [ mount, scheme ] );
	return mount;
}

/**
 * Applies attributes only to explicitly supplied roots and restores previous values.
 * @since 0.1.0
 * @param target - Caller-owned element, never a default document root.
 * @param attributes - Stable provider attributes to apply for this render.
 */
export function useOwnedAttributes( target: HTMLElement | undefined, attributes: Readonly<Record<string, string>> ) {
	useEffect( () => {
		if ( ! target ) {
			return;
		}
		const previous = new Map<string, string | null>();
		for ( const [ name, value ] of Object.entries( attributes ) ) {
			previous.set( name, target.getAttribute( name ) );
			target.setAttribute( name, value );
		}
		return () => {
			for ( const [ name, value ] of previous ) {
				if ( value === null ) {
					target.removeAttribute( name );
				} else {
					target.setAttribute( name, value );
				}
			}
		};
	}, [ target, attributes ] );
}
