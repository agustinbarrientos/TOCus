import { describe, expect, it, vi } from 'vitest';
import { createLocalDataMutationGuard, readLocalDataGeneration } from './index';
import { LocalDataGenerationStorageKey } from './types';
import { BackupImportJournalKey } from '../../types/backup-storage-key';

describe( 'local data generation', () => {
	it( 'rejects an editor while an import journal is pending', async () => {
		const values: Record<string, unknown> = {};
		const area = { get: vi.fn( ( key: string ) => Promise.resolve( { [ key ]: values[ key ] } ) ) };
		const guard = createLocalDataMutationGuard( area );
		await guard();
		values[ BackupImportJournalKey ] = { pending: 'import' };
		await expect( guard() ).rejects.toThrow();
	} );

	it( 'rejects an editor opened during import even when its generation has not changed yet', async () => {
		const values: Record<string, unknown> = { [ BackupImportJournalKey ]: { pending: 'import' } };
		const area = { get: vi.fn( ( key: string ) => Promise.resolve( { [ key ]: values[ key ] } ) ) };
		const guard = createLocalDataMutationGuard( area );
		await Promise.resolve();
		await Promise.resolve();
		Reflect.deleteProperty( values, BackupImportJournalKey );
		await expect( guard() ).rejects.toThrow();
	} );
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
