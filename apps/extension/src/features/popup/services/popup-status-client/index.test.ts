import { describe, expect, it, vi } from 'vitest';
import { PopupProjectionStatus } from '../../types/popup-projection';
import { PopupRuntimeRequestType, type PopupRuntimeRequest } from '../../types/runtime-message';
import { createPopupStatusClient } from './index';

const CURRENT_TAB = Object.freeze( {
	id: 7,
	incognito: false,
	url: 'https://example.com/',
} );

const AVAILABLE_PROJECTION = Object.freeze( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: 1_800_000_000_000,
	currentSite: { status: 'unprotected', identityHost: 'example.com' },
	activeScopes: [],
} as const );

describe( 'createPopupStatusClient', () => {
	it.each( [
		[ 'readStatus', PopupRuntimeRequestType.READ_STATUS ],
		[ 'refreshStatus', PopupRuntimeRequestType.REFRESH_STATUS ],
	] as const )( 'validates the response from %s', async ( method, type ) => {
		const sendMessage = vi.fn<( request: PopupRuntimeRequest ) => Promise<unknown>>()
			.mockResolvedValue( AVAILABLE_PROJECTION );
		const client = createPopupStatusClient( { runtime: { sendMessage } } );

		await expect( client[ method ]( CURRENT_TAB ) ).resolves.toEqual( AVAILABLE_PROJECTION );
		expect( sendMessage ).toHaveBeenCalledWith( { type, currentTab: CURRENT_TAB } );
	} );

	it( 'supports unavailable current-tab metadata', async () => {
		const sendMessage = vi.fn<( request: PopupRuntimeRequest ) => Promise<unknown>>()
			.mockResolvedValue( { status: PopupProjectionStatus.UNAVAILABLE } );
		const client = createPopupStatusClient( { runtime: { sendMessage } } );

		await expect( client.readStatus( null ) ).resolves.toEqual( {
			status: PopupProjectionStatus.UNAVAILABLE,
		} );
		expect( sendMessage ).toHaveBeenCalledWith( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: null,
		} );
	} );

	it.each( [
		{ status: PopupProjectionStatus.AVAILABLE },
		{ status: 'unknown' },
		undefined,
	] )( 'returns unavailable when the runtime response is malformed', async ( response ) => {
		const client = createPopupStatusClient( { runtime: {
			sendMessage: vi.fn().mockResolvedValue( response ),
		} } );

		await expect( client.readStatus( CURRENT_TAB ) ).resolves.toEqual( {
			status: PopupProjectionStatus.UNAVAILABLE,
		} );
	} );

	it( 'returns unavailable when runtime messaging rejects', async () => {
		const client = createPopupStatusClient( { runtime: {
			sendMessage: vi.fn().mockRejectedValue( new Error( 'Runtime unavailable.' ) ),
		} } );

		await expect( client.refreshStatus( CURRENT_TAB ) ).resolves.toEqual( {
			status: PopupProjectionStatus.UNAVAILABLE,
		} );
	} );
} );
