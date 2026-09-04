import { vi } from 'vitest';
import { StatisticsFocusEpochIdSchema } from '../../../../../domains/statistics/types/statistics-value';
import { StatisticsFocusObservationMode } from '../../../../../domains/statistics/utils/prepare-statistics-checkpoint';
import { type StatisticsRuntime } from '../../../../statistics/services/statistics-runtime';

/**
 * Inspectable statistics runtime double used by lifecycle integration tests.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsRuntimeDouble extends StatisticsRuntime {
	/**
	 * Records focus observation boundaries.
	 * @since 0.1.0 Initial implementation.
	 */
	beginFocusObservation: ReturnType<typeof vi.fn<StatisticsRuntime[ 'beginFocusObservation' ]>>;
	/**
	 * Records focus checkpoints.
	 * @since 0.1.0 Initial implementation.
	 */
	checkpoint: ReturnType<typeof vi.fn<StatisticsRuntime[ 'checkpoint' ]>>;
	/**
	 * Records durable fact drains.
	 * @since 0.1.0 Initial implementation.
	 */
	drainProtectionFacts: ReturnType<typeof vi.fn<StatisticsRuntime[ 'drainProtectionFacts' ]>>;
	/**
	 * Records privacy-safe focus measurement discards.
	 * @since 0.1.0 Initial implementation.
	 */
	discardFocusMeasurement: ReturnType<typeof vi.fn<StatisticsRuntime[ 'discardFocusMeasurement' ]>>;
	/**
	 * Records snapshot reads.
	 * @since 0.1.0 Initial implementation.
	 */
	getSnapshot: ReturnType<typeof vi.fn<StatisticsRuntime[ 'getSnapshot' ]>>;
	/**
	 * Records raw configuration reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileConfiguration: ReturnType<typeof vi.fn<StatisticsRuntime[ 'reconcileConfiguration' ]>>;
	/**
	 * Records explicit statistics resets.
	 * @since 0.1.0 Initial implementation.
	 */
	reset: ReturnType<typeof vi.fn<StatisticsRuntime[ 'reset' ]>>;
}
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
