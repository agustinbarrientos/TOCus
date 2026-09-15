import { describe, expect, it } from 'vitest';
import { createStatisticsPreviewCopy, createStatisticsPreviewFormatting } from './formatting';

describe( 'statistics preview formatting', () => {
	it( 'reuses serialized single-day labels in chart ranges after hydration', () => {
		const formatting = createStatisticsPreviewFormatting( 'en', {} );
		const copy = createStatisticsPreviewCopy( {
			languageTag: 'en', messages: {}, label: 'Example data',
			formatting: { ...formatting, dates: { ...formatting.dates, '2026-09-09': '9 Sept 2026' } },
		} );

		expect( copy.formatDate( '2026-09-09' ) ).toBe( '9 Sept 2026' );
		expect( copy.formatDateRange( '2026-09-09', '2026-09-09' ) ).toBe( '9 Sept 2026' );
	} );
} );
