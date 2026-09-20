import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { createTestI18n } from '../../__fixtures__';
import { loadLocalizationBundle } from '../../services/load-localization-bundle';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createWellbeingCopy } from './index';

describe( 'createWellbeingCopy', () => {
	it( 'creates wellbeing copy for every available-value combination', () => {
		const copy = createWellbeingCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatDuration( 30_000 ) ).toBe( '30 seconds' );
		expect( copy.formatShortDuration( 30_000 ) ).toBe( '30 sec' );
		expect( copy.formatShortDuration( 900_000 ) ).toBe( '15 min' );
		expect( copy.formatShortDuration( 3_600_000 ) ).toBe( '1 hr' );
		expect( copy.formatShortDuration( 3_900_000 ) ).toBe( '1 hr, 5 min' );
		expect( copy.formatShortSummary( '15 min' ) ).toBe( 'About 15 min saved.' );
		expect( copy.formatSummary( { estimatedReclaimedTime: null, focusedPauseTime: null } ) ).toBe( copy.neutral );
		expect( copy.formatSummary( { estimatedReclaimedTime: null, focusedPauseTime: '4 minutes' } ) ).toContain( '4 minutes' );
		expect( copy.formatSummary( { estimatedReclaimedTime: '9 minutes', focusedPauseTime: null } ) ).toContain( '9 minutes' );
		expect( copy.formatSummary( { estimatedReclaimedTime: '9 minutes', focusedPauseTime: '4 minutes' } ) ).toBe(
			"Since you started, you've given yourself about 9 minutes back, including 4 minutes spent pausing.",
		);
	} );

	it.each( [
		{
			language: Language.SPANISH_TU,
			minutes: 'Ahorraste aprox. 15 min.',
			hour: 'Ahorraste aprox. 1 h.',
		},
		{
			language: Language.SPANISH_VOS,
			minutes: 'Ahorraste aprox. 15 min.',
			hour: 'Ahorraste aprox. 1 h.',
		},
		{
			language: Language.PORTUGUESE_BRAZIL,
			minutes: 'Voc\u00ea economizou cerca de 15 min.',
			hour: 'Voc\u00ea economizou cerca de 1 h.',
		},
		{
			language: Language.PORTUGUESE_PORTUGAL,
			minutes: 'Poupou cerca de 15 min.',
			hour: 'Poupou cerca de 1 h.',
		},
		{
			language: Language.ITALIAN,
			minutes: 'Hai risparmiato circa 15 min.',
			hour: 'Hai risparmiato circa 1 h.',
		},
		{
			language: Language.FRENCH,
			minutes: 'Gain estim\u00e9 : 15\u00a0min.',
			hour: 'Gain estim\u00e9 : 1\u202fh.',
		},
	] )( 'keeps compact wellbeing estimates unit-independent in $language', async ( expectation ) => {
		const copy = ( await loadLocalizationBundle( expectation.language ) ).wellbeing;

		expect( copy.formatShortSummary( copy.formatShortDuration( 900_000 ) ) ).toBe( expectation.minutes );
		expect( copy.formatShortSummary( copy.formatShortDuration( 3_600_000 ) ) ).toBe( expectation.hour );
	} );
} );
