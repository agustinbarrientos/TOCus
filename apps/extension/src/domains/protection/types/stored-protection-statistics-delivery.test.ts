import { describe, expect, it } from 'vitest';
import {
	MaximumStoredProtectionStatisticsDeliveryBatchCount,
	StoredProtectionStatisticsDeliverySchema,
	StoredProtectionStatisticsDeliveryStatus,
} from './stored-protection-statistics-delivery';

/**
 * Shared observation time for stored delivery test batches.
 * @since 0.1.0 Initial implementation.
 */
const TEST_OBSERVATION_TIME = 1_800_000_000_000;

/**
 * Creates one valid stored protection-fact batch.
 * @param index - Unique batch and fact identifier suffix.
 * @param scopeId - Protection scope carried by the batch and fact.
 * @return Valid stored protection-fact batch input.
 * @since 0.1.0 Initial implementation.
 */
function createBatch( index: number, scopeId = 'scope_default' ) {
	return {
		batchId: `batch_${ String( index ) }`,
		scopeId,
		measurementRevision: `revision_${ String( index ) }`,
		observedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
		facts: [ {
			type: 'reconsidered-visit',
			factId: `fact_${ String( index ) }`,
			scopeId,
			waitId: 'wait_1',
			participantId: 'participant_1',
			departureCause: 'active-session-tab-close',
			observedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
		} ],
	};
}

describe( 'StoredProtectionStatisticsDeliverySchema', () => {
	it.each( [
		StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
	] )( 'preserves the exact %s status and FIFO batch order', ( status ) => {
		const firstBatch = createBatch( 1 );
		const secondBatch = createBatch( 2 );

		expect( StoredProtectionStatisticsDeliverySchema.parse( {
			status,
			outbox: [ firstBatch, secondBatch ],
		} ) ).toEqual( {
			status,
			outbox: [ firstBatch, secondBatch ],
		} );
	} );

	it( 'accepts exactly the documented maximum batch count', () => {
		const outbox = Array.from(
			{ length: MaximumStoredProtectionStatisticsDeliveryBatchCount },
			( _, index ) => createBatch( index ),
		);

		expect( StoredProtectionStatisticsDeliverySchema.safeParse( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox,
		} ).success ).toBe( true );
	} );

	it( 'rejects an outbox beyond the documented maximum batch count', () => {
		const outbox = Array.from(
			{ length: MaximumStoredProtectionStatisticsDeliveryBatchCount + 1 },
			( _, index ) => createBatch( index ),
		);

		expect( StoredProtectionStatisticsDeliverySchema.safeParse( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox,
		} ).success ).toBe( false );
	} );

	it( 'rejects duplicate batch identifiers without discarding either batch', () => {
		const firstBatch = createBatch( 1 );
		const secondBatch = { ...createBatch( 2 ), batchId: firstBatch.batchId };

		expect( StoredProtectionStatisticsDeliverySchema.safeParse( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [ firstBatch, secondBatch ],
		} ).success ).toBe( false );
	} );

	it.each( [
		{ status: 'pending', outbox: [] },
		{ status: StoredProtectionStatisticsDeliveryStatus.COMPLETE, outbox: [ { batchId: 'batch_1' } ] },
		{ status: StoredProtectionStatisticsDeliveryStatus.COMPLETE, outbox: [], extra: true },
	] )( 'rejects malformed delivery input %#', ( input ) => {
		expect( StoredProtectionStatisticsDeliverySchema.safeParse( input ).success ).toBe( false );
	} );

	it.each( [ '__proto__', 'constructor', 'toString', 'hasOwnProperty' ] )(
		'accepts the prototype-named scope identifier %s',
		( scopeId ) => {
			expect( StoredProtectionStatisticsDeliverySchema.safeParse( {
				status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
				outbox: [ createBatch( 1, scopeId ) ],
			} ).success ).toBe( true );
		},
	);
} );
