import { describe, expect, it, vi } from 'vitest';
import { ReviewPromptStorageKey } from '../../../../domains/preferences/services/review-prompt-storage';
import { LocalDateSchema } from '../../../../domains/protection/types/protection-value';
import { StatisticsProjectionStatus, type StatisticsProjection } from '../../../../domains/statistics/types/statistics-projection';
import type { StatisticsStorageChangeListener } from '../../../statistics/services/statistics-client/types';
import { createReviewPromptController, ReviewPromptDismissRequestEventName, type ReviewPromptPresentation } from './index';

/**
 * Creates an authoritative saved-time projection.
 * @param saved - Total estimated reclaimed milliseconds.
 * @return Available all-time projection.
 * @since 0.1.0 Initial implementation.
 */
function projection( saved = 3_600_000 ): StatisticsProjection {
	return {
		status: StatisticsProjectionStatus.AVAILABLE, currentDate: LocalDateSchema.parse( '2026-09-23' ),
		estimatedReclaimedMilliseconds: saved, focusedPauseMilliseconds: 1_000,
		reconsideredVisitCount: 12, completedWaitCount: 12, allowanceGrantedCount: 0,
		dailyTotals: [],
	};
}

/**
 * Creates isolated storage, statistics and screen boundaries.
 * @param url - Configured store URL or unsupported-browser marker.
 * @return Controller and observable dependencies.
 * @since 0.1.0 Initial implementation.
 */
function fixture( url: string | null = 'https://example.com/reviews' ) {
	const target = Object.assign( new EventTarget(), {
		reviewPrompt: null as Readonly<ReviewPromptPresentation> | null,
	} );
	const source = {
		readStatistics: vi.fn<() => Promise<StatisticsProjection>>().mockResolvedValue( projection() ),
		addStatisticsChangeListener: vi.fn(), removeStatisticsChangeListener: vi.fn(),
	};
	const storage = {
		load: vi.fn<() => Promise<boolean | null>>().mockResolvedValue( false ),
		dismiss: vi.fn<() => Promise<void>>().mockResolvedValue( undefined ),
	};
	const storageChanges = { addListener: vi.fn(), removeListener: vi.fn() };
	const controller = createReviewPromptController( { target, source, storage, storageChanges, url } );
	return { target, source, storage, storageChanges, controller };
}

/**
 * Settles queued storage, controller and event continuations.
 * @return Completion after current promise work.
 * @since 0.1.0 Initial implementation.
 */
async function settle(): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
}

describe( 'review prompt controller', () => {
	it.each( [ 0, 3_599_999, 3_600_000, 4_000_000 ] )( 'uses the exact one-hour threshold at %i', async ( saved ) => {
		const harness = fixture();
		harness.source.readStatistics.mockResolvedValue( projection( saved ) );
		harness.controller.start();
		await settle();
		expect( harness.target.reviewPrompt ).toEqual( saved >= 3_600_000
			? { url: 'https://example.com/reviews', savedMilliseconds: saved, dismissing: false, dismissalFailed: false }
			: null );
	} );

	it( 'does not read, observe or dismiss without a store URL', async () => {
		const harness = fixture( null );
		harness.controller.start();
		await harness.controller.refresh();
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		harness.controller.stop();
		expect( harness.source.readStatistics ).not.toHaveBeenCalled();
		expect( harness.source.addStatisticsChangeListener ).not.toHaveBeenCalled();
		expect( harness.storageChanges.addListener ).not.toHaveBeenCalled();
		expect( harness.storage.dismiss ).not.toHaveBeenCalled();
	} );

	it.each( [ true, null ] )( 'hides a dismissed or unreadable local flag %s', async ( flag ) => {
		const harness = fixture();
		harness.storage.load.mockResolvedValue( flag );
		harness.controller.start();
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
	} );

	it( 'fails hidden for unavailable statistics and rejected reads', async () => {
		const harness = fixture();
		harness.source.readStatistics.mockResolvedValue( { status: StatisticsProjectionStatus.UNAVAILABLE } );
		harness.controller.start();
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
		harness.source.readStatistics.mockRejectedValue( new Error( 'Unavailable' ) );
		await harness.controller.refresh();
		expect( harness.target.reviewPrompt ).toBeNull();
		harness.source.readStatistics.mockResolvedValue( projection() );
		harness.storage.load.mockRejectedValue( new Error( 'Unavailable' ) );
		await harness.controller.refresh();
		expect( harness.target.reviewPrompt ).toBeNull();
	} );

	it( 'observes saved-time changes once and cleans up on stop', async () => {
		const harness = fixture();
		await harness.controller.refresh();
		expect( harness.source.readStatistics ).not.toHaveBeenCalled();
		harness.controller.start();
		harness.controller.start();
		await settle();
		expect( harness.source.addStatisticsChangeListener ).toHaveBeenCalledOnce();
		const changed = harness.source.addStatisticsChangeListener.mock.calls[ 0 ]?.[ 0 ] as () => void;
		harness.source.readStatistics.mockResolvedValue( projection( 0 ) );
		changed();
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		expect( harness.storage.dismiss ).not.toHaveBeenCalled();
		harness.controller.stop();
		harness.controller.stop();
		changed();
		expect( harness.source.removeStatisticsChangeListener ).toHaveBeenCalledExactlyOnceWith( changed );
		expect( harness.storageChanges.removeListener ).toHaveBeenCalledExactlyOnceWith(
			harness.storageChanges.addListener.mock.calls[ 0 ]?.[ 0 ],
		);
	} );

	it( 'keeps only the newest authoritative read', async () => {
		const harness = fixture();
		const oldRead = Promise.withResolvers<StatisticsProjection>();
		harness.source.readStatistics.mockReturnValueOnce( oldRead.promise );
		harness.controller.start();
		harness.source.readStatistics.mockResolvedValue( projection( 0 ) );
		await harness.controller.refresh();
		oldRead.resolve( projection() );
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
	} );

	it( 'does not hide a newer invitation after an older read fails', async () => {
		const harness = fixture();
		const oldRead = Promise.withResolvers<StatisticsProjection>();
		harness.source.readStatistics.mockReturnValueOnce( oldRead.promise );
		harness.controller.start();
		await harness.controller.refresh();
		oldRead.reject( new Error( 'Old read failed' ) );
		await settle();
		expect( harness.target.reviewPrompt ).not.toBeNull();
	} );

	it( 'persists dismissal once and prevents pending reads from reopening it', async () => {
		const harness = fixture();
		harness.controller.start();
		await settle();
		const oldRead = Promise.withResolvers<StatisticsProjection>();
		const write = Promise.withResolvers<undefined>();
		harness.source.readStatistics.mockReturnValueOnce( oldRead.promise );
		const reading = harness.controller.refresh();
		harness.storage.dismiss.mockReturnValue( write.promise );
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		expect( harness.target.reviewPrompt?.dismissing ).toBe( true );
		await harness.controller.refresh();
		expect( harness.storage.dismiss ).toHaveBeenCalledOnce();
		write.resolve( undefined );
		await settle();
		oldRead.resolve( projection() );
		await reading;
		await harness.controller.refresh();
		expect( harness.target.reviewPrompt ).toBeNull();
	} );

	it( 'offers a retry if permanent dismissal cannot be persisted', async () => {
		const harness = fixture();
		harness.controller.start();
		await settle();
		harness.storage.dismiss.mockRejectedValueOnce( new Error( 'Unavailable' ) );
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		await settle();
		expect( harness.target.reviewPrompt ).toEqual( {
			url: 'https://example.com/reviews', savedMilliseconds: 3_600_000, dismissing: false, dismissalFailed: true,
		} );
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
	} );

	it( 'synchronizes dismissal across tabs and ignores unrelated storage changes', async () => {
		const harness = fixture();
		harness.controller.start();
		await settle();
		const changed = harness.storageChanges.addListener.mock.calls[ 0 ]?.[ 0 ] as StatisticsStorageChangeListener;
		changed( { unrelated: { newValue: true } }, 'local' );
		changed( { [ ReviewPromptStorageKey ]: { newValue: true } }, 'session' );
		expect( harness.source.readStatistics ).toHaveBeenCalledOnce();
		changed( { [ ReviewPromptStorageKey ]: { newValue: true } }, 'local' );
		expect( harness.target.reviewPrompt ).toBeNull();
		changed( { [ ReviewPromptStorageKey ]: {} }, 'local' );
		await settle();
		expect( harness.target.reviewPrompt ).not.toBeNull();
	} );

	it.each( [ true, false ] )( 'does not resurrect after stop when a pending dismissal succeeds: %s', async ( succeeds ) => {
		const harness = fixture();
		harness.controller.start();
		await settle();
		const write = Promise.withResolvers<undefined>();
		harness.storage.dismiss.mockReturnValue( write.promise );
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		harness.controller.stop();
		if ( succeeds ) {
			write.resolve( undefined );
		} else {
			write.reject( new Error( 'Unavailable' ) );
		}
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
		harness.target.dispatchEvent( new Event( ReviewPromptDismissRequestEventName ) );
		expect( harness.storage.dismiss ).toHaveBeenCalledOnce();
	} );

	it( 'invalidates pending reads on stop and starts cleanly again', async () => {
		const harness = fixture();
		const read = Promise.withResolvers<StatisticsProjection>();
		harness.source.readStatistics.mockReturnValueOnce( read.promise );
		harness.controller.start();
		harness.controller.stop();
		read.resolve( projection() );
		await settle();
		expect( harness.target.reviewPrompt ).toBeNull();
		harness.controller.start();
		await settle();
		expect( harness.target.reviewPrompt ).not.toBeNull();
	} );
} );
