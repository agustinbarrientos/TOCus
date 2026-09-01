import {
	AllowanceExpiryCandidateSource,
	type AllowanceExpiryEvent,
	type LivePageAllowanceExpiryCandidate,
	type ReadyAllowanceExpiryCandidate,
} from '../../types/protection-event';
import { type ProtectionParticipant } from '../../types/protection-participant';
import { type CanonicalAllowanceExpiryCandidates } from './types';

/**
 * Checks whether two validated URL-match observations contain identical status-specific details.
 * @param left - First validated URL-match result.
 * @param right - Second validated URL-match result.
 * @return Whether both results contain the same complete observation.
 * @since 0.1.0 Initial implementation.
 */
function protectedUrlMatchesAreEqual(
	left: AllowanceExpiryEvent['candidates'][number]['match'],
	right: AllowanceExpiryEvent['candidates'][number]['match'],
): boolean {
	if ( left.status !== right.status ) {
		return false;
	}

	if ( left.status === 'protected' ) {
		return right.status === 'protected' &&
			left.rule.host === right.rule.host &&
			left.rule.includeSubdomains === right.rule.includeSubdomains &&
			left.rule.scopeId === right.rule.scopeId;
	}

	if ( left.status === 'unsupported' ) {
		return right.status === 'unsupported' && left.reason === right.reason;
	}

	return right.status === 'unprotected';
}

/**
 * Checks whether two identity-matched candidates carry one fully equal observation.
 * @param left - First validated candidate observation.
 * @param right - Second validated candidate observation.
 * @return Whether destination, focus eligibility, and complete match details are equal.
 * @since 0.1.0 Initial implementation.
 */
function candidateObservationsAreEqual(
	left: AllowanceExpiryEvent['candidates'][number],
	right: AllowanceExpiryEvent['candidates'][number],
): boolean {
	return left.observedDestination === right.observedDestination &&
		left.focusEligible === right.focusEligible &&
		protectedUrlMatchesAreEqual( left.match, right.match );
}

/**
 * Canonicalizes Ready-source observations against the current Ready identity set.
 * @param participants - Current authoritative Ready participants.
 * @param candidates - Validated Ready-source observations from the expiry batch.
 * @return Deduplicated current Ready observations, or null for any identity or observation conflict.
 * @since 0.1.0 Initial implementation.
 */
function canonicalizeReadyCandidates(
	participants: readonly ProtectionParticipant[],
	candidates: ReadyAllowanceExpiryCandidate[],
): ReadyAllowanceExpiryCandidate[] | null {
	const participantIds = new Set( participants.map( ( participant ) => participant.participantId ) );
	const pageIds = new Set( participants.map( ( participant ) => participant.pageId ) );
	const canonicalCandidates: ReadyAllowanceExpiryCandidate[] = [];

	for ( const candidate of candidates ) {
		const participantIsCurrent = participantIds.has( candidate.participantId );
		const pageIsCurrent = pageIds.has( candidate.pageId );

		if ( participantIsCurrent !== pageIsCurrent ) {
			return null;
		}

		if ( ! participantIsCurrent ) {
			continue;
		}

		const participant = participants.find(
			( currentParticipant ) => currentParticipant.participantId === candidate.participantId,
		);
		const duplicate = canonicalCandidates.find(
			( currentCandidate ) => currentCandidate.participantId === candidate.participantId,
		);

		if ( participant?.pageId !== candidate.pageId ) {
			return null;
		}

		if ( duplicate !== undefined ) {
			if ( ! candidateObservationsAreEqual( duplicate, candidate ) ) {
				return null;
			}
		} else {
			canonicalCandidates.push( candidate );
		}
	}

	return participants.every( ( participant ) => canonicalCandidates.some(
		( candidate ) => candidate.participantId === participant.participantId,
	) ) ? canonicalCandidates : null;
}

/**
 * Canonicalizes the complete live-source batch before Ready-page precedence can apply.
 * @param participants - Current authoritative Ready participants.
 * @param candidates - Validated live-source observations from the expiry batch.
 * @return Deduplicated live observations, or null for any identity or observation conflict.
 * @since 0.1.0 Initial implementation.
 */
function canonicalizeLiveCandidates(
	participants: readonly ProtectionParticipant[],
	candidates: LivePageAllowanceExpiryCandidate[],
): LivePageAllowanceExpiryCandidate[] | null {
	const canonicalCandidates: LivePageAllowanceExpiryCandidate[] = [];

	for ( const candidate of candidates ) {
		const readyParticipant = participants.find(
			( participant ) => participant.participantId === candidate.participantId,
		);
		const participantMatch = canonicalCandidates.find(
			( currentCandidate ) => currentCandidate.participantId === candidate.participantId,
		);
		const pageMatch = canonicalCandidates.find(
			( currentCandidate ) => currentCandidate.pageId === candidate.pageId,
		);

		if ( readyParticipant !== undefined && readyParticipant.pageId !== candidate.pageId ) {
			return null;
		}

		if ( participantMatch !== undefined && participantMatch.pageId !== candidate.pageId ) {
			return null;
		}

		if ( pageMatch !== undefined && pageMatch.participantId !== candidate.participantId ) {
			return null;
		}

		const duplicate = participantMatch ?? pageMatch;

		if ( duplicate !== undefined ) {
			if ( ! candidateObservationsAreEqual( duplicate, candidate ) ) {
				return null;
			}
		} else {
			canonicalCandidates.push( candidate );
		}
	}

	return canonicalCandidates;
}

/**
 * Validates and canonicalizes one complete allowance-expiry candidate batch atomically.
 * @param readyParticipants - Current authoritative Ready participants.
 * @param event - Validated allowance-expiry transaction carrying the complete fresh candidate batch.
 * @return Canonical source-partitioned observations, or null when any identity or observation conflicts.
 * @since 0.1.0 Initial implementation.
 */
export function canonicalizeAllowanceExpiryCandidates(
	readyParticipants: readonly ProtectionParticipant[],
	event: AllowanceExpiryEvent,
): CanonicalAllowanceExpiryCandidates | null {
	const readyCandidates = canonicalizeReadyCandidates(
		readyParticipants,
		event.candidates.filter(
			( candidate ) => candidate.source === AllowanceExpiryCandidateSource.READY_PARTICIPANT,
		),
	);
	const liveCandidates = canonicalizeLiveCandidates(
		readyParticipants,
		event.candidates.filter(
			( candidate ) => candidate.source === AllowanceExpiryCandidateSource.LIVE_PAGE,
		),
	);

	if ( readyCandidates === null || liveCandidates === null ) {
		return null;
	}

	for ( const readyCandidate of readyCandidates ) {
		const duplicate = liveCandidates.find(
			( liveCandidate ) =>
				liveCandidate.participantId === readyCandidate.participantId &&
				liveCandidate.pageId === readyCandidate.pageId,
		);

		if ( duplicate !== undefined && ! candidateObservationsAreEqual( readyCandidate, duplicate ) ) {
			return null;
		}
	}

	return { readyCandidates, liveCandidates };
}

export {
	type CanonicalAllowanceExpiryCandidates,
} from './types';
