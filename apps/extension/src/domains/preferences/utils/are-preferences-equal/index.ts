import { type PreferencesDocument } from '../../types';

/**
 * Determines whether two complete preference projections contain the same persisted values.
 * @param first - First complete preferences document.
 * @param second - Second complete preferences document.
 * @return Whether every persisted preference is equal.
 * @since 0.1.0 Initial implementation.
 */
export function arePreferencesEqual(
	first: Readonly<PreferencesDocument>,
	second: Readonly<PreferencesDocument>,
): boolean {
	return first.theme === second.theme &&
		first.palette === second.palette &&
		first.pauseMode === second.pauseMode &&
		first.reducedMotion === second.reducedMotion &&
		first.language === second.language;
}
