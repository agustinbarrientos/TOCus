import { describe, expect, it, vi } from 'vitest';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { ProtectionConfigurationStorageKey } from '../protection-configuration-storage';
import { createBrowserProtectionConfigurationEditor } from './index';
import { type BrowserProtectionConfigurationMutationLock } from './types';

/**
 * Records browser-lock requests while executing their protected mutations.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectionConfigurationMutationLock implements BrowserProtectionConfigurationMutationLock {
	/** Requested lock names in execution order. */
	readonly names: string[] = [];

	/**
	 * Executes one mutation while recording its requested lock name.
	 * @param name - Requested browser lock name.
	 * @param mutation - Deferred protection configuration mutation.
	 * @return Exact protected-site edit result.
	 * @since 0.1.0 Initial implementation.
	 */
	request(
		name: string,
		mutation: Parameters<BrowserProtectionConfigurationMutationLock[ 'request' ]>[ 1 ],
	): ReturnType<BrowserProtectionConfigurationMutationLock[ 'request' ]> {
		this.names.push( name );

		return mutation();
	}
}

describe( 'createBrowserProtectionConfigurationEditor', () => {
	it( 'coordinates site writes and creates prefixed identifiers from browser UUIDs', async () => {
		const values: Record<string, unknown> = {};
		const set = vi.fn<( update: Record<string, unknown> ) => Promise<void>>( ( update ) => {
			Object.assign( values, update );

			return Promise.resolve();
		} );
		const area = {
			get: vi.fn<( key: string ) => Promise<Record<string, unknown>>>( ( key ) => Promise.resolve(
				Object.hasOwn( values, key ) ? { [ key ]: values[ key ] } : {},
			) ),
			set,
		};
		const locks = new MemoryProtectionConfigurationMutationLock();
		const randomUUID = vi.fn()
			.mockReturnValueOnce( 'default-measurement-id' )
			.mockReturnValueOnce( 'scope-id' )
			.mockReturnValueOnce( 'measurement-id' );
		const services = createBrowserProtectionConfigurationEditor( {
			area,
			cryptography: { randomUUID },
			locks,
		} );

		const sharedResult = await services.editor.add( 'instagram.com', false );
		const independentResult = await services.editor.add( 'youtube.com', true );

		expect( locks.names ).toEqual( [
			ProtectionConfigurationStorageKey.CONFIGURATION,
			ProtectionConfigurationStorageKey.CONFIGURATION,
		] );
		expect( sharedResult ).toHaveProperty( 'configuration.sites.0.rule.scopeId', DefaultProtectionScopeId );
		expect( independentResult ).toHaveProperty( 'configuration.sites.1.rule.scopeId', 'scope_scope-id' );
		expect( independentResult ).toHaveProperty(
			'configuration.measurementRevisionsByScope.scope_scope-id',
			'revision_measurement-id',
		);
		expect( set ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'exposes the same persistence boundary used by the editor', async () => {
		const area = {
			get: vi.fn().mockResolvedValue( {} ),
			set: vi.fn().mockResolvedValue( undefined ),
		};
		const services = createBrowserProtectionConfigurationEditor( {
			area,
			cryptography: { randomUUID: vi.fn().mockReturnValue( 'fixture-id' ) },
			locks: new MemoryProtectionConfigurationMutationLock(),
		} );

		await expect( services.storage.load() ).resolves.toHaveProperty(
			`measurementRevisionsByScope.${ DefaultProtectionScopeId }`,
		);
		await expect( services.editor.load() ).resolves.toHaveProperty(
			`measurementRevisionsByScope.${ DefaultProtectionScopeId }`,
		);
		expect( area.get ).toHaveBeenCalledTimes( 2 );
	} );
} );
