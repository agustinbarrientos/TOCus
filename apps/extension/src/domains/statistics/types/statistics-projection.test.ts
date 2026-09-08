import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	AvailableStatisticsProjectionSchema,
	type AvailableStatisticsProjection,
} from './statistics-projection';

/**
 * Complete available projection used to verify its numeric estimate contract.
 * @since 0.1.0 Initial implementation.
 */
const VALID_AVAILABLE_PROJECTION = {
	status: 'available',
	estimatedReclaimedMilliseconds: 0,
	focusedPauseMilliseconds: 0,
	reconsideredVisitCount: 0,
	completedWaitCount: 0,
	allowanceGrantedCount: 0,
};

describe( 'AvailableStatisticsProjectionSchema', () => {
	it.each( [ 0, 61_000, Number.MAX_SAFE_INTEGER ] )(
		'accepts a known reclaimed-time estimate of %i milliseconds',
		( estimatedReclaimedMilliseconds ) => {
			const result = AvailableStatisticsProjectionSchema.parse( {
				...VALID_AVAILABLE_PROJECTION,
				estimatedReclaimedMilliseconds,
			} );

			expect( result.estimatedReclaimedMilliseconds ).toBe( estimatedReclaimedMilliseconds );
			expectTypeOf<AvailableStatisticsProjection['estimatedReclaimedMilliseconds']>()
				.toEqualTypeOf<number>();
		},
	);

	it.each( [ null, undefined, -1, 0.5, Number.POSITIVE_INFINITY ] )(
		'rejects an absent or invalid reclaimed-time estimate %#',
		( estimatedReclaimedMilliseconds ) => {
			expect( AvailableStatisticsProjectionSchema.safeParse( {
				...VALID_AVAILABLE_PROJECTION,
				estimatedReclaimedMilliseconds,
			} ).success ).toBe( false );
		},
	);
} );
