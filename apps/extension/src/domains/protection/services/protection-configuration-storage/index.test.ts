import { describe, expect, it } from 'vitest';
import {
	ProtectionConfigurationStorageKey,
	createProtectionConfigurationStorageService,
	type ProtectionConfigurationStorageArea,
} from './index';
import { ScheduleMode } from '../../types/protection-schedule';
import { DefaultTimingConfiguration } from '../../types/timing-configuration';

/**
 * Persisted configuration from the initial storage format.
 * @since 0.1.0 Initial implementation.
 */
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

/**
 * Persisted configuration from before measurement revisions were introduced.
 * @since 0.1.0 Initial implementation.
 */
const VERSION_TWO_CONFIGURATION = {
	schemaVersion: 2,
	sites: VERSION_ONE_CONFIGURATION.sites,
	timingConfiguration: DefaultTimingConfiguration,
	schedulesByScope: {
		scope_default: { mode: ScheduleMode.ALWAYS },
	},
};

/**
 * Current persisted configuration used by storage tests.
 * @since 0.1.0 Initial implementation.
 */
const CURRENT_CONFIGURATION = {
	...VERSION_TWO_CONFIGURATION,
	schemaVersion: 4,
	measurementRevisionsByScope: {
		scope_default: 'revision_initial_scope_default',
	},
};

/**
 * Persisted configuration from before the timing-control contract was narrowed.
 * @since 0.1.0 Initial implementation.
 */
const VERSION_THREE_CONFIGURATION = {
	...CURRENT_CONFIGURATION,
	schemaVersion: 3,
	measurementRevisionsByScope: {
		scope_default: 'revision_existing_custom',
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
	it.each( [ 2, 3 ] )( 'strictly migrates complete version %i timing without writing storage', async ( schemaVersion ) => {
		const previousIncreases = [ 0, 1_000, 2_000, 3_000, 4_000, 5_000, 10_000, 60_000 ];

		for ( const ladderIncreaseMilliseconds of previousIncreases ) {
			const storedConfiguration = {
				...( schemaVersion === 2 ? VERSION_TWO_CONFIGURATION : VERSION_THREE_CONFIGURATION ),
				timingConfiguration: {
					...DefaultTimingConfiguration,
					initialWaitMilliseconds: 35_000,
					maximumWaitMilliseconds: 45_000,
					allowanceMilliseconds: 60_000,
					ladderIncreaseMilliseconds,
				},
			};
			const area = new MemoryProtectionConfigurationStorageArea( {
				[ ProtectionConfigurationStorageKey.CONFIGURATION ]: storedConfiguration,
			} );
			const storage = createProtectionConfigurationStorageService( { area } );

			await expect( storage.load() ).resolves.toEqual( {
				...CURRENT_CONFIGURATION,
				...( schemaVersion === 3 ? { measurementRevisionsByScope: { scope_default: 'revision_existing_custom' } } : {} ),
				timingConfiguration: {
					...storedConfiguration.timingConfiguration,
					initialWaitMilliseconds: 30_000,
					maximumWaitMilliseconds: 60_000,
					allowanceMilliseconds: 120_000,
					ladderIncreaseMilliseconds: Math.min( ladderIncreaseMilliseconds, 5_000 ),
				},
			} );
			expect( area.writtenValues ).toEqual( [] );
			expect( storedConfiguration.timingConfiguration.ladderIncreaseMilliseconds )
				.toBe( ladderIncreaseMilliseconds );
		}
	} );

	it( 'applies every timing boundary mapping to a valid version-three document', async () => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...VERSION_THREE_CONFIGURATION,
				timingConfiguration: {
					...DefaultTimingConfiguration,
					initialWaitMilliseconds: 10_000,
					maximumWaitMilliseconds: 10_000,
					allowanceMilliseconds: 60 * 60_000,
					ladderIncreaseMilliseconds: 60_000,
				},
			},
		} );

		await expect( createProtectionConfigurationStorageService( { area } ).load() )
			.resolves.toEqual( {
				...CURRENT_CONFIGURATION,
				measurementRevisionsByScope: { scope_default: 'revision_existing_custom' },
				timingConfiguration: {
					...DefaultTimingConfiguration,
					maximumWaitMilliseconds: 30_000,
					allowanceMilliseconds: 20 * 60_000,
				},
			} );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [ 0, 1_000, 2_000, 3_000, 4_000, 5_000 ] )( 'round-trips a current increase of %i milliseconds', async ( ladderIncreaseMilliseconds ) => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );
		const configuration = {
			...CURRENT_CONFIGURATION,
			timingConfiguration: { ...DefaultTimingConfiguration, ladderIncreaseMilliseconds },
		};

		await storage.save( configuration );
		await expect( storage.load() ).resolves.toEqual( configuration );
	} );

	it.each( [ 6_000, 10_001, 60_001, 65_000, -1_000, 1_001, '10000' ] )( 'does not normalize malformed persisted increase %s', async ( ladderIncreaseMilliseconds ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...CURRENT_CONFIGURATION,
				timingConfiguration: { ...DefaultTimingConfiguration, ladderIncreaseMilliseconds },
			},
		} );

		await expect( createProtectionConfigurationStorageService( { area } ).load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{ initialWaitMilliseconds: 10_001 },
		{ initialWaitMilliseconds: 65_000 },
		{ maximumWaitMilliseconds: 10_001 },
		{ maximumWaitMilliseconds: 65_000 },
		{ allowanceMilliseconds: 60_001 },
		{ allowanceMilliseconds: 3_660_000 },
		{ ladderIncreaseMilliseconds: 6_000 },
		{ ladderIncreaseMilliseconds: 65_000 },
	] )( 'does not clamp malformed version-three timing %#', async ( timingOverrides ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...VERSION_THREE_CONFIGURATION,
				timingConfiguration: {
					...VERSION_THREE_CONFIGURATION.timingConfiguration,
					...timingOverrides,
				},
			},
		} );

		await expect( createProtectionConfigurationStorageService( { area } ).load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'rejects a previously permitted increase on a new save', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();

		await expect( createProtectionConfigurationStorageService( { area } ).save( {
			...CURRENT_CONFIGURATION,
			timingConfiguration: { ...DefaultTimingConfiguration, ladderIncreaseMilliseconds: 10_000 },
		} ) ).rejects.toThrow();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{ schemaVersion: 4 },
		{ extra: 'unknown-field' },
		{ sites: null },
		{ measurementRevisionsByScope: {} },
	] )( 'still validates the full previous-increase document %#', async ( overrides ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...VERSION_THREE_CONFIGURATION,
				timingConfiguration: { ...DefaultTimingConfiguration, ladderIncreaseMilliseconds: 10_000 },
				...overrides,
			},
		} );

		await expect( createProtectionConfigurationStorageService( { area } ).load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{ ...VERSION_TWO_CONFIGURATION, remoteSync: true },
		{ ...VERSION_THREE_CONFIGURATION, remoteSync: true },
		{ ...VERSION_THREE_CONFIGURATION, measurementRevisionsByScope: {} },
	] )( 'rejects incomplete or extended legacy document %# before migration', async ( configuration ) => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: configuration,
		} );

		await expect( createProtectionConfigurationStorageService( { area } ).load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'returns an empty current document when no configuration exists', async () => {
		const area = new MemoryProtectionConfigurationStorageArea();
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toEqual( {
			schemaVersion: 4,
			sites: [],
			timingConfiguration: DefaultTimingConfiguration,
			schedulesByScope: {
				scope_default: { mode: ScheduleMode.ALWAYS },
			},
			measurementRevisionsByScope: {
				scope_default: 'revision_initial_scope_default',
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

	it( 'migrates one valid version-two document in memory without writing during load', async () => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: VERSION_TWO_CONFIGURATION,
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toEqual( CURRENT_CONFIGURATION );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'migrates a version-two document with a prototype-named scope', async () => {
		const schedulesByScope = Object.fromEntries( [
			[ 'scope_default', { mode: ScheduleMode.ALWAYS } ],
			[ '__proto__', { mode: ScheduleMode.ALWAYS } ],
		] );
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...VERSION_TWO_CONFIGURATION,
				sites: [ {
					identityHost: 'prototype.example',
					rule: {
						host: 'prototype.example',
						includeSubdomains: false,
						scopeId: '__proto__',
					},
				} ],
				schedulesByScope,
			},
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		const configuration = await storage.load();

		expect( configuration ).not.toBeNull();
		expect( Object.hasOwn( configuration?.schedulesByScope ?? {}, '__proto__' ) ).toBe( true );
		expect( Object.hasOwn(
			configuration?.measurementRevisionsByScope ?? {},
			'__proto__',
		) ).toBe( true );
		expect( area.writtenValues ).toEqual( [] );
	} );

	it( 'preserves a version-two document whose scope schedules violate current invariants', async () => {
		const area = new MemoryProtectionConfigurationStorageArea( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: {
				...VERSION_TWO_CONFIGURATION,
				schedulesByScope: {},
			},
		} );
		const storage = createProtectionConfigurationStorageService( { area } );

		await expect( storage.load() ).resolves.toBeNull();
		expect( area.writtenValues ).toEqual( [] );
	} );

	it.each( [
		{
			label: 'future document version',
			configuration: { ...CURRENT_CONFIGURATION, schemaVersion: 5 },
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
			measurementRevisionsByScope: {
				scope_default: 'revision_initial_scope_default',
				scope_independent: 'revision_initial_scope_independent',
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
			schemaVersion: 4,
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
			measurementRevisionsByScope: {
				scope_default: 'revision_initial_scope_default',
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
		{ ...CURRENT_CONFIGURATION, schemaVersion: 5 },
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
