import { setupI18n } from '@lingui/core';
import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { createTestI18n } from '../../__fixtures__';
import { loadLocalizationMessages } from '../../services/load-localization-messages';
import { createInterruptionCopy } from './index';

describe( 'createInterruptionCopy', () => {
	it( 'creates interruption copy and countdown grammar', () => {
		const copy = createInterruptionCopy( createTestI18n() );

		expect( copy.takeAMoment ).toBe( 'Take a moment' );
		expect( copy.formatRemainingTime( 1 ) ).toBe( '1s' );
		expect( copy.formatRemainingTime( 2 ) ).toBe( '2s' );
	} );

	it.each( [
		[ 3_600_000, 'You saved 1 hour!' ],
		[ 5_400_000, 'You saved 1 hour, 30 minutes!' ],
		[ 7_200_000, 'You saved 2 hours!' ],
		[ 7_260_000, 'You saved 2 hours, 1 minute!' ],
		[ 3_659_999, 'You saved 1 hour!' ],
	] )( 'shows the actual saved duration without rounding up at %i milliseconds', ( milliseconds, expected ) => {
		const copy = createInterruptionCopy( createTestI18n() );

		expect( copy.formatReviewTitle ).toBeTypeOf( 'function' );
		expect( copy.formatReviewTitle( milliseconds ) ).toBe( expected );
	} );

	it.each( Object.values( Language ) )( 'localizes the review invitation and permanent dismissal in %s', async ( language ) => {
		const messages = await loadLocalizationMessages( language );
		const languageTag = getLanguageTag( language );
		const copy = createInterruptionCopy( setupI18n( {
			locale: languageTag,
			messages: { [ languageTag ]: messages },
		} ) );
		const englishCopy = createInterruptionCopy( createTestI18n() );
		const reviewFields = [
			'reviewMessage',
			'reviewActionLabel',
			'reviewDismissLabel',
			'reviewDismissError',
		] as const;

		for ( const field of reviewFields ) {
			expect( copy[ field ], `${ language }: ${ field }` ).toBeTruthy();
			if ( language !== Language.ENGLISH ) {
				expect( copy[ field ] ).not.toBe( englishCopy[ field ] );
			}
		}

		expect( copy.formatReviewTitle ).toBeTypeOf( 'function' );
		const title = copy.formatReviewTitle( 5_400_000 );
		expect( title ).toContain( '1' );
		expect( title ).toContain( '30' );
		expect( title ).not.toContain( '{duration}' );
		if ( language !== Language.ENGLISH ) {
			expect( title ).not.toBe( englishCopy.formatReviewTitle( 5_400_000 ) );
			expect( title ).not.toContain( 'hour' );
		}
	} );
} );
