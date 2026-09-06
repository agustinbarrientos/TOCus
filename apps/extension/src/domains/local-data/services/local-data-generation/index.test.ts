import { describe, expect, it, vi } from 'vitest';
import { createLocalDataMutationGuard, readLocalDataGeneration } from './index';
import { LocalDataGenerationStorageKey } from './types';

describe( 'local data generation', () => {
	it( 'permits an unchanged installation without creating storage', async () => {
		const area = { get: vi.fn().mockResolvedValue( {} ) };
		const guard = createLocalDataMutationGuard( area );
		await expect( guard() ).resolves.toBeUndefined();
		expect( area.get ).toHaveBeenCalledWith( LocalDataGenerationStorageKey );
	} );

	it( 'rejects an editor created before a completed reset', async () => {
		const area = { get: vi.fn().mockResolvedValueOnce( {} ).mockResolvedValue( {
			[ LocalDataGenerationStorageKey ]: { generation: 'new', pending: false },
		} ) };
		await expect( createLocalDataMutationGuard( area )() ).rejects.toThrow( 'reset' );
	} );

	it( 'permits a fresh editor after reset', async () => {
		const area = { get: vi.fn().mockResolvedValue( {
			[ LocalDataGenerationStorageKey ]: { generation: 'new', pending: false },
		} ) };
		await expect( createLocalDataMutationGuard( area )() ).resolves.toBeUndefined();
	} );

	it( 'rejects an editor opened during an incomplete reset even after completion', async () => {
		const area = { get: vi.fn().mockResolvedValueOnce( {
			[ LocalDataGenerationStorageKey ]: { generation: 'new', pending: true },
		} ).mockResolvedValue( {
			[ LocalDataGenerationStorageKey ]: { generation: 'new', pending: false },
		} ) };
		await expect( createLocalDataMutationGuard( area )() ).rejects.toThrow( 'reset' );
	} );

	it( 'blocks persistence while reset is pending', async () => {
		const area = { get: vi.fn().mockResolvedValue( {
			[ LocalDataGenerationStorageKey ]: { generation: 'new', pending: true },
		} ) };
		await expect( createLocalDataMutationGuard( area )() ).rejects.toThrow( 'reset' );
	} );

	it( 'fails closed when the initial read fails', async () => {
		const area = { get: vi.fn().mockRejectedValueOnce( new Error( 'unavailable' ) ).mockResolvedValue( {} ) };
		await expect( createLocalDataMutationGuard( area )() ).rejects.toThrow( 'reset' );
	} );

	it( 'propagates a current storage read failure', async () => {
		const area = { get: vi.fn().mockResolvedValueOnce( {} ).mockRejectedValue( new Error( 'unavailable' ) ) };
		await expect( createLocalDataMutationGuard( area )() ).rejects.toThrow( 'unavailable' );
	} );

	it( 'rejects malformed reset metadata without replacing it', async () => {
		const area = { get: vi.fn().mockResolvedValue( { [ LocalDataGenerationStorageKey ]: { pending: false } } ) };
		await expect( readLocalDataGeneration( area ) ).rejects.toThrow();
	} );
} );
