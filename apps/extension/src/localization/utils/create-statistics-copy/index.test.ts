import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createStatisticsCopy } from './index';

describe( 'createStatisticsCopy', () => {
	it( 'creates statistics copy and formats its metrics', () => {
		const copy = createStatisticsCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
		expect( copy.formatDuration( 3_900_000 ) ).toBe( '1 hour, 5 minutes' );
		expect( copy.formatEstimatedDuration( 3_600_000 ) ).toBe( 'About 1 hour' );
		expect( copy.formatCount( 1_234 ) ).toBe( '1,234' );
		expect( copy.estimationDescription ).toBe(
			'Estimated browsing time avoided on your selected websites, based on your prior focused use.',
		);
	} );
} );
