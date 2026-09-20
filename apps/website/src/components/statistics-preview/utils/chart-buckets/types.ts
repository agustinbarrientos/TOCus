import type { SampleDay } from '../../types';

/**
 * Inclusive calendar interval represented by one activity bar.
 * @since 0.1.0
 */
export interface SampleChartBucket extends SampleDay {
	endDate: string;
}
