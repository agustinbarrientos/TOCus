import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createProtectedPageLayerCopy } from './index';

describe( 'createProtectedPageLayerCopy', () => {
	it( 'creates protected-page copy and allowance warnings', () => {
		const copy = createProtectedPageLayerCopy( createTestI18n() );

		expect( copy.dialogLabel ).toBe( 'TOCus pause' );
		expect( copy.formatAllowanceWarning( 1 ) ).toBe( 'Your visit window ends in 1 second.' );
		expect( copy.formatAllowanceWarning( 2 ) ).toBe( 'Your visit window ends in 2 seconds.' );
	} );
} );
