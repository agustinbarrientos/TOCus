import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enrichExtensionTabUrls } from './index';

const INTERRUPTION_PAGE_URL = 'chrome-extension://extension-id/interruption.html';
const INTERRUPTION_CONTEXT = Object.freeze( {
	contextType: 'TAB',
	documentUrl: INTERRUPTION_PAGE_URL,
	frameId: 0,
	incognito: false,
	tabId: 7,
} );

describe( 'enrichExtensionTabUrls', () => {
	beforeEach( () => {
		vi.clearAllMocks();
	} );

	it( 'enriches only queried tabs from exact top-level interruption contexts without mutating input', async () => {
		const tabs = Object.freeze( [ Object.freeze( { id: 7, incognito: false, windowId: 3 } ) ] );
		const runtime = {
			getContexts: vi.fn().mockResolvedValue( [ INTERRUPTION_CONTEXT, { ...INTERRUPTION_CONTEXT, tabId: 9 } ] ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toEqual( [ {
			id: 7,
			incognito: false,
			url: INTERRUPTION_PAGE_URL,
			windowId: 3,
		} ] );
		expect( tabs ).toEqual( [ { id: 7, incognito: false, windowId: 3 } ] );
		expect( runtime.getContexts ).toHaveBeenCalledExactlyOnceWith( { contextTypes: [ 'TAB' ] } );
		expect( runtime.getURL ).toHaveBeenCalledExactlyOnceWith( '/interruption.html' );
	} );

	it.each( [
		{ url: 'https://example.com/' },
		{ pendingUrl: 'https://example.com/' },
		{ url: INTERRUPTION_PAGE_URL },
		{ url: '' },
		{ pendingUrl: '' },
	] )( 'preserves explicit URL fields and avoids context lookup for $url $pendingUrl', async ( fields ) => {
		const tabs = [ { id: 7, incognito: false, ...fields } ];
		const runtime = {
			getContexts: vi.fn().mockResolvedValue( [ INTERRUPTION_CONTEXT ] ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toBe( tabs );
		expect( runtime.getContexts ).not.toHaveBeenCalled();
	} );

	it( 'preserves explicit destinations when another queried tab needs context lookup', async () => {
		const tabs = [
			{ id: 7, incognito: false, url: 'https://example.com/' },
			{ id: 8, incognito: false, pendingUrl: 'https://next.test/' },
			{ id: 9, incognito: false },
		];
		const runtime = {
			getContexts: vi.fn().mockResolvedValue( tabs.map( ( tab ) => ( {
				...INTERRUPTION_CONTEXT,
				tabId: tab.id,
			} ) ) ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toEqual( [
			tabs[ 0 ],
			tabs[ 1 ],
			{ id: 9, incognito: false, url: INTERRUPTION_PAGE_URL },
		] );
	} );

	it.each( [
		{ contextType: 'POPUP' },
		{ frameId: 1 },
		{ tabId: 8 },
		{ incognito: true },
		{ documentUrl: 'chrome-extension://extension-id/options.html' },
		{ documentUrl: 'chrome-extension://other-extension/interruption.html' },
		{ documentUrl: `${ INTERRUPTION_PAGE_URL }?destination=example.com` },
		{ documentUrl: `${ INTERRUPTION_PAGE_URL }#fragment` },
		{ documentUrl: 'https://example.com/interruption.html' },
		{ documentUrl: undefined },
	] )( 'does not infer a URL from an unrelated context %j', async ( fields ) => {
		const tabs = [ { id: 7, incognito: false } ];
		const runtime = {
			getContexts: vi.fn().mockResolvedValue( [ { ...INTERRUPTION_CONTEXT, ...fields } ] ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toEqual( tabs );
	} );

	it.each( [ { incognito: false }, { id: -1, incognito: false }, { id: 1.5, incognito: false }, { id: 7 } ] )(
		'does not enrich tabs without a live identifier and explicit privacy %j',
		async ( tab ) => {
			const tabs = [ tab ];
			const runtime = {
				getContexts: vi.fn().mockResolvedValue( [ INTERRUPTION_CONTEXT ] ),
				getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
			};

			await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toBe( tabs );
			expect( runtime.getContexts ).not.toHaveBeenCalled();
		},
	);

	it( 'matches an explicitly private tab only to its own private context', async () => {
		const tabs = [ { id: 7, incognito: true } ];
		const runtime = {
			getContexts: vi.fn().mockResolvedValue( [ { ...INTERRUPTION_CONTEXT, incognito: true } ] ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toEqual( [ {
			id: 7,
			incognito: true,
			url: INTERRUPTION_PAGE_URL,
		} ] );
	} );

	it( 'uses fresh contexts on every observation and forgets a disappeared document', async () => {
		const tabs = [ { id: 7, incognito: false } ];
		const runtime = {
			getContexts: vi.fn().mockResolvedValueOnce( [ INTERRUPTION_CONTEXT ] ).mockResolvedValueOnce( [] ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toEqual( [ {
			...tabs[ 0 ],
			url: INTERRUPTION_PAGE_URL,
		} ] );
		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toEqual( tabs );
		expect( runtime.getContexts ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'preserves tabs when runtime context lookup is unsupported', async () => {
		const tabs = [ { id: 7, incognito: false } ];

		await expect( enrichExtensionTabUrls( tabs, undefined ) ).resolves.toBe( tabs );
		await expect( enrichExtensionTabUrls( tabs, { getURL: vi.fn() } ) ).resolves.toBe( tabs );
	} );

	it( 'preserves tabs when context lookup rejects', async () => {
		const tabs = [ { id: 7, incognito: false } ];
		const runtime = {
			getContexts: vi.fn().mockRejectedValue( new Error( 'Context lookup unavailable' ) ),
			getURL: vi.fn().mockReturnValue( INTERRUPTION_PAGE_URL ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toBe( tabs );
	} );

	it( 'preserves tabs when runtime URL resolution throws', async () => {
		const tabs = [ { id: 7, incognito: false } ];
		const runtime = {
			getContexts: vi.fn().mockResolvedValue( [ INTERRUPTION_CONTEXT ] ),
			getURL: vi.fn( () => {
				throw new Error( 'Runtime unavailable' );
			} ),
		};

		await expect( enrichExtensionTabUrls( tabs, runtime ) ).resolves.toBe( tabs );
	} );
} );
