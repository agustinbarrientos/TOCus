/**
 * Explicit website-only measurement choices stored on this origin.
 * @since 1.0.0
 */
export const AnalyticsChoice = { ACCEPTED: 'accepted', REJECTED: 'rejected' } as const;

/**
 * One saved website analytics preference.
 * @since 1.0.0
 */
export type AnalyticsChoice = typeof AnalyticsChoice[keyof typeof AnalyticsChoice];

/**
 * Google tag command queue, owned exclusively by the public website.
 * @since 1.0.0
 */
export interface AnalyticsWindow extends Window {
	dataLayer?: IArguments[];
	gtag?: ( ...parameters: unknown[] ) => void;
	'ga-disable-G-RBHGLDECJ9'?: boolean;
}
