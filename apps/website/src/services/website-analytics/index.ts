import { AnalyticsChoice, type AnalyticsWindow } from './types';

const MeasurementId = 'G-RBHGLDECJ9';
const PreferenceKey = 'tocus.website.analytics';
let started = false;

/**
 * Keeps local development, previews and unrelated hosts out of production reports.
 * @return Whether this page is the built public website.
 * @since 1.0.0
 */
export function isAnalyticsWebsite(): boolean {
	return import.meta.env.PROD && window.location.origin === 'https://tocus.uo.ar';
}

/**
 * Reads only this website's preference, never extension storage.
 * @return Saved choice, or no consent when storage is unavailable or unrecognized.
 * @since 1.0.0
 */
export function readAnalyticsChoice(): AnalyticsChoice | null {
	try {
		const choice = localStorage.getItem( PreferenceKey );
		return choice === AnalyticsChoice.ACCEPTED || choice === AnalyticsChoice.REJECTED ? choice : null;
	} catch {
		return null;
	}
}

/**
 * Starts measurement only after consent; no Google script or ping precedes it.
 * @since 1.0.0
 */
function startAnalytics(): void {
	if ( started ) {
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
	gtag( 'consent', 'default', {
		analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
	} );
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

/**
 * Applies the current choice and completely unloads an already running tag on withdrawal.
 * @param choice - Visitor's current permission for website measurement.
 * @since 1.0.0
 */
export function applyAnalyticsChoice( choice: AnalyticsChoice | null ): void {
	if ( ! isAnalyticsWebsite() ) {
		return;
	}
	if ( choice === AnalyticsChoice.ACCEPTED ) {
		startAnalytics();
		return;
	}
	if ( started ) {
		const analyticsWindow: AnalyticsWindow = window;
		analyticsWindow[ 'ga-disable-G-RBHGLDECJ9' ] = true;
		for ( const name of [ '_ga', '_ga_RBHGLDECJ9' ] ) {
			document.cookie = `${ name }=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
		}
		window.location.reload();
	}
}

/**
 * Saves a deliberate choice, keeping it effective for this visit if storage is blocked.
 * @param choice - Visitor's accept or reject action.
 * @since 1.0.0
 */
export function saveAnalyticsChoice( choice: AnalyticsChoice ): void {
	try {
		localStorage.setItem( PreferenceKey, choice );
	} catch {
		// Browser storage restrictions must not prevent rejecting analytics.
	}
	applyAnalyticsChoice( choice );
}
