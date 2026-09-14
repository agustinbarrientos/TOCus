import angleDown from '@tocus/theme/icons/angle-down.svg?raw';
import angleUp from '@tocus/theme/icons/angle-up.svg?raw';
import spinnerThird from '@tocus/theme/icons/spinner-third.svg?raw';
import heart from '@tocus/theme/icons/heart.svg?raw';
import brush from '@tocus/theme/icons/brush.svg?raw';
import arrowUpRightFromSquare from '@tocus/theme/icons/arrow-up-right-from-square.svg?raw';
import language from '@tocus/theme/icons/language.svg?raw';
import shieldHalved from '@tocus/theme/icons/shield-halved.svg?raw';
import userLock from '@tocus/theme/icons/user-lock.svg?raw';
import calendar from '@tocus/theme/icons/calendar.svg?raw';
import sliders from '@tocus/theme/icons/sliders.svg?raw';
import linkHorizontal from '@tocus/theme/icons/link-horizontal.svg?raw';
import chartColumn from '@tocus/theme/icons/chart-column.svg?raw';
import pause from '@tocus/theme/icons/pause.svg?raw';
import brand from '@tocus/theme/icon.svg?raw';
import circleCheck from '@tocus/theme/icons/circle-check.svg?raw';
import circleExclamation from '@tocus/theme/icons/circle-exclamation.svg?raw';
import circleInfo from '@tocus/theme/icons/circle-info.svg?raw';
import trash from '@tocus/theme/icons/trash.svg?raw';
import { BrandSize, IconName, type BrandProps, type IconProps } from './types';

/** Complete trusted artwork registry keyed by the public shape catalog. */
const icons = {
	[ IconName.CAPYBARA ]: brand,
	[ IconName.ANGLE_DOWN ]: angleDown,
	[ IconName.ANGLE_UP ]: angleUp,
	[ IconName.SPINNER_THIRD ]: spinnerThird,
	[ IconName.HEART ]: heart,
	[ IconName.BRUSH ]: brush,
	[ IconName.ARROW_UP_RIGHT_FROM_SQUARE ]: arrowUpRightFromSquare,
	[ IconName.LANGUAGE ]: language,
	[ IconName.SHIELD_HALVED ]: shieldHalved,
	[ IconName.USER_LOCK ]: userLock,
	[ IconName.CALENDAR ]: calendar,
	[ IconName.SLIDERS ]: sliders,
	[ IconName.LINK_HORIZONTAL ]: linkHorizontal,
	[ IconName.CHART_COLUMN ]: chartColumn,
	[ IconName.PAUSE ]: pause,
	[ IconName.CIRCLE_CHECK ]: circleCheck,
	[ IconName.CIRCLE_EXCLAMATION ]: circleExclamation,
	[ IconName.CIRCLE_INFO ]: circleInfo,
	[ IconName.TRASH ]: trash,
} satisfies Record<IconName, string>;

/**
 * Renders only trusted repository SVG assets as decorative section icons.
 * @since 0.1.0
 * @param root0 - Icon presentation.
 * @param root0.name - Supplied asset name.
 * @param root0.className - Optional composition class.
 * @return Decorative SVG with inherited foreground color.
 */
export function Icon( { name, className = '' }: IconProps ) {
	return <span aria-hidden="true" className={`tocus-icon ${ className }`} dangerouslySetInnerHTML={{ __html: icons[ name ] }} />;
}

/**
 * Supplied local mascot with the accessible TOCus wordmark.
 * @since 0.1.0
 * @param root0 - Brand presentation.
 * @param root0.className - Optional composition class.
 * @param root0.size - Established wordmark scale for the surrounding surface.
 * @return Local brand icon and text.
 */
export function Brand( { className = '', size = BrandSize.STANDARD }: BrandProps ) {
	return <span className={`tocus-brand ${ className }`} data-brand-size={ size }><span aria-hidden="true" className="tocus-brand-icon"
		dangerouslySetInnerHTML={{ __html: brand }} /><span>TOCus</span></span>;
}
