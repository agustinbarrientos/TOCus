import { describe, expect, it, vi } from 'vitest';
import { createReviewPromptStorageService, ReviewPromptStorageKey } from './index';

describe( 'review prompt storage', () => {
	it( 'defaults to eligible without writing when no dismissal exists', async () => {
		const area = { get: vi.fn().mockResolvedValue( {} ), set: vi.fn() };
		const storage = createReviewPromptStorageService( { area } );
		await expect( storage.load() ).resolves.toBe( false );
		expect( area.get ).toHaveBeenCalledWith( ReviewPromptStorageKey );
		expect( area.set ).not.toHaveBeenCalled();
	} );

	it.each( [ true, false ] )( 'loads the persisted dismissal value %s', async ( value ) => {
		const area = { get: vi.fn().mockResolvedValue( { [ ReviewPromptStorageKey ]: value } ), set: vi.fn() };
		await expect( createReviewPromptStorageService( { area } ).load() ).resolves.toBe( value );
	} );

	it.each( [ null, undefined, 'true', 1, {} ] )( 'preserves malformed dismissal %#', async ( value ) => {
		const area = { get: vi.fn().mockResolvedValue( { [ ReviewPromptStorageKey ]: value } ), set: vi.fn() };
		await expect( createReviewPromptStorageService( { area } ).load() ).resolves.toBeNull();
		expect( area.set ).not.toHaveBeenCalled();
	} );

	it( 'persists only the permanent dismissal key', async () => {
		const area = { get: vi.fn(), set: vi.fn().mockResolvedValue( undefined ) };
		await createReviewPromptStorageService( { area } ).dismiss();
		expect( area.set ).toHaveBeenCalledWith( { [ ReviewPromptStorageKey ]: true } );
	} );

	it( 'propagates read and write failures for visible recovery', async () => {
		const failure = new Error( 'Storage unavailable' );
		const area = { get: vi.fn().mockRejectedValue( failure ), set: vi.fn().mockRejectedValue( failure ) };
		const storage = createReviewPromptStorageService( { area } );
		await expect( storage.load() ).rejects.toBe( failure );
		await expect( storage.dismiss() ).rejects.toBe( failure );
	} );
} );
