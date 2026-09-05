import { describe, expect, it, vi } from 'vitest';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import { createWellbeingSummaryController } from './index';
import { type WellbeingSummaryTarget } from './types';
import { type WellbeingSummaryValues } from '../../utils/format-wellbeing-summary/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';

/**
 * Statistics-change listener used by the controller fixture.
 * @since 0.1.0 Initial implementation.
 */
type TestStatisticsChangeListener = () => void;

/**
 * Observable statistics source used by wellbeing-summary controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryStatisticsSource {
	/**
	 * Statistics-change listeners registered with the source.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly listeners = new Set<TestStatisticsChangeListener>();

	/**
	 * Reads the next configured statistics projection.
	 * @since 0.1.0 Initial implementation.
	 */
	readonly readStatistics: () => Promise<StatisticsProjection>;

	/**
	 * Creates an observable statistics source.
	 * @param readStatistics - Read implementation used by the test.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( readStatistics: () => Promise<StatisticsProjection> ) {
		this.readStatistics = readStatistics;
	}

	/**
	 * Begins notifying one statistics-change listener.
	 * @param listener - Statistics-change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addStatisticsChangeListener( listener: TestStatisticsChangeListener ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops notifying one statistics-change listener.
	 * @param listener - Previously subscribed listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeStatisticsChangeListener( listener: TestStatisticsChangeListener ): void {
		this.listeners.delete( listener );
	}

	/**
	 * Notifies every active listener that statistics changed.
	 * @since 0.1.0 Initial implementation.
	 */
	emitChange(): void {
		for ( const listener of this.listeners ) {
			listener();
		}
	}
}

/**
 * Creates one available projection with the requested footer values.
 * @param estimatedReclaimedMilliseconds - Estimated reclaimed duration or missing baseline.
 * @param focusedPauseMilliseconds - Observed focused-pause duration.
 * @return Complete available statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function createProjection(
	estimatedReclaimedMilliseconds: number | null,
	focusedPauseMilliseconds: number,
): StatisticsProjection {
	return {
		status: StatisticsProjectionStatus.AVAILABLE,
		estimatedReclaimedMilliseconds,
		focusedPauseMilliseconds,
		reconsideredVisitCount: 0,
		completedWaitCount: 0,
		allowanceGrantedCount: 0,
	};
}

/**
 * Creates one interruption-footer target for controller tests.
 * @return Mutable test target.
 * @since 0.1.0 Initial implementation.
 */
function createTarget(): WellbeingSummaryTarget {
	return {
		wellbeingSummary: 'Initial neutral footer.',
	};
}

/**
 * Formats one deterministic localized duration for controller tests.
 * @param milliseconds - Positive fixture duration.
 * @return Deterministic localized duration.
 * @since 0.1.0 Initial implementation.
 */
function formatLocalizedDuration( milliseconds: number ): string {
	return `${ String( milliseconds / 60_000 ) } minutos`;
}

/**
 * Composes one deterministic localized wellbeing sentence for controller tests.
 * @param values - Formatted fixture values.
 * @return Deterministic localized sentence.
 * @since 0.1.0 Initial implementation.
 */
function formatLocalizedSummary( values: WellbeingSummaryValues ): string {
	return `Tiempo recuperado: ${ values.estimatedReclaimedTime ?? 'ninguno' }; pausa: ${ values.focusedPauseTime ?? 'ninguna' }.`;
}

describe( 'wellbeing summary controller', () => {
	it( 'accepts localized copy before the first statistics projection', () => {
		const target = createTarget();
		const controller = createWellbeingSummaryController( {
			copy: TestEnglishLocalizationBundle.wellbeing,
			source: new MemoryStatisticsSource( vi.fn() ),
			target,
		} );

		controller.setCopy( {
			neutral: 'Este momento es para vos.',
			formatDuration: formatLocalizedDuration,
			formatSummary: formatLocalizedSummary,
		} );

		expect( target.wellbeingSummary ).toBe( 'Initial neutral footer.' );
	} );

	it( 'keeps the footer empty until localized copy is available', async () => {
		const target = createTarget();
		const controller = createWellbeingSummaryController( {
			source: new MemoryStatisticsSource( vi.fn().mockResolvedValue( createProjection( 120_000, 60_000 ) ) ),
			target,
		} );

		await controller.refresh();

		expect( target.wellbeingSummary ).toBe( '' );
	} );

	it( 'reads and projects the authoritative summary', async () => {
		const target = createTarget();
		const readStatistics = vi.fn().mockResolvedValue( createProjection( 120_000, 60_000 ) );
		const controller = createWellbeingSummaryController( {
			copy: TestEnglishLocalizationBundle.wellbeing,
			source: new MemoryStatisticsSource( readStatistics ),
			target,
		} );

		await controller.refresh();

		expect( readStatistics ).toHaveBeenCalledOnce();
		expect( target.wellbeingSummary ).toBe(
			"Since you started, you've given yourself about 2 minutes back and taken 1 minute for yourself.",
		);
	} );

	it( 'uses the neutral footer when statistics are unavailable or the read rejects', async () => {
		const target = createTarget();
		const readStatistics = vi.fn()
			.mockResolvedValueOnce( { status: StatisticsProjectionStatus.UNAVAILABLE } )
			.mockRejectedValueOnce( new Error( 'Local read failed.' ) );
		const controller = createWellbeingSummaryController( {
			copy: TestEnglishLocalizationBundle.wellbeing,
			source: new MemoryStatisticsSource( readStatistics ),
			target,
		} );

		await controller.refresh();
		expect( target.wellbeingSummary ).toBe( 'This is a moment just for you.' );

		target.wellbeingSummary = 'Stale value';
		await controller.refresh();
		expect( target.wellbeingSummary ).toBe( 'This is a moment just for you.' );
	} );

	it( 'ignores an older read when a newer refresh settles first', async () => {
		const target = createTarget();
		const firstRead = Promise.withResolvers<StatisticsProjection>();
		const secondRead = Promise.withResolvers<StatisticsProjection>();
		const readStatistics = vi.fn()
			.mockReturnValueOnce( firstRead.promise )
			.mockReturnValueOnce( secondRead.promise );
		const controller = createWellbeingSummaryController( {
			copy: TestEnglishLocalizationBundle.wellbeing,
			source: new MemoryStatisticsSource( readStatistics ),
			target,
		} );
		const firstRefresh = controller.refresh();
		const secondRefresh = controller.refresh();

		secondRead.resolve( createProjection( 0, 120_000 ) );
		await secondRefresh;
		firstRead.resolve( createProjection( 0, 60_000 ) );
		await firstRefresh;

		expect( target.wellbeingSummary ).toBe(
			"Since you started, you've taken 2 minutes for yourself.",
		);
	} );

	it( 'reformats the latest projection when localized copy changes', async () => {
		const target = createTarget();
		const readStatistics = vi.fn().mockResolvedValue( createProjection( 120_000, 60_000 ) );
		const controller = createWellbeingSummaryController( {
			copy: TestEnglishLocalizationBundle.wellbeing,
			source: new MemoryStatisticsSource( readStatistics ),
			target,
		} );

		await controller.refresh();
		controller.setCopy( {
			neutral: 'Este momento es para vos.',
			formatDuration: formatLocalizedDuration,
			formatSummary: formatLocalizedSummary,
		} );

		expect( target.wellbeingSummary ).toBe(
			'Tiempo recuperado: 2 minutos; pausa: 1 minutos.',
		);
		expect( readStatistics ).toHaveBeenCalledOnce();
	} );

	it( 'refreshes a waiting footer when authoritative local statistics change', async () => {
		const target = createTarget();
		const readStatistics = vi.fn()
			.mockResolvedValueOnce( createProjection( 0, 60_000 ) )
			.mockResolvedValueOnce( createProjection( 120_000, 180_000 ) );
		const source = new MemoryStatisticsSource( readStatistics );
		const controller = createWellbeingSummaryController( {
			copy: TestEnglishLocalizationBundle.wellbeing,
			source,
			target,
		} );

		controller.start();
		controller.start();
		await controller.refresh();
		source.emitChange();
		await vi.waitFor( () => {
			expect( target.wellbeingSummary ).toBe(
				"Since you started, you've given yourself about 2 minutes back and taken 3 minutes for yourself.",
			);
		} );

		controller.stop();
		controller.stop();
		source.emitChange();

		expect( readStatistics ).toHaveBeenCalledTimes( 2 );
	} );
} );
