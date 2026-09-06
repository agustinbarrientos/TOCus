/**
 * Browser permission grants relevant to full local-data reset.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteAccessGrants {
	/** Currently granted host patterns. */
	origins?: string[];
	/** Currently granted named capabilities. */
	permissions?: string[];
}

/**
 * Read and removal operations, without any ability to request new access.
 * @since 0.1.0 Initial implementation.
 */
export interface WebsiteAccessRevocationApi {
	/**
	 * Lists all currently granted extension permissions.
	 * @return Browser-owned permission inventory.
	 * @since 0.1.0 Initial implementation.
	 */
	getAll(): Promise<WebsiteAccessGrants>;
	/**
	 * Removes the specified optional grants.
	 * @param grants - Actual currently granted website access.
	 * @return Whether the browser removed the requested access.
	 * @since 0.1.0 Initial implementation.
	 */
	remove( grants: WebsiteAccessGrants ): Promise<boolean>;
}
