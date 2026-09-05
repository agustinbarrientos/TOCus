import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

/**
 * Background application startup double used by the entrypoint smoke test.
 * @since 0.1.0 Initial implementation.
 */
const startProtectionBackgroundApplication = vi.hoisted( () => vi.fn() );

vi.mock( 'wxt/browser', async () => {
	const { fakeBrowser: mockedBrowser } = await import( 'wxt/testing/fake-browser' );

	return { browser: mockedBrowser };
} );

vi.mock( '../../features/protection-runtime/services/protection-background-application', () => ( {
	startProtectionBackgroundApplication,
} ) );

import backgroundDefinition from './index';

describe( 'background entrypoint', () => {
	beforeEach( () => {
		fakeBrowser.reset();
		vi.clearAllMocks();
	} );

	it( 'starts the browser background application', () => {
		backgroundDefinition.main();

		expect( startProtectionBackgroundApplication ).toHaveBeenCalledWith( {
			browser: fakeBrowser,
		} );
	} );
} );
