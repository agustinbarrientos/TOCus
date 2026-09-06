import { describe, expect, it } from 'vitest';
import { createTabAudioController, TAB_AUDIO_STORAGE_KEY, type TabAudioTab, type TabAudioTabsApi, type TabAudioUpdate, type TabAudioStorageApi } from './index';

/**
 * Browser tab boundary retaining native ownership across controller instances.
 * @since 0.1.0 Initial implementation.
 */
class TabAudioBrowserFixture implements TabAudioTabsApi {
	/**
	 * Browser tab state.
	 * @since 0.1.0 Initial implementation.
	 */
	tab: TabAudioTab = { id: 7, incognito: false, mutedInfo: { muted: false } };

	/**
	 * Accepted mute updates.
	 * @since 0.1.0 Initial implementation.
	 */
	updates: TabAudioUpdate[] = [];

	/**
	 * Tab identifiers requested through the single-tab browser boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	readTabIds: number[] = [];

	/**
	 * Whether native ownership metadata is available.
	 * @since 0.1.0 Initial implementation.
	 */
	ownershipAvailable = true;

	/**
	 * Reads a snapshot of the tab state.
	 * @param tabId - Browser tab identifier.
	 * @return Current tab state.
	 * @since 0.1.0 Initial implementation.
	 */
	get = ( tabId: number ): Promise<TabAudioTab> => {
		this.readTabIds.push( tabId );
		return tabId === this.tab.id
			? Promise.resolve( structuredClone( this.tab ) )
			: Promise.reject( new Error( 'Tab is unavailable.' ) );
	};

	/**
	 * Lists current tab snapshots.
	 * @return Current tab state.
	 * @since 0.1.0 Initial implementation.
	 */
	query = (): Promise<TabAudioTab[]> => Promise.resolve( [ structuredClone( this.tab ) ] );

	/**
	 * Applies an extension-owned mute change.
	 * @param tabId - Browser tab identifier.
	 * @param update - Requested native audio state.
	 * @return Browser completion.
	 * @since 0.1.0 Initial implementation.
	 */
	update = ( tabId: number, update: TabAudioUpdate ): Promise<void> => {
		if ( tabId !== this.tab.id ) {
			throw new Error( 'Tab is unavailable.' );
		}
		this.updates.push( update );
		this.tab.mutedInfo = this.ownershipAvailable
			? { muted: update.muted, reason: 'extension', extensionId: 'tocus' }
			: { muted: update.muted };
		return Promise.resolve();
	};
}

/**
 * Session storage boundary shared by restarted controller instances.
 * @since 0.1.0 Initial implementation.
 */
class TabAudioStorageFixture implements TabAudioStorageApi {
	/**
	 * Persisted session values.
	 * @since 0.1.0 Initial implementation.
	 */
	values: Record<string, unknown> = {};

	/**
	 * Number of session reads.
	 * @since 0.1.0 Initial implementation.
	 */
	readCount = 0;

	/**
	 * Number of session writes.
	 * @since 0.1.0 Initial implementation.
	 */
	writeCount = 0;

	/**
	 * Reads persisted session values.
	 * @return Current session values.
	 * @since 0.1.0 Initial implementation.
	 */
	get = (): Promise<Record<string, unknown>> => {
		this.readCount += 1;
		return Promise.resolve( structuredClone( this.values ) );
	};

	/**
	 * Replaces session values.
	 * @param values - Session values to persist.
	 * @return Storage completion.
	 * @since 0.1.0 Initial implementation.
	 */
	set = ( values: Record<string, unknown> ): Promise<void> => {
		this.writeCount += 1;
		this.values = structuredClone( values );
		return Promise.resolve();
	};
}

describe( 'tab audio controller', () => {
	it( 'mutes an unmuted tab and restores sound when its interruption ends', async () => {
		const tabs = new TabAudioBrowserFixture();
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );

		await controller.mute( 7 );
		expect( tabs.tab.mutedInfo ).toEqual( { muted: true, reason: 'extension', extensionId: 'tocus' } );
		await controller.restore( 7 );
		expect( tabs.tab.mutedInfo?.muted ).toBe( false );
	} );

	it.each( [ true, false ] )( 'restores its mute after a worker restart with native ownership %s', async ( ownershipAvailable ) => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		tabs.ownershipAvailable = ownershipAvailable;
		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).mute( 7 );

		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).restore( 7 );

		expect( tabs.updates ).toEqual( [ { muted: true }, { muted: false } ] );
		expect( Object.values( storage.values ) ).toEqual( [ [] ] );
	} );

	it.each( [
		{ muted: true },
		{ muted: true, reason: 'user' },
		{ muted: true, reason: 'extension', extensionId: 'other' },
	] )( 'preserves pre-existing mute ownership %j', async ( mutedInfo ) => {
		const tabs = new TabAudioBrowserFixture();
		tabs.tab.mutedInfo = mutedInfo;
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );

		await controller.mute( 7 );
		await controller.restore( 7 );

		expect( tabs.updates ).toEqual( [] );
		expect( tabs.tab.mutedInfo ).toEqual( mutedInfo );
	} );

	it( 'keeps one mute receipt across repeated interruption projections', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );

		await controller.mute( 7 );
		await controller.observeMuteChange( 7, { muted: true, reason: 'extension', extensionId: 'tocus' } );
		await controller.mute( 7 );
		await controller.restore( 7 );
		await controller.restore( 7 );

		expect( tabs.updates ).toEqual( [ { muted: true }, { muted: false } ] );
	} );

	it.each( [
		{ muted: true, reason: 'user' },
		{ muted: true, reason: 'extension', extensionId: 'other' },
		{ muted: true, reason: 'extension' },
		{ muted: true, extensionId: 'other' },
	] )( 'preserves later native ownership %j', async ( mutedInfo ) => {
		const tabs = new TabAudioBrowserFixture();
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );
		await controller.mute( 7 );
		tabs.tab.mutedInfo = mutedInfo;

		await controller.restore( 7 );

		expect( tabs.tab.mutedInfo ).toEqual( mutedInfo );
		expect( tabs.updates ).toEqual( [ { muted: true } ] );
	} );

	it( 'preserves a Safari user unmute followed by a remute across worker restart', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		tabs.ownershipAvailable = false;
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );
		await controller.mute( 7 );
		await controller.observeMuteChange( 7, { muted: true } );
		await controller.observeMuteChange( 7, { muted: false } );
		await controller.observeMuteChange( 7, { muted: true } );

		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).restore( 7 );

		expect( tabs.tab.mutedInfo ).toEqual( { muted: true } );
		expect( tabs.updates ).toEqual( [ { muted: true } ] );
	} );

	it( 'restores only native extension-owned tabs outside the held set after restart', async () => {
		const tabs = new TabAudioBrowserFixture();
		tabs.tab.mutedInfo = { muted: true, reason: 'extension', extensionId: 'tocus' };
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );

		await controller.restoreExcept( new Set( [ 7 ] ) );
		expect( tabs.updates ).toEqual( [] );
		await controller.restoreExcept( new Set() );
		expect( tabs.tab.mutedInfo.muted ).toBe( false );
	} );

	it.each( [
		{ id: 7, incognito: true, mutedInfo: { muted: false } },
		{ id: 7, mutedInfo: { muted: false } },
		{ id: 7, incognito: false },
	] )( 'leaves private or unavailable tab audio untouched %j', async ( tab ) => {
		const tabs = new TabAudioBrowserFixture();
		tabs.tab = tab;
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );

		await controller.mute( 7 );
		await controller.restore( 7 );
		await controller.restoreExcept( new Set() );

		expect( tabs.updates ).toEqual( [] );
	} );

	it( 'finishes an in-flight mute before restoring a dismissed interruption', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		const pendingWrite = Promise.withResolvers<undefined>();
		const writeStarted = Promise.withResolvers<undefined>();
		const write = storage.set;
		storage.set = async ( values ) => {
			writeStarted.resolve( undefined );
			await pendingWrite.promise;
			await write( values );
		};
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );
		const muting = controller.mute( 7 );
		await writeStarted.promise;
		const restoring = controller.restore( 7 );
		pendingWrite.resolve( undefined );
		await Promise.all( [ muting, restoring ] );

		expect( tabs.updates ).toEqual( [ { muted: true }, { muted: false } ] );
		expect( tabs.tab.mutedInfo?.muted ).toBe( false );
	} );

	it.each( [ 'get', 'set' ] as const )( 'does not mute when session %s fails and remains usable', async ( operation ) => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		const original = storage[ operation ];
		/**
		 * Rejects an unavailable session operation.
		 * @return Rejected storage completion.
		 * @since 0.1.0 Initial implementation.
		 */
		const rejectStorage = (): Promise<never> => Promise.reject( new Error( 'Session unavailable.' ) );
		Object.assign( storage, { [ operation ]: rejectStorage } );
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );

		await expect( controller.mute( 7 ) ).resolves.toBeUndefined();
		expect( tabs.updates ).toEqual( [] );
		Object.assign( storage, { [ operation ]: original } );
		await controller.mute( 7 );
		expect( tabs.tab.mutedInfo?.muted ).toBe( true );
	} );

	it( 'contains disappeared-tab failures without blocking later work', async () => {
		const tabs = new TabAudioBrowserFixture();
		const original = tabs.get;
		tabs.get = () => Promise.reject( new Error( 'Tab closed.' ) );
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );

		await expect( controller.mute( 7 ) ).resolves.toBeUndefined();
		await expect( controller.restore( 7 ) ).resolves.toBeUndefined();
		tabs.get = original;
		await controller.mute( 7 );
		expect( tabs.tab.mutedInfo?.muted ).toBe( true );
	} );

	it( 'contains a failed tab query without discarding a restorable receipt', async () => {
		const tabs = new TabAudioBrowserFixture();
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );
		await controller.mute( 7 );
		tabs.query = () => Promise.reject( new Error( 'Browser unavailable.' ) );

		await expect( controller.restoreExcept( new Set() ) ).resolves.toBeUndefined();
		await controller.restore( 7 );
		expect( tabs.tab.mutedInfo?.muted ).toBe( false );
	} );

	it( 'discards a failed mute receipt so a later Safari mute is not undone', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		const update = tabs.update;
		tabs.update = () => Promise.reject( new Error( 'Mute rejected.' ) );
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );

		await expect( controller.mute( 7 ) ).resolves.toBeUndefined();
		tabs.update = update;
		tabs.tab.mutedInfo = { muted: true };
		await controller.restore( 7 );
		expect( tabs.updates ).toEqual( [] );
	} );

	it( 'continues restoring live tabs when another queried tab disappears', async () => {
		const tabs = new TabAudioBrowserFixture();
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );
		await controller.mute( 7 );
		tabs.query = () => Promise.resolve( [
			{ id: 8, incognito: false, mutedInfo: { muted: true, reason: 'extension', extensionId: 'tocus' } },
			structuredClone( tabs.tab ),
			{},
		] );

		await controller.restoreExcept( new Set() );

		expect( tabs.tab.mutedInfo?.muted ).toBe( false );
	} );

	it( 'retains its Safari receipt after a rejected restoration for a later retry', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		tabs.ownershipAvailable = false;
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );
		await controller.mute( 7 );
		const update = tabs.update;
		tabs.update = () => Promise.reject( new Error( 'Restore rejected.' ) );
		await expect( controller.restore( 7 ) ).resolves.toBeUndefined();
		tabs.update = update;

		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).restore( 7 );

		expect( tabs.tab.mutedInfo?.muted ).toBe( false );
	} );

	it( 'rechecks native ownership after tab query before restoring audio', async () => {
		const tabs = new TabAudioBrowserFixture();
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage: new TabAudioStorageFixture() } );
		await controller.mute( 7 );
		tabs.query = () => {
			const snapshot = structuredClone( tabs.tab );
			tabs.tab.mutedInfo = { muted: true, reason: 'user' };
			return Promise.resolve( [ snapshot ] );
		};

		await controller.restoreExcept( new Set() );

		expect( tabs.tab.mutedInfo ).toEqual( { muted: true, reason: 'user' } );
		expect( tabs.updates ).toEqual( [ { muted: true } ] );
	} );

	it( 'preserves a user mute made while the initial receipt is being persisted', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		const write = storage.set;
		storage.set = async ( values ) => {
			tabs.tab.mutedInfo = { muted: true };
			await write( values );
		};
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );

		await controller.mute( 7 );
		await controller.restore( 7 );

		expect( tabs.updates ).toEqual( [] );
		expect( tabs.tab.mutedInfo ).toEqual( { muted: true } );
	} );

	it( 'skips per-tab reads and session writes for tabs without an owned mute or receipt', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		tabs.query = () => Promise.resolve( [
			{ id: 7, incognito: false, mutedInfo: { muted: false } },
			{ id: 8, incognito: false, mutedInfo: { muted: true, reason: 'user' } },
			{ id: 9, incognito: false, mutedInfo: { muted: true, reason: 'extension', extensionId: 'other' } },
			{ id: 10, incognito: false, mutedInfo: { muted: true } },
		] );

		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).restoreExcept( new Set() );

		expect( tabs.readTabIds ).toEqual( [] );
		expect( storage.readCount ).toBe( 1 );
		expect( storage.writeCount ).toBe( 0 );
	} );

	it( 'prunes closed tab receipts while retaining a held live Safari mute', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		storage.values = { [ TAB_AUDIO_STORAGE_KEY ]: [ 7, 8, 9 ] };
		tabs.tab.mutedInfo = { muted: true };

		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).restoreExcept( new Set( [ 7, 8 ] ) );

		expect( storage.values ).toEqual( { [ TAB_AUDIO_STORAGE_KEY ]: [ 7 ] } );
		expect( storage.readCount ).toBe( 1 );
		expect( storage.writeCount ).toBe( 1 );
		expect( tabs.readTabIds ).toEqual( [] );
		expect( tabs.tab.mutedInfo ).toEqual( { muted: true } );
	} );

	it( 'shares one receipt read and write across a restore and closed-tab cleanup', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		storage.values = { [ TAB_AUDIO_STORAGE_KEY ]: [ 7, 8 ] };
		tabs.tab.mutedInfo = { muted: true };

		await createTabAudioController( { runtimeId: 'tocus', tabs, storage } ).restoreExcept( new Set() );

		expect( tabs.readTabIds ).toEqual( [ 7 ] );
		expect( tabs.tab.mutedInfo.muted ).toBe( false );
		expect( storage.values ).toEqual( { [ TAB_AUDIO_STORAGE_KEY ]: [] } );
		expect( storage.readCount ).toBe( 1 );
		expect( storage.writeCount ).toBe( 1 );
	} );

	it( 'reports strict restoration failures after restoring other tabs and permits a later retry', async () => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		storage.values = { [ TAB_AUDIO_STORAGE_KEY ]: [ 7, 8 ] };
		tabs.tab.mutedInfo = { muted: true };
		const get = tabs.get;
		tabs.get = ( tabId ) => tabId === 8
			? Promise.resolve( { id: 8, incognito: false, mutedInfo: { muted: true } } )
			: get( tabId );
		tabs.query = () => Promise.resolve( [ { id: 8 }, structuredClone( tabs.tab ) ] );
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );

		await expect( controller.restoreExcept( new Set(), true ) ).rejects.toThrow();

		expect( tabs.tab.mutedInfo.muted ).toBe( false );
		expect( storage.values ).toEqual( { [ TAB_AUDIO_STORAGE_KEY ]: [ 8 ] } );
		tabs.tab = { id: 8, incognito: false, mutedInfo: { muted: true } };
		tabs.query = () => Promise.resolve( [ structuredClone( tabs.tab ) ] );
		await expect( controller.restoreExcept( new Set(), true ) ).resolves.toBeUndefined();
		expect( tabs.tab.mutedInfo?.muted ).toBe( false );
		expect( storage.values ).toEqual( { [ TAB_AUDIO_STORAGE_KEY ]: [] } );
	} );

	it.each( [ 'query', 'get', 'session-read', 'session-write' ] )( 'reports strict %s failures', async ( boundary ) => {
		const tabs = new TabAudioBrowserFixture();
		const storage = new TabAudioStorageFixture();
		storage.values = { [ TAB_AUDIO_STORAGE_KEY ]: [ 7 ] };
		tabs.tab.mutedInfo = { muted: true };
		if ( boundary === 'query' ) {
			tabs.query = () => Promise.reject( new Error( 'Query failed.' ) );
		} else if ( boundary === 'get' ) {
			tabs.get = () => Promise.reject( new Error( 'Tab read failed.' ) );
		} else if ( boundary === 'session-read' ) {
			storage.get = () => Promise.reject( new Error( 'Session read failed.' ) );
		} else {
			storage.set = () => Promise.reject( new Error( 'Session write failed.' ) );
		}
		const controller = createTabAudioController( { runtimeId: 'tocus', tabs, storage } );

		await expect( controller.restoreExcept( new Set(), true ) ).rejects.toThrow();
		await expect( controller.restoreExcept( new Set() ) ).resolves.toBeUndefined();
	} );
} );
