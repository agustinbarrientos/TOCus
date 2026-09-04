import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { ToolbarBadgeDurationUnit } from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import { createLocalizedToolbarCopy } from './index';

describe( 'createLocalizedToolbarCopy', () => {
	it( 'creates toolbar copy synchronously from the selected local catalog slice', () => {
		const copy = createLocalizedToolbarCopy( Language.SPANISH_VOS );

		expect( copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title ).toBe(
			'Pausa: quedan 2 segundos',
		);
	} );
} );
