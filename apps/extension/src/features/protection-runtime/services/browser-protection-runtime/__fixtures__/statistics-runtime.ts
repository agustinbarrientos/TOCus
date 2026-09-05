import { vi } from 'vitest';
import { StatisticsFocusEpochIdSchema } from '../../../../../domains/statistics/types/statistics-value';
import { StatisticsFocusObservationMode } from '../../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { type StatisticsRuntime } from '../../../../statistics/services/statistics-runtime';
import { type StatisticsRuntimeDouble } from './types';

/**
 * Creates an inert statistics runtime for protection-only integration scenarios.
 * @return Statistics runtime whose operations resolve without side effects.
 * @since 0.1.0 Initial implementation.
 */
export function createInertStatisticsRuntime(): StatisticsRuntimeDouble {
	const focusEpochId = StatisticsFocusEpochIdSchema.parse( 'focus_epoch_current' );

	return {
		beginFocusObservation: vi.fn().mockImplementation( (
			mode: Parameters<StatisticsRuntime[ 'beginFocusObservation' ]>[ 0 ],
		) => Promise.resolve( {
			mode,
			previousFocusEpochId: mode === StatisticsFocusObservationMode.STARTUP
				? null
				: focusEpochId,
			currentFocusEpochId: focusEpochId,
		} ) ),
		checkpoint: vi.fn().mockResolvedValue( undefined ),
		drainProtectionFacts: vi.fn().mockResolvedValue( undefined ),
		discardFocusMeasurement: vi.fn().mockResolvedValue( undefined ),
		getSnapshot: vi.fn().mockReturnValue( {
			deliveryStatus: null,
			focusMeasurementEnabled: false,
			projection: { status: 'unavailable' },
		} ),
		reconcileConfiguration: vi.fn().mockResolvedValue( undefined ),
		reset: vi.fn().mockResolvedValue( true ),
	};
}

export type { StatisticsRuntimeDouble } from './types';
