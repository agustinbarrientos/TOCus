import { MantineProvider, type MantineColorSchemeManager } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useId, useMemo, useRef } from 'react';
import { useOwnedAttributes, useOwnedPortal } from './ownership';
import { tocusTheme, tocusCssVariables } from './theme';
import { ShadowVariables } from './shadow-variables';
import { TocusAppearance, TocusPalette, type TocusProviderProps } from './types';

/** Preferences belong to the consuming app, never to website localStorage. */
const memoryManager: MantineColorSchemeManager = {
	/**
	 * Returns the app-provided preference without reading storage.
	 * @param fallback - Controlled provider fallback.
	 * @return The unchanged fallback.
	 */
	get: ( fallback ) => fallback,
	/**
	 * App owns preference writes.
	 * @return Nothing.
	 */
	set: () => undefined,
	/**
	 * App owns preference subscriptions.
	 * @return Nothing.
	 */
	subscribe: () => undefined,
	/**
	 * No storage subscription needs cleanup.
	 * @return Nothing.
	 */
	unsubscribe: () => undefined,
	/**
	 * No storage entry belongs to the provider.
	 * @return Nothing.
	 */
	clear: () => undefined,
};

/**
 * Owns palette, sizing, generated styles and portal placement for one React tree.
 * @since 0.1.0
 * @param root0 - Appearance and ownership configuration.
 * @param root0.children - One shared React tree.
 * @param root0.appearance - App-managed color preference.
 * @param root0.palette - Existing brand palette.
 * @param root0.compact - Uses popup sizing.
 * @param root0.transparent - Leaves the provider boundary unpainted for embedding into an existing surface.
 * @param root0.reducedMotion - Optional app override of system motion preference.
 * @param root0.root - Owned injected root; attributes restore on cleanup.
 * @param root0.portalTarget - Owned target for portals.
 * @param root0.scale - Mantine scale override relative to the consumer's sizing baseline.
 * @param root0.shadowRoot - Optional injected root for CSP-safe, host-independent generated variables.
 * @return Scoped, themed children.
 */
export function TocusProvider( {
	children, appearance = TocusAppearance.SYSTEM, palette = TocusPalette.BROWN, compact = false,
	reducedMotion, root, portalTarget, scale, shadowRoot, transparent = false,
}: TocusProviderProps ) {
	const id = useId().replace( /[^a-zA-Z0-9_-]/g, '' );
	const owned = useRef<HTMLDivElement>( null );
	const prefersDark = useMediaQuery( '(prefers-color-scheme: dark)', false );
	const prefersReducedMotion = useMediaQuery( '(prefers-reduced-motion: reduce)', false );
	const scheme = appearance === TocusAppearance.SYSTEM
		? ( prefersDark ? TocusAppearance.DARK : TocusAppearance.LIGHT ) : appearance;
	const motion = reducedMotion ?? prefersReducedMotion;
	const selector = `[data-tocus-ui="${ id }"]`;
	const portalMount = useOwnedPortal( portalTarget ?? root, scheme );
	const attributes = useMemo( () => ( {
		'data-tocus-ui': id,
		'data-tocus-theme': scheme,
		'data-tocus-palette': palette,
		'data-mantine-color-scheme': scheme,
		'data-tocus-reduced-motion': String( motion ),
		'data-tocus-transparent': String( transparent ),
	} ), [ id, scheme, palette, motion, transparent ] );
	useOwnedAttributes( root, attributes );
	useOwnedAttributes( portalTarget === root ? undefined : portalTarget, attributes );
	const theme = useMemo( () => ( {
		...tocusTheme,
		scale: scale ?? ( compact ? 1 : 1.15 ),
		components: {
			...tocusTheme.components,
			Portal: { defaultProps: { target: portalMount ?? `${ selector } > .tocus-provider-content` } },
			Modal: {
				...tocusTheme.components?.Modal,
				defaultProps: { transitionProps: { duration: motion ? 0 : 160 } },
			},
		},
	} ), [ compact, motion, portalMount, scale, selector ] );
	return <div ref={owned} data-tocus-ui={id} data-tocus-theme={scheme} data-tocus-palette={palette}
		data-mantine-color-scheme={scheme} data-tocus-reduced-motion={motion} data-tocus-compact={compact}
		data-tocus-transparent={transparent}>
		<MantineProvider theme={theme} forceColorScheme={scheme} colorSchemeManager={memoryManager}
			getRootElement={() => owned.current ?? undefined} cssVariablesSelector={selector}
			cssVariablesResolver={tocusCssVariables} deduplicateCssVariables={false} withGlobalClasses={false}
			withCssVariables={shadowRoot === undefined}>
			{shadowRoot !== undefined && <ShadowVariables root={shadowRoot} selector={selector} />}
			<div className="tocus-provider-content" data-mantine-color-scheme={scheme}>{children}</div>
		</MantineProvider>
	</div>;
}
