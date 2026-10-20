import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
import type { NormalizedSchedule } from '../../types/protection-schedule';
import type { TimingConfiguration } from '../../types/timing-configuration';

/**
 * Effective policy for one existing target, with its explicit configuration intact.
 * @since 1.0.1
 */
export interface ResolvedSitePolicy {
	site: ProtectedSiteConfiguration;
	schedule: NormalizedSchedule;
	timingConfiguration: TimingConfiguration;
}
