/**
 * Supplied icon shapes, independent of application destinations or feedback meaning.
 * @since 0.1.0
 */
export const IconName = {
	CAPYBARA: 'capybara',
	HEART: 'heart',
	BRUSH: 'brush',
	ARROW_UP_RIGHT_FROM_SQUARE: 'arrow-up-right-from-square',
	LANGUAGE: 'language',
	SHIELD_HALVED: 'shield-halved',
	USER_LOCK: 'user-lock',
	CALENDAR: 'calendar',
	SLIDERS: 'sliders',
	LINK_HORIZONTAL: 'link-horizontal',
	CHART_COLUMN: 'chart-column',
	PAUSE: 'pause',
	CIRCLE_CHECK: 'circle-check',
	ANGLE_DOWN: 'angle-down',
	ANGLE_UP: 'angle-up',
	SPINNER_THIRD: 'spinner-third',
	CIRCLE_EXCLAMATION: 'circle-exclamation',
	CIRCLE_INFO: 'circle-info',
	CIRCLE_QUESTION: 'circle-question',
	TRASH: 'trash',
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
