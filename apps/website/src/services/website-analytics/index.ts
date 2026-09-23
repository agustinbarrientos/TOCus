import type { AnalyticsWindow } from './types';

const MeasurementId = 'G-RBHGLDECJ9';
let started = false;

/**
 * Starts website measurement once, keeping local development and previews out of reports.
 * @since 1.0.0
 */
export function startAnalytics(): void {
	if ( started || ! import.meta.env.PROD || window.location.origin !== 'https://tocus.uo.ar' ) {
		return;
	}
	started = true;
	const analyticsWindow: AnalyticsWindow = window;
	const queue = analyticsWindow.dataLayer ??= [];
	/** Queues commands using the Google tag's standard arguments-object format. */
	const gtag: NonNullable<AnalyticsWindow['gtag']> = function() {
		// eslint-disable-next-line prefer-rest-params -- Google expects an arguments object rather than an array.
		queue.push( arguments );
	};
	analyticsWindow.gtag = gtag;
	gtag( 'js', new Date() );
	gtag( 'config', MeasurementId, {
		allow_google_signals: false,
		allow_ad_personalization_signals: false,
		cookie_domain: 'none',
	} );
	const script = document.createElement( 'script' );
	script.async = true;
	script.dataset.websiteAnalytics = '';
	script.src = `https://www.googletagmanager.com/gtag/js?id=${ MeasurementId }`;
	document.head.append( script );
}
