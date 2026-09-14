import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createStatisticsCopy } from './index';
import { setupI18n } from '@lingui/core';

describe( 'createStatisticsCopy', () => {
	it( 'formats recorded calendar dates without shifting them into another day', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy.formatDate( '2026-09-14' ) ).toBe( 'Sep 14' );
		expect( copy.formatDate( '2026-01-01' ) ).toBe( 'Jan 1' );
	} );

	it.each( [
		[ 0, '0s' ],
		[ 1, '0.001s' ],
		[ 5_000, '5s' ],
		[ 15_000, '15s' ],
		[ 30_000, '30s' ],
		[ 60_000, '1m' ],
		[ 90_000, '1.5m' ],
		[ 3_600_000, '1h' ],
		[ 9_000_000, '2.5h' ],
		[ 3_600_000_000_000, '1Mh' ],
	] )( 'keeps an axis tick of %i milliseconds compact and distinguishable', ( milliseconds, expected ) => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy ).toHaveProperty( 'formatAxisDuration', expect.any( Function ) );
		expect( copy.formatAxisDuration( milliseconds ) ).toBe( expected );
		expect( copy.formatDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
	} );

	it( 'localizes compact chart units and decimal separators', () => {
		const i18n = setupI18n( { locale: 'fr', messages: { fr: {} } } );
		const copy = createStatisticsCopy( i18n, createLocalizationFormatters( 'fr' ) );
		expect( copy ).toHaveProperty( 'formatAxisDuration', expect.any( Function ) );
		expect( copy.formatAxisDuration( 90_000 ) ).toBe( '1,5min' );
	} );
	it( 'creates statistics copy and formats its metrics', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
		expect( copy.formatDuration( 3_900_000 ) ).toBe( '1 hour, 5 minutes' );
		expect( copy.formatEstimatedDuration( 3_600_000 ) ).toBe( 'Approximately 1 hour' );
		expect( copy.formatCount( 1_234 ) ).toBe( '1,234' );
		expect( copy.estimationDescription ).toBe(
			'Time spent pausing plus estimated browsing time avoided, based on your configured visit time.',
		);
	} );

	it.each( [
		[ 0, 'Not enough data yet' ],
		[ 1, 'Less than 1 minute' ],
		[ 30_000, 'Less than 1 minute' ],
		[ 59_999, 'Less than 1 minute' ],
		[ 60_000, 'Approximately 1 minute' ],
		[ 89_999, 'Approximately 1 minute' ],
		[ 90_000, 'Approximately 2 minutes' ],
		[ 100_000, 'Approximately 2 minutes' ],
		[ 119_999, 'Approximately 2 minutes' ],
		[ 3_599_999, 'Approximately 1 hour' ],
		[ 3_659_999, 'Approximately 1 hour, 1 minute' ],
		[ 4_080_000, 'Approximately 1 hour, 8 minutes' ],
	] )( 'distinguishes missing estimates from positive durations for %i milliseconds', ( milliseconds, expected ) => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatEstimatedDuration( milliseconds ) ).toBe( expected );
	} );
} );
