import { z } from 'zod';
import { AllowanceDurationMaximumMilliseconds } from '../../protection/types/allowance-duration';
import { CanonicalHostSchema } from '../../protection/types/protected-site-rule';
import { StatisticsNonNegativeSafeIntegerSchema } from './statistics-value';

/**
 * Focused visit durations keyed only by configured site hosts, never page URLs or titles.
 * @since 0.1.0 Per-site longest-visit estimates.
 */
export const SiteVisitDurationsSchema = z.record(
	CanonicalHostSchema,
	StatisticsNonNegativeSafeIntegerSchema.max( AllowanceDurationMaximumMilliseconds ),
);

/**
 * Compact per-site measurements; no individual navigation history is retained.
 * @since 0.1.0 Per-site longest-visit estimates.
 */
export type SiteVisitDurations = z.infer<typeof SiteVisitDurationsSchema>;
