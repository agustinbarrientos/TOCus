import {
	StatisticsDocumentSchema,
	type ScopeStatistics,
	type StatisticsDocument,
} from '../../types/statistics-document';
import {
	StatisticsSessionDocumentSchema,
	type StatisticsFocusAnchor,
	type StatisticsSessionDocument,
	type StatisticsSessionWorkIdentity,
} from '../../types/statistics-session';
import {
	StatisticsFocusEpochIdSchema,
	type StatisticsFocusEpochId,
} from '../../types/statistics-value';
import {
	SessionContinuityIdSchema,
	type SessionContinuityId,
} from '../../../protection/types/protection-value';

/**
 * Reads one own scope entry without falling through to the Object prototype.
 * @param document - Parsed local statistics document.
 * @param scopeId - Exact scope identifier to read.
 * @return Matching own scope statistics, or undefined when absent.
 * @since 0.1.0 Initial implementation.
 */
function getOwnStatisticsScope(
	document: StatisticsDocument,
	scopeId: string,
): ScopeStatistics | undefined {
	return Object.hasOwn( document.scopes, scopeId )
		? document.scopes[ scopeId ]
		: undefined;
}

/**
 * Tests whether session work still identifies one active allowance.
 * @param work - Parsed session work identity.
 * @param document - Parsed local statistics document.
 * @return True when the work belongs to the current active allowance.
 * @since 0.1.0 Initial implementation.
 */
function sessionWorkMatchesActiveAllowance(
	work: StatisticsSessionWorkIdentity,
	document: StatisticsDocument,
): boolean {
	const scope = getOwnStatisticsScope( document, work.scopeId );
	const activeAllowance = scope?.activeAllowance;

	return document.generationId === work.generationId &&
		scope?.currentMeasurementRevision === work.measurementRevision &&
		activeAllowance?.measurementRevision === work.measurementRevision &&
		activeAllowance.allowanceId === work.allowanceId;
}

/**
 * Tests whether one focus anchor falls within its active allowance.
 * @param anchor - Parsed focus anchor.
 * @param document - Parsed local statistics document.
 * @param sessionContinuityId - Current browser-session continuity identifier.
 * @param focusEpochId - Current focus epoch identifier.
 * @return True when the anchor remains compatible and bounded.
 * @since 0.1.0 Initial implementation.
 */
function focusAnchorIsCompatible(
	anchor: StatisticsFocusAnchor,
	document: StatisticsDocument,
	sessionContinuityId: SessionContinuityId,
	focusEpochId: StatisticsFocusEpochId,
): boolean {
	const activeAllowance = getOwnStatisticsScope( document, anchor.scopeId )?.activeAllowance;

	return anchor.sessionContinuityId === sessionContinuityId &&
		anchor.focusEpochId === focusEpochId &&
		sessionWorkMatchesActiveAllowance( anchor, document ) &&
		activeAllowance !== undefined &&
		anchor.focusedAtEpochMilliseconds >= activeAllowance.startedAtEpochMilliseconds &&
		anchor.focusedAtEpochMilliseconds <= activeAllowance.expiresAtEpochMilliseconds;
}

/**
 * Restores session focus work only while its active allowance remains current.
 * @param input - Unknown session statistics document input.
 * @param documentInput - Unknown local statistics document input.
 * @param sessionContinuityIdInput - Unknown current browser-session continuity identifier.
 * @param focusEpochIdInput - Unknown current focus epoch identifier.
 * @return Compatible session work, or null for absent, malformed, future, or stale input.
 * @since 0.1.0 Initial implementation.
 */
export function restoreStatisticsSession(
	input: unknown,
	documentInput: unknown,
	sessionContinuityIdInput: unknown,
	focusEpochIdInput: unknown,
): StatisticsSessionDocument | null {
	const session = StatisticsSessionDocumentSchema.safeParse( input );
	const document = StatisticsDocumentSchema.safeParse( documentInput );
	const sessionContinuityId = SessionContinuityIdSchema.safeParse( sessionContinuityIdInput );
	const focusEpochId = StatisticsFocusEpochIdSchema.safeParse( focusEpochIdInput );

	if ( ! session.success || ! document.success || ! sessionContinuityId.success || ! focusEpochId.success ) {
		return null;
	}

	const focusAnchor = session.data.focusAnchor !== undefined &&
		focusAnchorIsCompatible(
			session.data.focusAnchor,
			document.data,
			sessionContinuityId.data,
			focusEpochId.data,
		)
		? session.data.focusAnchor
		: undefined;
	const pendingInterval = session.data.pendingInterval !== undefined &&
		sessionWorkMatchesActiveAllowance( session.data.pendingInterval, document.data )
		? session.data.pendingInterval
		: undefined;

	if ( focusAnchor === undefined && pendingInterval === undefined ) {
		return null;
	}

	return StatisticsSessionDocumentSchema.parse( {
		schemaVersion: session.data.schemaVersion,
		...( focusAnchor === undefined ? {} : { focusAnchor } ),
		...( pendingInterval === undefined ? {} : { pendingInterval } ),
	} );
}
