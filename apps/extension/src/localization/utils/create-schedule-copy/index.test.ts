import { describe, expect, it } from 'vitest';
import { Weekday } from '../../../domains/protection/types/protection-schedule';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createScheduleCopy } from './index';

describe( 'createScheduleCopy', () => {
	it( 'creates schedule copy and locale-sensitive formatters', () => {
		const copy = createScheduleCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.title ).toBe( 'Schedule' );
		expect( copy.sharedScope ).toBe( 'Shared timing' );
		expect( copy.formatWeekday( Weekday.MONDAY ) ).toBe( 'Monday' );
		expect( copy.formatWindowLabel( 2 ) ).toBe( 'Time window 2' );
		expect( copy.formatRemoveWindowLabel( 2 ) ).toBe( 'Remove time window 2' );
		expect( copy.formatIndependentScopeLabel( 'Reddit', 'reddit.com' ) ).toBe( 'Reddit (reddit.com)' );
		expect( copy.compareNames( 'a', 'b' ) ).toBeLessThan( 0 );
	} );
} );
