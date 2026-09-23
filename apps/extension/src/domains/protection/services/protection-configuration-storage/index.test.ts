import { describe, expect, it } from 'vitest';
import { createProtectionConfigurationStorageService, ProtectionConfigurationStorageKey,
	type ProtectionConfigurationStorageArea } from './index';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { ScheduleMode, Weekday } from '../../types/protection-schedule';

/** Current complete configuration used by persistence tests. */
const CURRENT_CONFIGURATION = { ...TestEmptyProtectionConfiguration, sites: [ {
	identityHost: 'www.example.com', displayNameOverride: 'Reading',
	rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
	schedule: { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 540,
		endMinute: 1020 } ] },
} ] };

/**
 * In-memory storage area used to verify configuration persistence.
 * @since 1.0.0 Initial implementation.
 */
class MemoryProtectionConfigurationStorageArea implements ProtectionConfigurationStorageArea {
	readonly readKeys: string[] = [];

	readonly writtenValues: Record<string, unknown>[] = [];

	/**
	 * Creates an in-memory storage area with initial values.
	 * @param values - Values available before the first read.
	 * @since 1.0.0 Initial implementation.
	 */
	constructor( private readonly values: Record<string, unknown> = {} ) {}

	/**
	 * Reads one stored value.
	 * @param key - Requested storage key.
	 * @return Matching record or an empty record.
	 * @since 1.0.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>> {
		this.readKeys.push( key );

		return Promise.resolve( Object.hasOwn( this.values, key ) ? { [ key ]: this.values[ key ] } : {} );
	}

	/**
	 * Writes one record into memory.
	 * @param values - Values to persist.
	 * @return Promise resolved after the write.
	 * @since 1.0.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void> {
		this.writtenValues.push( values );
		Object.assign( this.values, values );

		return Promise.resolve();
	}
}

describe( 'createProtectionConfigurationStorageService', () => {
	it.each( [ 1, 2, 3, 4 ] )( 'rejects alpha version %i without migrating or writing it', async ( schemaVersion ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: { ...CURRENT_CONFIGURATION, schemaVersion },
		} );
		await expect( createProtectionConfigurationStorageService( { area } ).load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'returns fresh defaults without writing when configuration is absent', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		await expect( createProtectionConfigurationStorageService( { area } ).load() )
			.resolves.toEqual( TestEmptyProtectionConfiguration );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'round-trips one atomic site, name and active-time override', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );
		await storage.save( CURRENT_CONFIGURATION );
		await expect( storage.load() ).resolves.toEqual( CURRENT_CONFIGURATION );
		expect( area.writtenValues ).toEqual( [ {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: CURRENT_CONFIGURATION,
		} ] );
	} );

	it( 'normalizes the optional display name without changing identity or matching boundaries', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );
		await storage.save( { ...CURRENT_CONFIGURATION, sites: [ { ...CURRENT_CONFIGURATION.sites[ 0 ],
			displayNameOverride: '  Reading  ' } ] } );
		await expect( storage.load() ).resolves.toEqual( CURRENT_CONFIGURATION );
	} );

	it.each( [
		null, [], {},
		{ ...CURRENT_CONFIGURATION, extra: true },
		{ ...CURRENT_CONFIGURATION, schedule: {} },
		{ ...CURRENT_CONFIGURATION, measurementRevisionsByScope: {} },
		{ ...CURRENT_CONFIGURATION, measurementRevisionsByScope: { scope_default: 'revision_initial_scope_default', unknown: 'revision_other' } },
		{ ...CURRENT_CONFIGURATION, sites: [ { ...CURRENT_CONFIGURATION.sites[ 0 ],
			identityHost: 'unrelated.test' } ] },
		{ ...CURRENT_CONFIGURATION, sites: [ { ...CURRENT_CONFIGURATION.sites[ 0 ], displayNameOverride: '' } ] },
		{ ...CURRENT_CONFIGURATION, sites: [ { ...CURRENT_CONFIGURATION.sites[ 0 ],
			rule: { host: 'example.com', includeSubdomains: true, scopeId: 'scope_separate' } } ] },
		{ ...CURRENT_CONFIGURATION, sites: [ { ...CURRENT_CONFIGURATION.sites[ 0 ],
			schedule: { mode: ScheduleMode.CUSTOM, windows: [] } } ] },
		{ ...CURRENT_CONFIGURATION, timingConfiguration: { ...CURRENT_CONFIGURATION.timingConfiguration,
			initialWaitMilliseconds: 35_000 } },
		{ ...CURRENT_CONFIGURATION, timingConfiguration: { ...CURRENT_CONFIGURATION.timingConfiguration,
			ladderIncreaseMilliseconds: 6_000 } },
		{ ...CURRENT_CONFIGURATION, timingConfiguration: { ...CURRENT_CONFIGURATION.timingConfiguration,
			allowanceMilliseconds: 60_000 } },
	] )( 'preserves malformed input for explicit recovery: %j', async ( invalid ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: invalid,
		} );
		const storage = createProtectionConfigurationStorageService( { area } );
		await expect( storage.load() ).resolves.toBeNull();
		await expect( storage.save( invalid ) ).rejects.toThrow();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'propagates unavailable storage reads and rejected writes', async () => {
		const storage = createProtectionConfigurationStorageService( { area: {
			/**
			 * Rejects the unavailable storage read.
			 * @return Rejected storage read.
			 */
			get: () => Promise.reject( new Error( 'read failed' ) ),
			/**
			 * Rejects the unavailable storage write.
			 * @return Rejected storage write.
			 */
			set: () => Promise.reject( new Error( 'write failed' ) ),
		} } );
		await expect( storage.load() ).rejects.toThrow( 'read failed' );
		await expect( storage.save( CURRENT_CONFIGURATION ) ).rejects.toThrow( 'write failed' );
	} );
} );
