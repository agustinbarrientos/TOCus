import { describe, expect, it } from 'vitest';
import {
	ProtectionConfigurationStorageKey,
	createProtectionConfigurationStorageService,
	type ProtectionConfigurationStorageArea,
} from './index';
import { ScheduleMode } from '../../types/protection-schedule';
import { DefaultTimingConfiguration } from '../../types/timing-configuration';

const VERSION_ONE_CONFIGURATION = {
	schemaVersion: 1,
	sites: [
		{
			identityHost: 'x.com',
			rule: {
				host: 'x.com',
				includeSubdomains: true,
				scopeId: 'scope_default',
			},
			displayNameOverride: 'X',
		},
	],
};
const CURRENT_CONFIGURATION = {
	schemaVersion: 2,
	sites: VERSION_ONE_CONFIGURATION.sites,
	timingConfiguration: DefaultTimingConfiguration,
	schedulesByScope: {
		scope_default: { mode: ScheduleMode.ALWAYS },
	},
};

/**
 * In-memory storage area used to verify configuration persistence.
 * @since 0.1.0 Initial implementation.
 */
class MemoryProtectionConfigurationStorageArea implements ProtectionConfigurationStorageArea {
	readonly readKeys: string[] = [];

	readonly writtenValues: Record<string, unknown>[] = [];

	/**
	 * Creates an in-memory storage area with initial values.
	 * @param values - Values available before the first read.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly values: Record<string, unknown> = {} ) {}

	/**
	 * Reads one stored value.
	 * @param key - Requested storage key.
	 * @return Matching record or an empty record.
	 * @since 0.1.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>> {
		this.readKeys.push( key );

		return Promise.resolve( Object.hasOwn( this.values, key ) ? { [ key ]: this.values[ key ] } : {} );
	}

	/**
	 * Writes one record into memory.
	 * @param values - Values to persist.
	 * @return Promise resolved after the write.
	 * @since 0.1.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void> {
		this.writtenValues.push( values );
		Object.assign( this.values, values );

		return Promise.resolve();
	}
}

describe( 'createProtectionConfigurationStorageService', () => {
	it( 'returns an empty current document when no configuration exists', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toEqual( {
			schemaVersion: 2,
			sites: [],
			timingConfiguration: DefaultTimingConfiguration,
			schedulesByScope: {
				scope_default: { mode: ScheduleMode.ALWAYS },
			},
		} );
		expect( area.readKeys ).toEqual( [ 'tocus.protection.configuration.v1' ] );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'migrates one valid version-one document in memory without writing during load', async () => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: VERSION_ONE_CONFIGURATION,
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toEqual( CURRENT_CONFIGURATION );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{
			label: 'future document version',
			configuration: { ...CURRENT_CONFIGURATION, schemaVersion: 3 },
		},
		{
			label: 'version-one document with an unknown field',
			configuration: { ...VERSION_ONE_CONFIGURATION, remoteSync: true },
		},
	] )( 'preserves an unsupported $label during load', async ( { configuration } ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: configuration,
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'creates default schedules for shared and independent scopes during migration', async () => {
		const versionOneConfiguration = {
			...VERSION_ONE_CONFIGURATION,
			sites: [ {
				...VERSION_ONE_CONFIGURATION.sites[ 0 ],
				rule: {
					...VERSION_ONE_CONFIGURATION.sites[ 0 ]?.rule,
					scopeId: 'scope_independent',
				},
			} ],
		};
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: versionOneConfiguration,
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toMatchObject( {
			schedulesByScope: {
				scope_default: { mode: ScheduleMode.ALWAYS },
				scope_independent: { mode: ScheduleMode.ALWAYS },
			},
		} );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'saves and reloads editable names without changing matching rules', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );

		await storage.save( CURRENT_CONFIGURATION );
		await expect( storage.load() ).resolves.toEqual( CURRENT_CONFIGURATION );
		expect( area.writtenValues ).toEqual( [ {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: CURRENT_CONFIGURATION,
		} ] );

		const renamedConfiguration = {
			...CURRENT_CONFIGURATION,
			sites: [ {
				...CURRENT_CONFIGURATION.sites[ 0 ],
				displayNameOverride: 'Social pause',
			} ],
		};

		await storage.save( renamedConfiguration );
		await expect( storage.load() ).resolves.toEqual( renamedConfiguration );
		expect( renamedConfiguration.sites[ 0 ]?.rule ).toEqual( CURRENT_CONFIGURATION.sites[ 0 ]?.rule );
	} );

	it( 'stores the exact identity host separately from its broader protection rule', async () => {
		const configuration = {
			schemaVersion: 2,
			sites: [ {
				identityHost: 'mail.google.com',
				rule: {
					host: 'google.com',
					includeSubdomains: true,
					scopeId: 'scope_default',
				},
			} ],
			timingConfiguration: DefaultTimingConfiguration,
			schedulesByScope: {
				scope_default: { mode: ScheduleMode.ALWAYS },
			},
		};
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );

		await storage.save( configuration );

		await expect( storage.load() ).resolves.toEqual( configuration );
	} );

	it( 'normalizes an editable display-name override before storing it', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );

		await storage.save( {
			...CURRENT_CONFIGURATION,
			sites: [ {
				...CURRENT_CONFIGURATION.sites[ 0 ],
				displayNameOverride: '  Social pause  ',
			} ],
		} );

		expect( area.writtenValues ).toEqual( [ {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...CURRENT_CONFIGURATION,
				sites: [ {
					...CURRENT_CONFIGURATION.sites[ 0 ],
					displayNameOverride: 'Social pause',
				} ],
			},
		} ] );
	} );

	it.each( [
		{ ...CURRENT_CONFIGURATION, schemaVersion: 3 },
		{
			...CURRENT_CONFIGURATION,
			sites: [ {
				...CURRENT_CONFIGURATION.sites[ 0 ],
				favicon: 'https://icons.duckduckgo.com/ip3/x.com.ico',
			} ],
		},
		{
			...CURRENT_CONFIGURATION,
			sites: [ {
				...CURRENT_CONFIGURATION.sites[ 0 ],
				identityHost: 'mail.google.com',
			} ],
		},
		{
			...CURRENT_CONFIGURATION,
			sites: [ {
				...CURRENT_CONFIGURATION.sites[ 0 ],
				identityHost: 'mail.x.com',
				rule: {
					host: 'x.com',
					includeSubdomains: false,
					scopeId: 'scope_default',
				},
			} ],
		},
		{
			...CURRENT_CONFIGURATION,
			sites: [
				...CURRENT_CONFIGURATION.sites,
				{
					identityHost: 'www.x.com',
					rule: {
						host: 'www.x.com',
						includeSubdomains: false,
						scopeId: 'scope_other',
					},
				},
			],
		},
	] )( 'rejects configuration that violates the local storage contract', async ( configuration ) => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.save( configuration ) ).rejects.toThrow();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'reports malformed stored configuration without replacing it', async () => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...CURRENT_CONFIGURATION,
				sites: [ {
					...CURRENT_CONFIGURATION.sites[ 0 ],
					pageTitle: 'X. It is what is happening',
				} ],
			},
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{
			label: 'missing active scope schedule',
			configuration: {
				...CURRENT_CONFIGURATION,
				schedulesByScope: {},
			},
		},
		{
			label: 'orphan independent schedule',
			configuration: {
				...CURRENT_CONFIGURATION,
				schedulesByScope: {
					...CURRENT_CONFIGURATION.schedulesByScope,
					scope_orphan: { mode: ScheduleMode.ALWAYS },
				},
			},
		},
		{
			label: 'invalid global timing',
			configuration: {
				...CURRENT_CONFIGURATION,
				timingConfiguration: {
					...CURRENT_CONFIGURATION.timingConfiguration,
					maximumWaitMilliseconds: 5_000,
				},
			},
		},
		{
			label: 'invalid schedule scope identifier',
			configuration: {
				...CURRENT_CONFIGURATION,
				schedulesByScope: {
					...CURRENT_CONFIGURATION.schedulesByScope,
					'scope with spaces': { mode: ScheduleMode.ALWAYS },
				},
			},
		},
	] )( 'preserves a current document with $label', async ( { configuration } ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: configuration,
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'rejects a stored identity host outside its matching rule', async () => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...CURRENT_CONFIGURATION,
				sites: [ {
					...CURRENT_CONFIGURATION.sites[ 0 ],
					identityHost: 'mail.google.com',
				} ],
			},
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );
} );
