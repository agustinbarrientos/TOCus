/**
 * Actual fixture promises returned to the production controller by its external boundaries.
 * @since 0.1.0
 */
export interface OriginalAdvanceBoundary {
	/** Most recent preference persistence operation. */
	saved: Promise<unknown> | null;
	/** Most recent language readiness operation. */
	language: Promise<boolean> | null;
}

declare global {
	/** Fixture-local React testing environment, absent from production entrypoints. */
	interface Window {
		/** Enables React's public act environment only while a fixture event settles. */
		IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
	}
}
