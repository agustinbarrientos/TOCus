import type { FullResult } from '@playwright/test/reporter';

/**
 * Completeness failures override an otherwise passing screenshot run.
 * @since 0.1.0
 */
export interface OriginalAuditResult {
	status: FullResult['status'];
}
