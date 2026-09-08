import { describe, expect, it } from 'vitest';
import { CompletionAction } from '../../../domains/protection/types/completion-action';
import { createTestI18n } from '../../__fixtures__';
import { createTimingCopy } from './index';

describe( 'createTimingCopy', () => {
	it( 'creates timing copy and both completion summaries', () => {
		const copy = createTimingCopy( createTestI18n() );

		expect( copy.title ).toBe( 'Pause timing' );
		expect( copy.allowanceHelp ).toBe(
			'This time starts when you choose Continue or the site opens automatically.',
		);
		expect( copy.noWaitIncrease ).toBe( '0 (no increase)' );
		expect( copy.save ).toBe( 'Save' );
		expect( copy.discard ).toBe( 'Discard' );
		expect( copy.saving ).toBe( 'Saving...' );
		expect( copy.saved ).toBe( 'Changes saved.' );
		expect( copy.formatSecondsOption( 2 ) ).toBe( '2 seconds' );
		expect( copy.formatMinutesOption( 2 ) ).toBe( '2 minutes' );
		expect( copy.formatSummary( 5, 5, 60, 5, CompletionAction.SHOW_CONTINUE ) ).toBe(
			'Waits start at 5 seconds. Each completed wait adds 5 seconds to the next wait, up to 60 seconds. After the wait, choosing Continue starts an allowance for 5 minutes.',
		);
		expect( copy.formatSummary( 5, 5, 60, 5, CompletionAction.OPEN_AUTOMATICALLY ) ).toBe(
			'Waits start at 5 seconds. Each completed wait adds 5 seconds to the next wait, up to 60 seconds. When the site opens automatically after the wait, an allowance starts for 5 minutes.',
		);
		expect( copy.formatSummary( 5, 0, 60, 5, CompletionAction.SHOW_CONTINUE ) ).toBe(
			'Waits stay at 5 seconds. After the wait, choosing Continue starts an allowance for 5 minutes.',
		);
		expect( copy.formatSummary( 5, 0, 60, 5, CompletionAction.OPEN_AUTOMATICALLY ) ).toBe(
			'Waits stay at 5 seconds. When the site opens automatically after the wait, an allowance starts for 5 minutes.',
		);
	} );
} );
