/**
 * Google tag command queue, owned exclusively by the public website.
 * @since 1.0.0
 */
export interface AnalyticsWindow extends Window {
	dataLayer?: IArguments[];
	gtag?: ( ...parameters: unknown[] ) => void;
}
