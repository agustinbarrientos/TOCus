import type { AriaRole, ReactNode } from 'react';
import type { AlertProps } from '@mantine/core';

/**
 * Text-only native notice composition; richer alerts keep Mantine's ordinary slots.
 * @since 0.1.0
 */
export interface NativeNoticeProps {
	message: string;
	icon: IconName;
	color?: AlertProps['color'];
	role?: AriaRole;
	className?: string;
}

/**
 * Supported appearance preference.
 * @since 0.1.0
 */
export const TocusAppearance = {
	LIGHT: 'light',
	DARK: 'dark',
	SYSTEM: 'system',
} as const;

/**
 * Supported appearance inferred from its runtime catalog.
 * @since 0.1.0
 */
export type TocusAppearance = ( typeof TocusAppearance )[ keyof typeof TocusAppearance ];
/**
 * Existing brand palettes.
 * @since 0.1.0
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
 * @since 0.1.0
 */
export type TocusPalette = ( typeof TocusPalette )[ keyof typeof TocusPalette ];

/**
 * Resolved appearance excludes the system preference.
 * @since 0.1.0
 */
export type TocusColorScheme = Exclude<TocusAppearance, typeof TocusAppearance.SYSTEM>;
/**
 * Provider ownership and appearance contract.
 * @since 0.1.0
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

/**
 * CSP-safe generated theme stylesheet ownership.
 * @since 0.1.0
 */
export interface ShadowVariablesProps {
	root: ShadowRoot;
	selector: string;
}
/**
 * Supplied icon shapes, independent of application destinations or feedback meaning.
 * @since 0.1.0
 */
export const IconName = {
	CAPYBARA: 'capybara',
	HEART: 'heart',
	PALETTE: 'palette',
	ARROW_UP_RIGHT_FROM_SQUARE: 'arrow-up-right-from-square',
	LETTERS: 'letters',
	SHIELD_HALVED: 'shield-halved',
	USER_LOCK: 'user-lock',
	CALENDAR_CLOCK: 'calendar-clock',
	GEAR: 'gear',
	LIST: 'list',
	CHART_COLUMN: 'chart-column',
	STOPWATCH: 'stopwatch',
	CIRCLE_CHECK: 'circle-check',
	EXCLAMATION: 'exclamation',
} as const;

/**
 * Icon shape inferred from the single runtime catalog.
 * @since 0.1.0
 */
export type IconName = ( typeof IconName )[ keyof typeof IconName ];
/**
 * Decorative icon presentation.
 * @since 0.1.0
 */
export interface IconProps {
	name: IconName;
	className?: string;
}
/**
 * Established wordmark scales shared by extension surfaces and miniature previews.
 * @since 0.1.0
 */
export const BrandSize = {
	STANDARD: 'standard',
	LARGE: 'large',
	HERO: 'hero',
	MINIATURE: 'miniature',
} as const;

/**
 * Wordmark scale inferred from the single runtime catalog.
 * @since 0.1.0
 */
export type BrandSize = ( typeof BrandSize )[ keyof typeof BrandSize ];

/**
 * Wordmark presentation.
 * @since 0.1.0
 */
export interface BrandProps {
	className?: string;
	size?: BrandSize;
}
