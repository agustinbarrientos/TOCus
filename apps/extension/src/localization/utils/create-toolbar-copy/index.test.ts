import { describe, expect, it } from 'vitest';
import { ToolbarBadgeDurationUnit } from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import { createTestI18n } from '../../__fixtures__';
import { createLocalizationFormatters } from '../create-localization-formatters';
import { createToolbarCopy } from './index';

describe( 'createToolbarCopy', () => {
	it( 'creates copy for every toolbar state', () => {
		const copy = createToolbarCopy( createTestI18n(), createLocalizationFormatters( 'en' ) );

		expect( copy.formatWaiting( 0, ToolbarBadgeDurationUnit.SECOND ).title ).toBe( 'Pause: complete' );
		expect( copy.formatWaiting( 2, ToolbarBadgeDurationUnit.MINUTE ).text ).toBe( 'P2m' );
		expect( copy.formatAllowance( 0, ToolbarBadgeDurationUnit.MINUTE ).text ).toBe( 'V0m' );
		expect( copy.formatAllowance( 1, ToolbarBadgeDurationUnit.LESS_THAN_MINUTE ).text ).toBe( 'V<1m' );
		expect( copy.formatAllowance( 2, ToolbarBadgeDurationUnit.MINUTE ).text ).toBe( 'V2m' );
		expect( copy.formatActiveTitle( 'Pause: complete' ) ).toBe( 'TOCus: Pause: complete' );
		expect( copy.formatMultipleIndicator( 2 ) ).toBeTruthy();
		expect( copy.formatMultipleIndicator( 120 ) ).toBeTruthy();
		expect( copy.formatMultipleActive( 2, '2' ).text ).toBe( '2' );
		expect( copy.formatMultipleActive( 2, '2' ).title ).toBe( '2 timers active' );
	} );
} );
