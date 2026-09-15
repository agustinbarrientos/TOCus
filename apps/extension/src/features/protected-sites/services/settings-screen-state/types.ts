/**
 * One duplicate-add attempt; a fresh notice also reveals repeated attempts for the same row.
 * @since 0.1.0
 */
export interface DuplicateSiteNotice {
	/** Canonical identity of the row that already owns this website. */
	identityHost: string;
}
