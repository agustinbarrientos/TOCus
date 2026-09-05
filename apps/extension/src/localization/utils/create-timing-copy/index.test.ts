import { describe, expect, it } from 'vitest';
import { CompletionAction } from '../../../domains/protection/types/completion-action';
import { createTestI18n } from '../../__fixtures__';
import { createTimingCopy } from './index';

describe( 'createTimingCopy', () => {
	it( 'creates timing copy and both completion summaries', () => {
		const copy = createTimingCopy( createTestI18n() );

		expect( copy.formatSecondsOption( 2 ) ).toBe( '2 seconds' );
		expect( copy.formatMinutesOption( 2 ) ).toBe( '2 minutes' );
		expect( copy.formatSummary( 5, 5, 60, 5, CompletionAction.SHOW_CONTINUE ) ).toContain( 'Continue button' );
		expect( copy.formatSummary( 5, 5, 60, 5, CompletionAction.OPEN_AUTOMATICALLY ) ).toContain( 'automatically' );
	} );
} );
