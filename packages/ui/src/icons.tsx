import heart from '@tocus/theme/icons/heart.svg?raw';
import palette from '@tocus/theme/icons/palette.svg?raw';
import arrowUpRightFromSquare from '@tocus/theme/icons/arrow-up-right-from-square.svg?raw';
import letters from '@tocus/theme/icons/letters.svg?raw';
import shieldHalved from '@tocus/theme/icons/shield-halved.svg?raw';
import userLock from '@tocus/theme/icons/user-lock.svg?raw';
import calendarClock from '@tocus/theme/icons/calendar-clock.svg?raw';
import gear from '@tocus/theme/icons/gear.svg?raw';
import list from '@tocus/theme/icons/list.svg?raw';
import chartColumn from '@tocus/theme/icons/chart-column.svg?raw';
import stopwatch from '@tocus/theme/icons/stopwatch.svg?raw';
import brand from '@tocus/theme/icon.svg?raw';
import circleCheck from '@tocus/theme/icons/circle-check.svg?raw';
import exclamation from '@tocus/theme/icons/exclamation.svg?raw';
import { BrandSize, IconName, type BrandProps, type IconProps } from './types';

/** Complete trusted artwork registry keyed by the public shape catalog. */
const icons = {
	[ IconName.CAPYBARA ]: brand,
	[ IconName.HEART ]: heart,
	[ IconName.PALETTE ]: palette,
	[ IconName.ARROW_UP_RIGHT_FROM_SQUARE ]: arrowUpRightFromSquare,
	[ IconName.LETTERS ]: letters,
	[ IconName.SHIELD_HALVED ]: shieldHalved,
	[ IconName.USER_LOCK ]: userLock,
	[ IconName.CALENDAR_CLOCK ]: calendarClock,
	[ IconName.GEAR ]: gear,
	[ IconName.LIST ]: list,
	[ IconName.CHART_COLUMN ]: chartColumn,
	[ IconName.STOPWATCH ]: stopwatch,
	[ IconName.CIRCLE_CHECK ]: circleCheck,
	[ IconName.EXCLAMATION ]: exclamation,
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
