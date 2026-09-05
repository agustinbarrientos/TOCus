import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createPopupCopy } from './index';

describe( 'createPopupCopy', () => {
	it( 'creates accurate local-first popup copy', () => {
		const copy = createPopupCopy( createTestI18n() );

		expect( copy.status ).toBe( 'Private by design' );
		expect( copy.foundationNote ).toBe( 'Your settings and statistics stay on this device.' );
	} );
} );
