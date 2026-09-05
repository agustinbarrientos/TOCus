import { type Mock } from 'vitest';
import { type ProtectionCoordinator } from '../../../../../domains/protection';
import { type StatisticsRuntime } from '../../../../statistics/services/statistics-runtime';
import { type BrowserProtectionRuntime } from '../types';

/**
 * Mutable wall-clock holder used by runtime integration tests.
 * @since 0.1.0 Initial implementation.
 */
export interface MutableClock {
	value: number;
}

/**
 * Initialized runtime services returned to integration tests.
 * @since 0.1.0 Initial implementation.
 */
export interface RuntimeTestHarness {
	coordinator: ProtectionCoordinator;
	runtime: BrowserProtectionRuntime;
}

/**
 * Inspectable statistics runtime double used by lifecycle integration tests.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsRuntimeDouble extends StatisticsRuntime {
	/**
	 * Records focus observation boundaries.
	 * @since 0.1.0 Initial implementation.
	 */
	beginFocusObservation: Mock<StatisticsRuntime[ 'beginFocusObservation' ]>;
	/**
	 * Records focus checkpoints.
	 * @since 0.1.0 Initial implementation.
	 */
	checkpoint: Mock<StatisticsRuntime[ 'checkpoint' ]>;
	/**
	 * Records durable fact drains.
	 * @since 0.1.0 Initial implementation.
	 */
	drainProtectionFacts: Mock<StatisticsRuntime[ 'drainProtectionFacts' ]>;
	/**
	 * Records privacy-safe focus measurement discards.
	 * @since 0.1.0 Initial implementation.
	 */
	discardFocusMeasurement: Mock<StatisticsRuntime[ 'discardFocusMeasurement' ]>;
	/**
	 * Records snapshot reads.
	 * @since 0.1.0 Initial implementation.
	 */
	getSnapshot: Mock<StatisticsRuntime[ 'getSnapshot' ]>;
	/**
	 * Records raw configuration reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	reconcileConfiguration: Mock<StatisticsRuntime[ 'reconcileConfiguration' ]>;
	/**
	 * Records explicit statistics resets.
	 * @since 0.1.0 Initial implementation.
	 */
	reset: Mock<StatisticsRuntime[ 'reset' ]>;
}
