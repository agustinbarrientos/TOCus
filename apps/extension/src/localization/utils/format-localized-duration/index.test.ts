import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { createLocalizationFormatters } from '../create-localization-formatters';
import {
	DurationUnit,
	formatDurationUnit,
	formatMinuteDuration,
} from './index';

describe( 'localized duration formatting', () => {
	it( 'formats singular and plural duration units', () => {
		const i18n = setupI18n( { locale: 'en', messages: { en: {} } } );

		expect( formatDurationUnit( i18n, 1, DurationUnit.SECOND ) ).toBe( '1 second' );
		expect( formatDurationUnit( i18n, 2, DurationUnit.MINUTE ) ).toBe( '2 minutes' );
		expect( formatDurationUnit( i18n, 3, DurationUnit.HOUR ) ).toBe( '3 hours' );
	} );

	it( 'combines hours and remaining minutes with locale list rules', () => {
		const i18n = setupI18n( { locale: 'en', messages: { en: {} } } );
		const formatters = createLocalizationFormatters( 'en' );

		expect( formatMinuteDuration( i18n, 5, formatters ) ).toBe( '5 minutes' );
		expect( formatMinuteDuration( i18n, 60, formatters ) ).toBe( '1 hour' );
		expect( formatMinuteDuration( i18n, 65, formatters ) ).toBe( '1 hour, 5 minutes' );
	} );
} );
