import { describe, expect, it } from 'vitest';
import * as StatisticsDomain from './index';
import * as StatisticsUtilities from './utils';

describe( 'statistics public API', () => {
	it( 'exports validated entry points without exposing reducer internals', () => {
		expect( StatisticsDomain ).toHaveProperty( 'reduceStatistics' );
		expect( StatisticsDomain ).toHaveProperty( 'projectStatistics' );
		expect( StatisticsDomain ).toHaveProperty( 'restoreStatisticsSession' );
		expect( StatisticsDomain ).not.toHaveProperty( 'addStatisticsValues' );
		expect( StatisticsDomain ).not.toHaveProperty( 'applyStatisticsFactBatch' );
		expect( StatisticsUtilities ).not.toHaveProperty( 'recordStatisticsFocusedInterval' );
		expect( StatisticsUtilities ).not.toHaveProperty( 'resetStatistics' );
	} );
} );
