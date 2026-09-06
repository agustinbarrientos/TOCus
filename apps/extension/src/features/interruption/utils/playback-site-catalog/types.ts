/**
 * Local host and optional path boundaries for native video control.
 * @since 0.1.0 Initial implementation.
 */
export interface PlaybackSiteRule {
	/**
	 * Domain roots, including their dot-delimited subdomains.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly domains: readonly string[];
	/**
	 * Allowed paths, including descendants separated by a slash.
	 * An omitted list allows every path on the matching domain.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly pathPrefixes?: readonly string[];
}
