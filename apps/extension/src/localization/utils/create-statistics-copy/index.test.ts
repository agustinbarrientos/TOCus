import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createStatisticsCopy } from './index';

describe( 'createStatisticsCopy', () => {
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
		[ 0, 'Approximately 0 minutes' ],
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
	] )( 'rounds estimates to the nearest minute while preserving zero and subminute values for %i milliseconds', ( milliseconds, expected ) => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatEstimatedDuration( milliseconds ) ).toBe( expected );
	} );
} );
