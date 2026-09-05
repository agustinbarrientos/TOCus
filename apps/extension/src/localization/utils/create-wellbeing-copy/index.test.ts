import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createWellbeingCopy } from './index';

describe( 'createWellbeingCopy', () => {
	it( 'creates wellbeing copy for every available-value combination', () => {
		const copy = createWellbeingCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatDuration( 30_000 ) ).toBe( '30 seconds' );
		expect( copy.formatSummary( { estimatedReclaimedTime: null, focusedPauseTime: null } ) ).toBe( copy.neutral );
		expect( copy.formatSummary( { estimatedReclaimedTime: null, focusedPauseTime: '4 minutes' } ) ).toContain( '4 minutes' );
		expect( copy.formatSummary( { estimatedReclaimedTime: '9 minutes', focusedPauseTime: null } ) ).toContain( '9 minutes' );
		expect( copy.formatSummary( { estimatedReclaimedTime: '9 minutes', focusedPauseTime: '4 minutes' } ) ).toContain( '9 minutes' );
	} );
} );
