import { describe, expect, it } from 'vitest';
import { StatisticsLoadState } from '../../services/settings-screen-state/types';
import { resolveStatisticsFeedback } from './index';

const copy = {
	unavailableTitle: 'Local statistics are unavailable',
	unavailableDescription: 'Retry reading the local totals.',
	resetErrorTitle: 'Statistics were not reset',
	resetErrorDescription: 'Retry the confirmed reset.',
};

describe( 'Statistics recovery feedback', () => {
	it.each( [ StatisticsLoadState.LOADING, StatisticsLoadState.READY ] )(
		'keeps failure feedback absent while statistics are %s', ( state ) => {
			expect( resolveStatisticsFeedback( state, copy ) ).toBeNull();
		},
	);

	it( 'explains that a failed read can be retried without claiming totals were reset', () => {
		expect( resolveStatisticsFeedback( StatisticsLoadState.FAILED, copy ) ).toEqual( {
			title: 'Local statistics are unavailable',
			description: 'Retry reading the local totals.',
		} );
	} );

	it( 'preserves reset-specific recovery instead of reporting a generic read failure', () => {
		expect( resolveStatisticsFeedback( StatisticsLoadState.RESET_FAILED, copy ) ).toEqual( {
			title: 'Statistics were not reset',
			description: 'Retry the confirmed reset.',
		} );
	} );
} );
