import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createProtectedSiteItemCopy } from './index';

describe( 'createProtectedSiteItemCopy', () => {
	it( 'creates item copy and website-boundary messages', () => {
		const copy = createProtectedSiteItemCopy( createTestI18n() );

		expect( copy.formatBoundary( 'reddit.com', true ) ).toBe( 'Includes reddit.com and its subdomains' );
		expect( copy.formatBoundary( 'reddit.com', false ) ).toBe( 'Includes only reddit.com' );
		expect( copy.edit ).toBe( 'Manage this website' );
		expect( copy.behaviorLegend ).toBe( 'Pause behavior' );
		expect( copy.independentBehavior ).toBe( 'Give this website its own timing' );
		expect( copy.formatRemoveQuestion( 'Reddit' ) ).toBe( 'Remove Reddit?' );
	} );
} );
