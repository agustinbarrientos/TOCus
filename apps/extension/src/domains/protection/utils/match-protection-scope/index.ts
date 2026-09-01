import { type ProtectionScopeId } from '../../types/protection-value';
import {
	ProtectedUrlMatchStatus,
	type ProtectedUrlMatchResult,
} from '../../types/protected-url-match';

/**
 * Checks whether a current URL match protects one authoritative scope.
 * @param match - Current validated URL-match result.
 * @param scopeId - Scope that must own the protected match.
 * @return Whether the match is Protected for the supplied scope.
 * @since 0.1.0 Initial implementation.
 */
export function protectionMatchProtectsScope(
	match: ProtectedUrlMatchResult,
	scopeId: ProtectionScopeId,
): boolean {
	return match.status === ProtectedUrlMatchStatus.PROTECTED && match.rule.scopeId === scopeId;
}
