import { describe, expect, it } from 'vitest';
import {
	ProtectedPageMessageSchema,
	ProtectedPageMessageType,
	ProtectedPagePresentationStatusSchema,
} from './protected-page-message';

describe( 'protected-page messages', () => {
	it.each( [
		{
			type: ProtectedPageMessageType.GET_PRESENTATION_STATUS,
		},
		{
			type: ProtectedPageMessageType.PRESENT_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
		},
		{
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_WARNING,
			allowanceId: 'allowance_1',
		},
		{
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
			warningStartsAtEpochMilliseconds: 1_799_999_990_000,
			warningEndsAtEpochMilliseconds: 1_800_000_000_000,
		},
		{
			type: ProtectedPageMessageType.SYNCHRONIZE_ALLOWANCE_EXPIRY_GUARD,
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
			warningStartsAtEpochMilliseconds: null,
			warningEndsAtEpochMilliseconds: null,
		},
		{
			type: ProtectedPageMessageType.REMOVE_ALLOWANCE_EXPIRY_GUARD,
		},
		{
			type: ProtectedPageMessageType.PRESENT_INTERRUPTION_LAYER,
		},
		{
			type: ProtectedPageMessageType.REMOVE_INTERRUPTION_LAYER,
		},
	] )( 'accepts the protected-page command %#', ( message ) => {
		expect( ProtectedPageMessageSchema.parse( message ) ).toEqual( message );
	} );

	it.each( [
		null,
		{},
		{ type: 'present-allowance-warning', allowanceId: 'allowance_1' },
		{ type: 'remove-allowance-warning' },
		{
			type: 'synchronize-allowance-expiry-guard',
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
		},
		{
			type: 'synchronize-allowance-expiry-guard',
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
			warningStartsAtEpochMilliseconds: 1_799_999_990_000,
			warningEndsAtEpochMilliseconds: null,
		},
		{
			type: 'synchronize-allowance-expiry-guard',
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
			warningStartsAtEpochMilliseconds: 1_799_999_990_000,
			warningEndsAtEpochMilliseconds: 1_800_000_000_001,
		},
		{
			type: 'synchronize-allowance-expiry-guard',
			allowanceId: 'allowance_1',
			expiresAtEpochMilliseconds: 1_800_000_000_000,
			warningStartsAtEpochMilliseconds: 1_799_999_990_000,
			warningEndsAtEpochMilliseconds: 1_799_999_990_000,
		},
		{ type: 'remove-allowance-expiry-guard', extra: true },
		{ type: 'present-interruption-layer', extra: true },
	] )( 'rejects the malformed protected-page command %#', ( message ) => {
		expect( () => ProtectedPageMessageSchema.parse( message ) ).toThrow();
	} );

	it( 'validates the content presentation status without exposing page data', () => {
		expect( ProtectedPagePresentationStatusSchema.parse( {
			allowanceWarningId: 'allowance_1',
			interruptionLayerPresented: true,
		} ) ).toEqual( {
			allowanceWarningId: 'allowance_1',
			interruptionLayerPresented: true,
		} );
		expect( ProtectedPagePresentationStatusSchema.parse( {
			allowanceWarningId: null,
			interruptionLayerPresented: false,
		} ) ).toEqual( {
			allowanceWarningId: null,
			interruptionLayerPresented: false,
		} );
	} );
} );
