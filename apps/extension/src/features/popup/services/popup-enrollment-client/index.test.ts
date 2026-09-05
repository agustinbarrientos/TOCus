import { describe, expect, it, vi } from 'vitest';
import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor';
import { ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment';
import {
	PopupSiteEnrollmentRequestType,
	type PopupSiteEnrollmentRequest,
} from '../../types/site-enrollment';
import { createPopupEnrollmentClient } from './index';

describe( 'createPopupEnrollmentClient', () => {
	it.each( [ false, true ] )( 'sends enrollment synchronously with independent timing %s', async ( independent ) => {
		const response = Promise.withResolvers<unknown>();
		const sendMessage = vi.fn<( request: PopupSiteEnrollmentRequest ) => Promise<unknown>>()
			.mockReturnValue( response.promise );
		const client = createPopupEnrollmentClient( { runtime: { sendMessage } } );

		const result = client.add( 'https://example.com/feed', independent );

		expect( sendMessage ).toHaveBeenCalledExactlyOnceWith( {
			type: PopupSiteEnrollmentRequestType,
			siteInput: 'https://example.com/feed',
			independent,
		} );
		response.resolve( { status: ProtectedSiteEnrollmentStatus.ADDED } );
		await expect( result ).resolves.toEqual( { status: ProtectedSiteEnrollmentStatus.ADDED } );
	} );

	it.each( [ undefined, null, 42, {}, [ 'example.com' ] ] )( 'rejects malformed website input before sending a message', async ( input ) => {
		const sendMessage = vi.fn().mockResolvedValue( { status: ProtectedSiteEnrollmentStatus.ADDED } );
		const client = createPopupEnrollmentClient( { runtime: { sendMessage } } );

		const result = client.add( input, false );

		expect( sendMessage ).not.toHaveBeenCalled();
		await expect( result ).resolves.toEqual( { status: ProtectedSiteEnrollmentStatus.SAVE_ERROR } );
	} );

	it.each( [
		{ status: ProtectedSiteEnrollmentStatus.ADDED },
		{
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		},
		{ status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED },
		{ status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR },
		{ status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED },
		{ status: ProtectedSiteEnrollmentStatus.SAVE_ERROR },
	] )( 'returns the validated $status enrollment outcome', async ( response ) => {
		const client = createPopupEnrollmentClient( { runtime: {
			sendMessage: vi.fn().mockResolvedValue( response ),
		} } );

		await expect( client.add( 'example.com', false ) ).resolves.toEqual( response );
	} );

	it.each( [
		undefined,
		{ status: 'unknown' },
		{ status: ProtectedSiteEnrollmentStatus.ADDED, configuration: {} },
		{ status: ProtectedSiteEnrollmentStatus.REJECTED },
		{ status: ProtectedSiteEnrollmentStatus.REJECTED, reason: 'unknown' },
	] )( 'returns a save error when the runtime response is malformed', async ( response ) => {
		const client = createPopupEnrollmentClient( { runtime: {
			sendMessage: vi.fn().mockResolvedValue( response ),
		} } );

		await expect( client.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		} );
	} );

	it( 'returns a save error when runtime messaging rejects', async () => {
		const client = createPopupEnrollmentClient( { runtime: {
			sendMessage: vi.fn().mockRejectedValue( new Error( 'Background unavailable.' ) ),
		} } );

		await expect( client.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		} );
	} );

	it( 'returns a save error when runtime messaging throws before returning', async () => {
		const client = createPopupEnrollmentClient( { runtime: {
			sendMessage: vi.fn( () => {
				throw new Error( 'Runtime invalidated.' );
			} ),
		} } );

		await expect( client.add( 'example.com', false ) ).resolves.toEqual( {
			status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		} );
	} );
} );
