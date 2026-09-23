/**
 * Mounted Statistics screen lifecycle and its authoritative refresh operation.
 * @since 1.0.0
 */
export interface StatisticsCalendarObserverOptions {
	document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
	window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
	onChange(): void;
}
