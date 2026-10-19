import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createStatisticsCopy } from './index';
import { setupI18n } from '@lingui/core';
import { StatisticsChangeDirection, type StatisticsChange } from '../../../features/statistics/utils/calculate-statistics-change/types';
import { StatisticsRange } from '../../../features/statistics/utils/select-statistics-range/types';
import { Language } from '../../../domains/preferences/types';
import { loadLocalizationBundle } from '../../services/load-localization-bundle';

describe( 'createStatisticsCopy', () => {
	it( 'provides the daily empty heading and explanation separately', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy.dailyEmpty ).toBe( 'No activity in this period' );
		expect( copy.dailyEmptyDescription ).toBe( 'Your pauses and reconsidered visits will appear here.' );
	} );
	it( 'formats recorded calendar dates without shifting them into another day', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy.formatDate( '2026-09-14' ) ).toBe( 'Sep 14, 2026' );
		expect( copy.formatDate( '2026-01-01' ) ).toBe( 'Jan 1, 2026' );
		expect( copy.formatDateRange( '2026-09-14', '2026-09-14' ) ).toBe( 'Sep 14, 2026' );
		expect( copy.formatDateRange( '2025-12-31', '2026-01-01' ) ).toContain( 'Dec 31, 2025' );
		expect( copy.formatDateRange( '2025-12-31', '2026-01-01' ) ).toContain( 'Jan 1, 2026' );
	} );
	it( 'formats recorded local hours without applying the current timezone offset', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy.formatHour( 0 ) ).toBe( '00:00' );
		expect( copy.formatHour( 9 ) ).toBe( '09:00' );
		expect( copy.formatHour( 23 ) ).toBe( '23:00' );
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
			'Time spent pausing plus estimated browsing time avoided.',
		);
	} );

	it.each( [
		[ StatisticsRange.CURRENT_WEEK, { direction: StatisticsChangeDirection.UP, difference: 5, percentage: 25 }, '25% more than last week' ],
		[ StatisticsRange.CURRENT_WEEK, { direction: StatisticsChangeDirection.DOWN, difference: 5, percentage: 25 }, '25% fewer than last week' ],
		[ StatisticsRange.CURRENT_WEEK, { direction: StatisticsChangeDirection.SAME, difference: 0, percentage: 0 }, 'Same as last week' ],
		[ StatisticsRange.CURRENT_WEEK, { direction: StatisticsChangeDirection.UP, difference: 1, percentage: null }, '1 more than last week' ],
		[ StatisticsRange.CURRENT_WEEK, { direction: StatisticsChangeDirection.DOWN, difference: 2, percentage: null }, '2 fewer than last week' ],
		[ StatisticsRange.CURRENT_MONTH, { direction: StatisticsChangeDirection.UP, difference: 5, percentage: 25 }, '25% more than last month' ],
		[ StatisticsRange.CURRENT_MONTH, { direction: StatisticsChangeDirection.DOWN, difference: 5, percentage: 25 }, '25% fewer than last month' ],
		[ StatisticsRange.CURRENT_MONTH, { direction: StatisticsChangeDirection.SAME, difference: 0, percentage: 0 }, 'Same as last month' ],
		[ StatisticsRange.CURRENT_MONTH, { direction: StatisticsChangeDirection.UP, difference: 2, percentage: null }, '2 more than last month' ],
		[ StatisticsRange.CURRENT_MONTH, { direction: StatisticsChangeDirection.DOWN, difference: 1, percentage: null }, '1 fewer than last month' ],
		[ StatisticsRange.CURRENT_YEAR, { direction: StatisticsChangeDirection.UP, difference: 5, percentage: 25 }, '25% more than last year' ],
		[ StatisticsRange.CURRENT_YEAR, { direction: StatisticsChangeDirection.DOWN, difference: 5, percentage: 25 }, '25% fewer than last year' ],
		[ StatisticsRange.CURRENT_YEAR, { direction: StatisticsChangeDirection.SAME, difference: 0, percentage: 0 }, 'Same as last year' ],
		[ StatisticsRange.CURRENT_YEAR, { direction: StatisticsChangeDirection.UP, difference: 2, percentage: null }, '2 more than last year' ],
		[ StatisticsRange.CURRENT_YEAR, { direction: StatisticsChangeDirection.DOWN, difference: 1, percentage: null }, '1 fewer than last year' ],
	] as const )( 'formats %s changes as complete period-specific phrases: %s', ( range, change, expected ) => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy.formatTrend( change satisfies StatisticsChange, range ) ).toBe( expected );
	} );

	it( 'formats percentages and absolute changes with locale-sensitive numbers', () => {
		const i18n = setupI18n( { locale: 'fr', messages: { fr: {} } } );
		const copy = createStatisticsCopy( i18n, createLocalizationFormatters( 'fr' ) );
		expect( copy.formatTrend(
			{ direction: StatisticsChangeDirection.UP, difference: 1_234, percentage: null },
			StatisticsRange.CURRENT_WEEK,
		) )
			.toBe( '1\u202f234 more than last week' );
		expect( copy.formatTrend(
			{ direction: StatisticsChangeDirection.DOWN, difference: 1, percentage: 12.5 },
			StatisticsRange.CURRENT_MONTH,
		) )
			.toBe( '12,5\u00a0% fewer than last month' );
	} );

	it( 'has no previous-period trend for all time', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );
		expect( copy.formatTrend( { direction: StatisticsChangeDirection.UP, difference: 1, percentage: null }, StatisticsRange.ALL_TIME ) ).toBe( '' );
	} );

	it.each( [
		[ Language.ENGLISH, '25% fewer than last week', '1,234 more than last month', 'Same as last year' ],
		[ Language.SPANISH_TU, '25\u00a0% menos que la semana pasada', '1234 m\u00e1s que el mes pasado', 'Igual que el a\u00f1o pasado' ],
		[ Language.SPANISH_VOS, '25% menos que la semana pasada', '1.234 m\u00e1s que el mes pasado', 'Igual que el a\u00f1o pasado' ],
		[ Language.PORTUGUESE_BRAZIL, '25% a menos que na semana passada', '1.234 a mais que no m\u00eas passado', 'Igual ao ano passado' ],
		[ Language.PORTUGUESE_PORTUGAL, '25% a menos do que na semana passada', '1234 a mais do que no m\u00eas passado', 'Igual ao ano passado' ],
		[ Language.ITALIAN, '25% in meno rispetto alla settimana scorsa', '1234 in pi\u00f9 rispetto al mese scorso', "Come l'anno scorso" ],
		[ Language.FRENCH, '25\u00a0% de moins que la semaine derni\u00e8re', '1\u202f234 de plus que le mois dernier', "Comme l'ann\u00e9e derni\u00e8re" ],
		[ Language.GERMAN, '25\u00a0% weniger als letzte Woche', '1.234 mehr als letzten Monat', 'Genauso wie letztes Jahr' ],
		[ Language.JAPANESE, '\u5148\u9031\u3088\u308a25%\u5c11\u306a\u3044', '\u5148\u6708\u3088\u308a1,234\u4ef6\u591a\u3044', '\u6628\u5e74\u3068\u540c\u3058' ],
		[ Language.RUSSIAN, '\u041d\u0430 25\u00a0% \u043c\u0435\u043d\u044c\u0448\u0435, \u0447\u0435\u043c \u043d\u0430 \u043f\u0440\u043e\u0448\u043b\u043e\u0439 \u043d\u0435\u0434\u0435\u043b\u0435', '\u041d\u0430 1\u00a0234 \u0431\u043e\u043b\u044c\u0448\u0435, \u0447\u0435\u043c \u0432 \u043f\u0440\u043e\u0448\u043b\u043e\u043c \u043c\u0435\u0441\u044f\u0446\u0435', '\u0421\u0442\u043e\u043b\u044c\u043a\u043e \u0436\u0435, \u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0432 \u043f\u0440\u043e\u0448\u043b\u043e\u043c \u0433\u043e\u0434\u0443' ],
	] as const )( 'loads full translated trend templates from the %s catalog', async ( language, percentage, count, unchanged ) => {
		const { statistics: copy } = await loadLocalizationBundle( language );
		expect( copy.formatTrend(
			{ direction: StatisticsChangeDirection.DOWN, difference: 5, percentage: 25 },
			StatisticsRange.CURRENT_WEEK,
		) ).toBe( percentage );
		expect( copy.formatTrend(
			{ direction: StatisticsChangeDirection.UP, difference: 1_234, percentage: null },
			StatisticsRange.CURRENT_MONTH,
		) ).toBe( count );
		expect( copy.formatTrend(
			{ direction: StatisticsChangeDirection.SAME, difference: 0, percentage: 0 },
			StatisticsRange.CURRENT_YEAR,
		) ).toBe( unchanged );
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
