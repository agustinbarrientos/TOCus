import { describe, expect, it, vi } from 'vitest';
import { createCurrentTabReader } from './index';
import { type CurrentTabReaderBrowserTab } from './types';

const INVALID_CURRENT_TAB_COLLECTIONS: ReadonlyArray<ReadonlyArray<CurrentTabReaderBrowserTab>> = [
	[],
	[ { id: -1, incognito: false, url: 'https://example.com/' } ],
	[ { id: 7, url: 'https://example.com/' } ],
	[ { id: 7, incognito: false } ],
];

describe( 'createCurrentTabReader', () => {
	it( 'reads only the active tab in the current window', async () => {
		const query = vi.fn().mockResolvedValue( [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/page',
			title: 'This must not be retained',
			favIconUrl: 'https://example.com/favicon.ico',
		} ] );
		const reader = createCurrentTabReader( { tabs: { query } } );

		await expect( reader.read() ).resolves.toEqual( {
			id: 7,
			incognito: false,
			url: 'https://example.com/page',
		} );
		expect( query ).toHaveBeenCalledWith( { active: true, currentWindow: true } );
	} );

	it( 'prefers the pending top-level destination during navigation', async () => {
		const reader = createCurrentTabReader( { tabs: { query: vi.fn().mockResolvedValue( [ {
			id: 7,
			incognito: false,
			url: 'https://previous.test/',
			pendingUrl: 'https://next.test/',
		} ] ) } } );

		await expect( reader.read() ).resolves.toMatchObject( { url: 'https://next.test/' } );
	} );

	it( 'preserves explicit private context for conservative eligibility handling', async () => {
		const reader = createCurrentTabReader( { tabs: { query: vi.fn().mockResolvedValue( [ {
			id: 7,
			incognito: true,
			url: 'https://private.test/',
		} ] ) } } );

		await expect( reader.read() ).resolves.toEqual( {
			id: 7,
			incognito: true,
			url: 'https://private.test/',
		} );
	} );

	it.each( INVALID_CURRENT_TAB_COLLECTIONS.map( ( tabs ) => ( { tabs } ) ) )(
		'returns null when active-tab metadata is unavailable or incomplete',
		async ( { tabs } ) => {
			const reader = createCurrentTabReader( { tabs: { query: vi.fn().mockResolvedValue( tabs ) } } );

			await expect( reader.read() ).resolves.toBeNull();
		},
	);

	it( 'returns null when active-tab lookup rejects', async () => {
		const reader = createCurrentTabReader( { tabs: {
			query: vi.fn().mockRejectedValue( new Error( 'activeTab unavailable' ) ),
		} } );

		await expect( reader.read() ).resolves.toBeNull();
	} );
} );
