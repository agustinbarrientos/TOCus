/**
 * Rendered colors and diagnostics captured together for a shared-control surface.
 * @since 0.1.0
 */
export interface ContrastMeasurement {
	/** Visible label used to identify a failing surface without another browser call. */
	label: string;
	/** Computed background after resolving transparent ancestors. */
	background: string;
	/** WCAG foreground/background contrast ratio. */
	ratio: number;
	/** Whether this surface participates in native keyboard focus. */
	focusable: boolean;
}
