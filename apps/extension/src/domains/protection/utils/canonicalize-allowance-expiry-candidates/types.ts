import type {
	LivePageAllowanceExpiryCandidate,
	ReadyAllowanceExpiryCandidate,
} from '../../types/protection-event';

/**
 * Canonical source-partitioned observations for one complete expiry batch.
 * @since 0.1.0 Initial implementation.
 */
export interface CanonicalAllowanceExpiryCandidates {
	/** Complete current Ready-source observations. */
	readyCandidates: ReadyAllowanceExpiryCandidate[];
	/** Deduplicated live-page observations. */
	liveCandidates: LivePageAllowanceExpiryCandidate[];
}
