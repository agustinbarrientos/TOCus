import { describe, expect, it, vi } from 'vitest';
import { createLocalDataReset } from './index';
import { LocalDataGenerationStorageKey } from '../local-data-generation';
import type { LocalDataResetOptions } from './types';

/**
 * Creates isolated storage and lifecycle boundaries for reset behavior.
 * @return Observable reset dependencies and retained records.
 * @since 0.1.0 Initial implementation.
 */
function createFixture() {
	const values: Record<string, unknown> = { unrelated: 'keep', 'tocus.statistics.v1': { total: 42 } };
	const events: string[] = [];
	const options = {
		localArea: {
			get: vi.fn( ( key: string ) => Promise.resolve( { [ key ]: values[ key ] } ) ),
			set: vi.fn( ( update: Record<string, unknown> ) => {
				Object.assign( values, update );
				events.push( 'marker' );
				return Promise.resolve();
			} ),
			remove: vi.fn( ( keys: string[] ) => {
				keys.forEach( ( key ) => {
					Reflect.deleteProperty( values, key );
				} );
				events.push( 'local' );
				return Promise.resolve();
			} ),
		},
		sessionArea: { remove: vi.fn( () => {
			events.push( 'session' );
			return Promise.resolve();
		} ) },
		locks: {
			/**
			 * Records lock ownership around its protected operation.
			 * @template Result Operation result.
			 * @param name - Requested lock identity.
			 * @param operation - Work executed with lock ownership.
			 * @return Protected operation result.
			 * @since 0.1.0 Initial implementation.
			 */
			request<Result>( name: string, operation: () => Promise<Result> ): Promise<Result> {
				events.push( name );
				return operation();
			},
		},
		createGeneration: vi.fn( () => 'generation-1' ),
		suspend: vi.fn( () => {
			events.push( 'suspend' );
			return Promise.resolve();
		} ),
		revokeAccess: vi.fn( () => {
			events.push( 'revoke' );
			return Promise.resolve( true );
		} ),
	} satisfies LocalDataResetOptions;
	return { values, events, options, service: createLocalDataReset( options ) };
}

describe( 'local data reset', () => {
	it( 'releases active pauses before revoking access and deleting owned data', async () => {
		const { service, options, values, events } = createFixture();
		await expect( service.reset() ).resolves.toBe( true );
		expect( events ).toEqual( [ 'tocus.protection.configuration.v1', 'tocus.preferences.v1', 'marker', 'suspend', 'revoke', 'session', 'local', 'marker' ] );
		expect( options.localArea.remove ).toHaveBeenCalledWith( [ 'tocus.protection.configuration.v1', 'tocus.preferences.v1', 'tocus.protection.durable.v1', 'tocus.statistics.v1' ] );
		expect( options.sessionArea.remove ).toHaveBeenCalledWith( [ 'tocus.protection.session.v1', 'tocus.statistics.session.v1', 'tocus.statistics.focus-epoch.v1' ] );
		expect( values ).toEqual( { unrelated: 'keep', [ LocalDataGenerationStorageKey ]: { generation: 'generation-1', pending: false, needsOnboarding: true } } );
	} );

	it( 'does not alter an installation without a pending reset', async () => {
		const { service, options } = createFixture();
		await expect( service.recover() ).resolves.toBe( true );
		expect( options.suspend ).not.toHaveBeenCalled();
		expect( options.localArea.set ).not.toHaveBeenCalled();
	} );

	it( 'recovers a pending reset with its original identity', async () => {
		const { service, values, options } = createFixture();
		values[ LocalDataGenerationStorageKey ] = { generation: 'previous', pending: true };
		await expect( service.recover() ).resolves.toBe( true );
		expect( values[ LocalDataGenerationStorageKey ] ).toEqual( { generation: 'previous', pending: false, needsOnboarding: true } );
		expect( options.createGeneration ).not.toHaveBeenCalled();
	} );

	it.each( [ 'suspend', 'revokeAccess' ] as const )( 'retains pending reset metadata after %s fails', async ( boundary ) => {
		const { service, values, options } = createFixture();
		vi.mocked( options[ boundary ] ).mockRejectedValueOnce( new Error( 'unavailable' ) );
		await expect( service.reset() ).resolves.toBe( false );
		expect( values[ LocalDataGenerationStorageKey ] ).toEqual( { generation: 'generation-1', pending: true, needsOnboarding: false } );
		expect( options.localArea.remove ).not.toHaveBeenCalled();
		await expect( service.reset() ).resolves.toBe( true );
		expect( options.createGeneration ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'does not delete data when website access cannot be revoked', async () => {
		const { service, options, values } = createFixture();
		vi.mocked( options.revokeAccess ).mockResolvedValue( false );
		await expect( service.reset() ).resolves.toBe( false );
		expect( values[ 'tocus.statistics.v1' ] ).toEqual( { total: 42 } );
	} );

	it( 'retains recovery intent after a partial storage deletion', async () => {
		const { service, options, values } = createFixture();
		vi.mocked( options.localArea.remove ).mockRejectedValueOnce( new Error( 'unavailable' ) );
		await expect( service.reset() ).resolves.toBe( false );
		expect( values[ LocalDataGenerationStorageKey ] ).toHaveProperty( 'pending', true );
		await expect( service.recover() ).resolves.toBe( true );
	} );

	it( 'does not begin destructive cleanup without durable reset intent', async () => {
		const { service, options } = createFixture();
		vi.mocked( options.localArea.set ).mockRejectedValue( new Error( 'unavailable' ) );
		await expect( service.reset() ).resolves.toBe( false );
		expect( options.suspend ).not.toHaveBeenCalled();
	} );

	it( 'fails closed when reset recovery metadata cannot be read', async () => {
		const { service, options } = createFixture();
		vi.mocked( options.localArea.get ).mockRejectedValue( new Error( 'unavailable' ) );
		await expect( service.recover() ).resolves.toBe( false );
	} );
} );
