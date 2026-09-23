import type { ReactNode } from 'react';

/**
 * Supported appearance preference.
 * @since 1.0.0
 */
export const TocusAppearance = {
	LIGHT: 'light',
	DARK: 'dark',
	SYSTEM: 'system',
} as const;

/**
 * Supported appearance inferred from its runtime catalog.
 * @since 1.0.0
 */
export type TocusAppearance = ( typeof TocusAppearance )[ keyof typeof TocusAppearance ];
/**
 * Existing brand palettes.
 * @since 1.0.0
 */
export const TocusPalette = {
	BROWN: 'brown',
	GREEN: 'green',
	BLUE: 'blue',
	PURPLE: 'purple',
	PINK: 'pink',
	ORANGE: 'orange',
} as const;

/**
 * Brand palette inferred from its runtime catalog.
 * @since 1.0.0
 */
export type TocusPalette = ( typeof TocusPalette )[ keyof typeof TocusPalette ];

/**
 * Resolved appearance excludes the system preference.
 * @since 1.0.0
 */
export type TocusColorScheme = Exclude<TocusAppearance, typeof TocusAppearance.SYSTEM>;
/**
 * Provider ownership and appearance contract.
 * @since 1.0.0
 */
export interface TocusProviderProps {
	children: ReactNode;
	appearance?: TocusAppearance;
	palette?: TocusPalette;
	compact?: boolean;
	/** Leaves component boundaries unpainted while preserving scoped tokens and control surfaces. */
	transparent?: boolean;
	reducedMotion?: boolean;
	root?: HTMLElement;
	portalTarget?: HTMLElement;
	scale?: number;
	/** Adopts generated variables and isolates owned rem lengths against a fixed 16px root baseline. */
	shadowRoot?: ShadowRoot;
}
