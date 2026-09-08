import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createPopupCopy } from './index';

describe( 'createPopupCopy', () => {
	it( 'creates complete status and action copy for the live popup', () => {
		const copy = createPopupCopy( createTestI18n() );

		expect( copy.currentWebsite ).toBe( 'Current website' );
		expect( copy.siteNotOnList ).toBe( 'Site not on the list' );
		expect( copy.tocusActive ).toBe( 'TOCus is active' );
		expect( copy.pauseSite ).toBe( 'Pause site' );
		expect( copy.manageWebsite ).toBe( 'Manage this website' );
		expect( copy.timeLeft ).toBe( 'Time left' );
		expect( copy.statistics ).toBe( 'Statistics' );
		expect( copy.settings ).toBe( 'Settings' );
		expect( copy.retrying ).toBe( 'Trying again...' );
		expect( copy.permissionRetainedError )
			.toBe( 'This website could not be saved. Its browser access may still be active.' );
	} );

	it( 'formats nonnegative localized countdowns', () => {
		const copy = createPopupCopy( createTestI18n() );

		expect( copy.formatCountdown( 8_000 ) ).toBe( '0:08' );
		expect( copy.formatCountdown( 240_000 ) ).toBe( '4:00' );
		expect( copy.formatCountdown( Number.NaN ) ).toBe( '0:00' );
		expect( copy.formatCountdown( -1_000 ) ).toBe( '0:00' );
	} );
} );
