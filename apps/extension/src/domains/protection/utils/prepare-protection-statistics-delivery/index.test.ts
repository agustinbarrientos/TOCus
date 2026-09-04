import { describe, expect, it } from 'vitest';
import { DepartureCause } from '../../types/protection-event';
import {
	ProtectionFactSchema,
	ProtectionFactType,
} from '../../types/protection-fact';
import { ProtectionFactBatchSchema } from '../../types/protection-fact-batch';
import {
	MaximumStoredProtectionStatisticsDeliveryBatchCount,
	StoredProtectionStatisticsDeliverySchema,
	StoredProtectionStatisticsDeliveryStatus,
} from '../../types/stored-protection-statistics-delivery';
import { ProtectionScopeIdSchema } from '../../types/protection-value';
import {
	cloneProtectionStatisticsDelivery,
	createEmptyProtectionStatisticsDelivery,
	prepareStatisticsDeliveryForTransition,
} from './index';

/**
 * Shared observation instant for statistics-delivery utility tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_OBSERVATION_TIME = 1_800_000_000_000;

/**
 * Scope shared by every fact in the utility test transition.
 * @since 0.1.0 Initial implementation.
 */
const TEST_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_default' );

/**
 * Valid transition facts covering every kind-specific observation-time field.
 * @since 0.1.0 Initial implementation.
 */
const TEST_FACTS = ProtectionFactSchema.array().parse( [
	{
		type: ProtectionFactType.PAUSE_TIME,
		factId: 'fact_pause',
		scopeId: TEST_SCOPE_ID,
		waitId: 'wait_1',
		ownerParticipantId: 'participant_1',
		ownerEpoch: 1,
		checkpointHighWaterMilliseconds: 1_000,
		acceptedDurationMilliseconds: 1_000,
		observedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
	},
	{
		type: ProtectionFactType.RECONSIDERED_VISIT,
		factId: 'fact_reconsidered',
		scopeId: TEST_SCOPE_ID,
		waitId: 'wait_1',
		participantId: 'participant_1',
		departureCause: DepartureCause.ACTIVE_SESSION_TAB_CLOSE,
		observedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
	},
	{
		type: ProtectionFactType.COMPLETED_WAIT,
		factId: 'fact_completed',
		scopeId: TEST_SCOPE_ID,
		waitId: 'wait_1',
		capturedWaitDurationMilliseconds: 10_000,
		completedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
		completionLocalDate: '2026-08-31',
	},
	{
		type: ProtectionFactType.ALLOWANCE_GRANTED,
		factId: 'fact_allowance',
		scopeId: TEST_SCOPE_ID,
		allowanceId: 'allowance_1',
		startedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
		expiresAtEpochMilliseconds: TEST_OBSERVATION_TIME + 300_000,
		allowanceDurationMilliseconds: 300_000,
	},
] );

/**
 * Creates one valid retained batch for utility tests.
 * @param index - Unique identifier suffix.
 * @return Validated retained protection-fact batch.
 * @since 0.1.0 Initial implementation.
 */
function createRetainedBatch( index: number ) {
	return ProtectionFactBatchSchema.parse( {
		batchId: `retained_${ String( index ) }`,
		scopeId: TEST_SCOPE_ID,
		measurementRevision: `revision_${ String( index ) }`,
		observedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
		facts: [ TEST_FACTS[ 1 ] ],
	} );
}

/**
 * Creates validated complete delivery around retained batches.
 * @param outbox - Retained FIFO batches.
 * @return Validated complete statistics delivery.
 * @since 0.1.0 Initial implementation.
 */
function createCompleteDelivery( outbox = [ createRetainedBatch( 1 ) ] ) {
	return StoredProtectionStatisticsDeliverySchema.parse( {
		status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
		outbox,
	} );
}

/**
 * Returns a valid current batch identifier.
 * @return Valid protection-fact batch identifier.
 * @since 0.1.0 Initial implementation.
 */
function createCurrentBatchId(): string {
	return 'batch_current';
}

/**
 * Throws the configured batch-factory failure.
 * @throws {Error} Always, to exercise delivery degradation.
 * @since 0.1.0 Initial implementation.
 */
function throwBatchFactoryFailure(): never {
	throw new Error( 'factory failed' );
}

/**
 * Returns an invalid batch identifier.
 * @return Invalid identifier fixture.
 * @since 0.1.0 Initial implementation.
 */
function createInvalidBatchId(): string {
	return 'bad id';
}

/**
 * Returns an identifier that collides with the retained head batch.
 * @return Colliding identifier fixture.
 * @since 0.1.0 Initial implementation.
 */
function createCollidingBatchId(): string {
	return 'retained_1';
}

describe( 'prepareProtectionStatisticsDelivery', () => {
	it( 'creates and deeply clones empty complete delivery', () => {
		const empty = createEmptyProtectionStatisticsDelivery();
		const cloned = cloneProtectionStatisticsDelivery( empty );

		expect( cloned ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [],
		} );
		expect( cloned ).not.toBe( empty );
		expect( cloned.outbox ).not.toBe( empty.outbox );
	} );

	it( 'appends one validated batch after retained FIFO entries', () => {
		const retainedBatch = createRetainedBatch( 1 );

		expect( prepareStatisticsDeliveryForTransition( {
			delivery: createCompleteDelivery( [ retainedBatch ] ),
			facts: TEST_FACTS,
			scopeId: TEST_SCOPE_ID,
			measurementRevision: 'revision_current',
			createProtectionFactBatchId: createCurrentBatchId,
		} ) ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.COMPLETE,
			outbox: [
				retainedBatch,
				{
					batchId: 'batch_current',
					scopeId: TEST_SCOPE_ID,
					measurementRevision: 'revision_current',
					observedAtEpochMilliseconds: TEST_OBSERVATION_TIME,
					facts: TEST_FACTS,
				},
			],
		} );
	} );

	it.each( [
		{ label: 'missing revision', revision: undefined, factory: createCurrentBatchId },
		{ label: 'invalid revision', revision: 'bad revision', factory: createCurrentBatchId },
		{
			label: 'throwing batch factory',
			revision: 'revision_current',
			factory: throwBatchFactoryFailure,
		},
		{ label: 'invalid batch identifier', revision: 'revision_current', factory: createInvalidBatchId },
		{ label: 'colliding batch identifier', revision: 'revision_current', factory: createCollidingBatchId },
	] )( 'marks delivery incomplete without replacing retained batches for $label', ( {
		revision,
		factory,
	} ) => {
		const delivery = createCompleteDelivery();

		expect( prepareStatisticsDeliveryForTransition( {
			delivery,
			facts: TEST_FACTS,
			scopeId: TEST_SCOPE_ID,
			measurementRevision: revision,
			createProtectionFactBatchId: factory,
		} ) ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: delivery.outbox,
		} );
	} );

	it( 'marks delivery incomplete when batch consistency validation fails unexpectedly', () => {
		const delivery = createCompleteDelivery();
		const mismatchedFacts = ProtectionFactSchema.array().parse( [
			TEST_FACTS[ 0 ],
			{
				...TEST_FACTS[ 1 ],
				observedAtEpochMilliseconds: TEST_OBSERVATION_TIME + 1,
			},
		] );

		expect( prepareStatisticsDeliveryForTransition( {
			delivery,
			facts: mismatchedFacts,
			scopeId: TEST_SCOPE_ID,
			measurementRevision: 'revision_current',
			createProtectionFactBatchId: createCurrentBatchId,
		} ) ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: delivery.outbox,
		} );
	} );

	it.each( [
		{
			label: 'an already incomplete delivery',
			delivery: StoredProtectionStatisticsDeliverySchema.parse( {
				status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
				outbox: [ createRetainedBatch( 1 ) ],
			} ),
		},
		{
			label: 'a full outbox',
			delivery: createCompleteDelivery( Array.from(
				{ length: MaximumStoredProtectionStatisticsDeliveryBatchCount },
				( _, index ) => createRetainedBatch( index ),
			) ),
		},
	] )( 'does not evict or call the batch factory for $label', ( { delivery } ) => {
		let factoryCalls = 0;

		/**
		 * Records an unexpected batch-factory call.
		 * @return Valid current batch identifier.
		 * @since 0.1.0 Initial implementation.
		 */
		function createCountedBatchId(): string {
			factoryCalls += 1;

			return 'batch_current';
		}

		const result = prepareStatisticsDeliveryForTransition( {
			delivery,
			facts: TEST_FACTS,
			scopeId: TEST_SCOPE_ID,
			measurementRevision: 'revision_current',
			createProtectionFactBatchId: createCountedBatchId,
		} );

		expect( result ).toEqual( {
			status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE,
			outbox: delivery.outbox,
		} );
		expect( factoryCalls ).toBe( 0 );
	} );
} );
