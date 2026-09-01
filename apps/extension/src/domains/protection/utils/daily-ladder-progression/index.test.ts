import { ZodError } from 'zod';
import { describe, expect, it } from 'vitest';
import { advanceDailyLadder, synchronizeDailyLadder } from './index';

const VALID_DAILY_LADDER = Object.freeze( {
	completedWaits: 0,
	greatestObservedLocalDate: '2026-08-31',
} );

describe( 'synchronizeDailyLadder', () => {
	describe( 'local-date observations', () => {
		it( 'preserves completed waits on the same local date', () => {
			expect(
				synchronizeDailyLadder(
					{ completedWaits: 4, greatestObservedLocalDate: '2026-08-31' },
					'2026-08-31',
				),
			).toEqual( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );

		it( 'preserves completed waits and the greatest date after a backward observation', () => {
			expect(
				synchronizeDailyLadder(
					{ completedWaits: 4, greatestObservedLocalDate: '2026-08-31' },
					'2026-08-30',
				),
			).toEqual( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );

		it( 'resets completed waits once on a later local date', () => {
			expect(
				synchronizeDailyLadder(
					{ completedWaits: 4, greatestObservedLocalDate: '2026-08-31' },
					'2026-09-01',
				),
			).toEqual( {
				completedWaits: 0,
				greatestObservedLocalDate: '2026-09-01',
			} );
		} );

		it( 'accepts a canonical leap day as a later local date', () => {
			expect(
				synchronizeDailyLadder(
					{ completedWaits: 2, greatestObservedLocalDate: '2028-02-28' },
					'2028-02-29',
				),
			).toEqual( {
				completedWaits: 0,
				greatestObservedLocalDate: '2028-02-29',
			} );
		} );

		it( 'preserves the greatest date through backward and later-forward observations', () => {
			const afterBackward = synchronizeDailyLadder(
				{ completedWaits: 3, greatestObservedLocalDate: '2026-08-31' },
				'2026-08-30',
			);
			const afterSame = synchronizeDailyLadder( afterBackward, '2026-08-31' );

			expect( synchronizeDailyLadder( afterSame, '2026-09-01' ) ).toEqual( {
				completedWaits: 0,
				greatestObservedLocalDate: '2026-09-01',
			} );
		} );

		it( 'synchronizes the ladder without advancing it', () => {
			expect(
				synchronizeDailyLadder(
					{ completedWaits: 3, greatestObservedLocalDate: '2026-08-31' },
					'2026-08-31',
				),
			).toEqual( {
				completedWaits: 3,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );
	} );

	describe( 'public-boundary validation', () => {
		it.each( [ null, undefined, '', '2026-8-31', '2026-02-29', '2026-13-01', '2026-08-31T00:00:00Z' ] )(
			'rejects invalid local date input %#',
			( localDate ) => {
				expect( () => synchronizeDailyLadder( VALID_DAILY_LADDER, localDate ) ).toThrow( ZodError );
			},
		);

		it.each( [
			null,
			undefined,
			{},
			{ completedWaits: -1, greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: 1, greatestObservedLocalDate: '2026-02-29' },
			{ completedWaits: 1, greatestObservedLocalDate: '2026-08-31', extra: true },
		] )( 'rejects invalid ladder input %#', ( ladder ) => {
			expect( () => synchronizeDailyLadder( ladder, '2026-08-31' ) ).toThrow( ZodError );
		} );
	} );

	describe( 'immutability', () => {
		it( 'does not mutate a frozen ladder', () => {
			const ladder = Object.freeze( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );

			expect( () => synchronizeDailyLadder( ladder, '2026-09-01' ) ).not.toThrow();
			expect( ladder ).toEqual( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );
	} );
} );

describe( 'advanceDailyLadder', () => {
	describe( 'completed waits', () => {
		it( 'increments the completion count on the same date', () => {
			expect(
				advanceDailyLadder(
					{ completedWaits: 4, greatestObservedLocalDate: '2026-08-31' },
					'2026-08-31',
				),
			).toEqual( {
				completedWaits: 5,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );

		it( 'increments below the safe counter limit', () => {
			expect(
				advanceDailyLadder(
					{ completedWaits: 1_000, greatestObservedLocalDate: '2026-08-31' },
					'2026-08-31',
				),
			).toEqual( {
				completedWaits: 1_001,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );

		it.each( [ '2026-08-31', '2026-08-30' ] )(
			'saturates an exhausted completion counter for completion date %s',
			( completionLocalDate ) => {
				expect(
					advanceDailyLadder(
						{
							completedWaits: Number.MAX_SAFE_INTEGER,
							greatestObservedLocalDate: '2026-08-31',
						},
						completionLocalDate,
					),
				).toEqual( {
					completedWaits: Number.MAX_SAFE_INTEGER,
					greatestObservedLocalDate: '2026-08-31',
				} );
			},
		);

		it( 'increments the current ladder after a backward completion date', () => {
			expect(
				advanceDailyLadder(
					{ completedWaits: 4, greatestObservedLocalDate: '2026-08-31' },
					'2026-08-30',
				),
			).toEqual( {
				completedWaits: 5,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );

		it( 'resets and counts the completion on a later date', () => {
			expect(
				advanceDailyLadder(
					{ completedWaits: 4, greatestObservedLocalDate: '2026-08-31' },
					'2026-09-01',
				),
			).toEqual( {
				completedWaits: 1,
				greatestObservedLocalDate: '2026-09-01',
			} );
		} );

		it( 'counts a wait crossing midnight toward its supplied completion date', () => {
			expect(
				advanceDailyLadder(
					{ completedWaits: 7, greatestObservedLocalDate: '2026-08-31' },
					'2026-09-01',
				),
			).toEqual( {
				completedWaits: 1,
				greatestObservedLocalDate: '2026-09-01',
			} );
		} );
	} );

	describe( 'public-boundary validation', () => {
		it.each( [ null, undefined, '', '2026-8-31', '2026-02-29', '2026-13-01', '2026-08-31T00:00:00Z' ] )(
			'rejects invalid completion date input %#',
			( localDate ) => {
				expect( () => advanceDailyLadder( VALID_DAILY_LADDER, localDate ) ).toThrow( ZodError );
			},
		);

		it.each( [
			null,
			undefined,
			{},
			{ completedWaits: -1, greatestObservedLocalDate: '2026-08-31' },
			{ completedWaits: 1, greatestObservedLocalDate: '2026-02-29' },
			{ completedWaits: 1, greatestObservedLocalDate: '2026-08-31', extra: true },
		] )( 'rejects invalid ladder input %#', ( ladder ) => {
			expect( () => advanceDailyLadder( ladder, '2026-08-31' ) ).toThrow( ZodError );
		} );
	} );

	describe( 'immutability', () => {
		it( 'does not mutate a frozen ladder', () => {
			const ladder = Object.freeze( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );

			expect( () => advanceDailyLadder( ladder, '2026-09-01' ) ).not.toThrow();
			expect( ladder ).toEqual( {
				completedWaits: 4,
				greatestObservedLocalDate: '2026-08-31',
			} );
		} );
	} );
} );
