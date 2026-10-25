import { afterEach, expect, it, vi, type MockInstance } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startProtectionBackgroundApplication } from './index';
import { createProtectionStorageService, ProtectionStorageKey } from '../../../../domains/protection/services/protection-storage';
import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import { PreferencesStorageKey } from '../../../../domains/preferences/services/preferences-storage';
import { DefaultPreferencesDocument, Language } from '../../../../domains/preferences/types';
import { prepareStoredProtectionState } from '../../../../domains/protection/utils/prepare-stored-protection-state';
import { createWaitingState } from '../../../../domains/protection/types/__fixtures__/protection-state';
import { EXAMPLE_CONFIGURATION } from '../browser-protection-runtime/__fixtures__/runtime';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { BackupImportJournalKey } from '../../../../domains/local-data/types/backup-operation';
import { LocalDataGenerationStorageKey } from '../../../../domains/local-data/services/local-data-generation';
import { InterruptionPageRequestType, InterruptionPageResponseSchema,
	InterruptionPageResponseState, type InterruptionPageRequest } from '../../types/runtime-message';
import type { Browser } from 'wxt/browser';

afterEach( () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	fakeBrowser.reset();
} );

/**
 * Lets browser-message and storage promise continuations finish before inspecting their results.
 * @return Completion of the next browser task.
 */
function settleBrowserWork(): Promise<void> {
	return new Promise( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
}

/**
 * Starts the real background composition with a saved pause and a controlled recovery storage read.
 * @param recoveryKey - Reset or backup metadata read held before runtime restoration.
 * @param failRecovery - Whether the held storage read fails instead of completing normally.
 * @param carrierDestination - A new navigation carrier without any saved pause participant.
 * @return Authenticated message delivery and the recovery barrier.
 */
async function createStartupFixture( recoveryKey: string, failRecovery = false, carrierDestination?: string ) {
	fakeBrowser.reset();
	const locks = {
		/**
		 * Executes the lock owner; no competing storage writers exist in this fixture.
		 * @template Result Result produced by the lock owner.
		 * @param _name - Browser mutation lock identity.
		 * @param operation - Work performed while holding the lock.
		 * @return Completion of the lock owner.
		 */
		request<Result>( _name: string, operation: () => Promise<Result> ): Promise<Result> {
			return operation();
		},
	};
	vi.stubGlobal( 'navigator', { locks } );
	vi.spyOn( fakeBrowser.runtime, 'getManifest' ).mockReturnValue( { manifest_version: 3, name: 'TOCus', version: '1.1.0' } );
	vi.spyOn( fakeBrowser.i18n, 'getUILanguage' ).mockReturnValue( 'en-US' );
	vi.spyOn( fakeBrowser.permissions.onAdded, 'addListener' ).mockReturnValue( undefined );
	vi.spyOn( fakeBrowser.permissions.onRemoved, 'addListener' ).mockReturnValue( undefined );
	const contains = vi.spyOn( fakeBrowser.permissions, 'contains' ) as MockInstance<
		( permissions: Browser.permissions.Permissions ) => Promise<boolean>>;
	contains.mockResolvedValue( true );
	const getPermissions = vi.spyOn( fakeBrowser.permissions, 'getAll' ) as MockInstance<
		() => Promise<Browser.permissions.Permissions>>;
	getPermissions.mockResolvedValue( {
		permissions: [ 'webNavigation' ], origins: [ '*://*.example.com/*' ],
	} );
	const getRules = vi.spyOn( fakeBrowser.declarativeNetRequest, 'getDynamicRules' ) as MockInstance<
		() => Promise<Browser.declarativeNetRequest.Rule[]>>;
	getRules.mockResolvedValue( [] );
	const supportsRegex = vi.spyOn( fakeBrowser.declarativeNetRequest, 'isRegexSupported' ) as MockInstance<
		( options: Browser.declarativeNetRequest.RegexOptions ) => Promise<{ isSupported: boolean }>>;
	supportsRegex.mockResolvedValue( { isSupported: true } );
	vi.spyOn( fakeBrowser.declarativeNetRequest, 'updateDynamicRules' ).mockResolvedValue( undefined );
	vi.spyOn( fakeBrowser.tabs, 'sendMessage' ).mockResolvedValue( undefined );
	const interruptionUrl = fakeBrowser.runtime.getURL( '/pause.html' );
	const pageUrl = carrierDestination === undefined
		? interruptionUrl : `${ interruptionUrl }#destination=${ carrierDestination }`;
	const window = await fakeBrowser.windows.create( { focused: true, incognito: false } );
	if ( window === undefined ) {
		throw new Error( 'Expected a browser window.' );
	}
	const getFocusedWindow = vi.spyOn( fakeBrowser.windows, 'getLastFocused' ) as MockInstance<
		() => Promise<Browser.windows.Window>>;
	getFocusedWindow.mockResolvedValue( { ...window, focused: true } );
	const tab = await fakeBrowser.tabs.create( { windowId: window.id, active: true, url: pageUrl } );
	if ( tab.id === undefined ) {
		throw new Error( 'Expected a browser tab identifier.' );
	}
	const waiting = {
		...createWaitingState(), scopeId: DefaultProtectionScopeId,
		confirmedFocusedDurationMilliseconds: 3_000, checkpointHighWaterMilliseconds: 3_000,
		participants: [ { ...createWaitingState().participants[ 0 ], pageId: `page_tab_${ String( tab.id ) }_startup`,
			retainedDestination: 'https://example.com/feed' } ],
	};
	await createProtectionStorageService( {
		durableArea: fakeBrowser.storage.local, sessionArea: fakeBrowser.storage.session,
		/** @return A valid deterministic snapshot shared by the seeded documents. */
		createSnapshotId: () => '00000000-0000-4000-8000-000000000001',
	} ).save( prepareStoredProtectionState( {
		statesByScope: carrierDestination === undefined ? { [ DefaultProtectionScopeId ]: waiting } : {},
		sessionContinuityId: 'startup-continuity', statisticsDelivery: { status: 'complete', outbox: [] },
	} ) );
	await fakeBrowser.storage.local.set( {
		[ ProtectionConfigurationStorageKey.CONFIGURATION ]: EXAMPLE_CONFIGURATION,
		[ PreferencesStorageKey.PREFERENCES ]: { ...DefaultPreferencesDocument, language: Language.ENGLISH },
	} );
	const recoveryEntered = Promise.withResolvers<undefined>();
	const releaseRecovery = Promise.withResolvers<undefined>();
	const getLocal = fakeBrowser.storage.local.get.bind( fakeBrowser.storage.local ) as
		( key: string ) => Promise<Record<string, unknown>>;
	const readLocal = vi.spyOn( fakeBrowser.storage.local, 'get' ) as MockInstance<
		( key: string ) => Promise<Record<string, unknown>>>;
	readLocal.mockImplementation( async ( key ) => {
		if ( key === recoveryKey ) {
			recoveryEntered.resolve( undefined );
			await releaseRecovery.promise;
			if ( failRecovery ) {
				throw new Error( 'Recovery storage is unavailable.' );
			}
		}
		return getLocal( key );
	} );
	const sender: Browser.runtime.MessageSender = { frameId: 0, url: pageUrl,
		tab: { ...tab, incognito: false } };
	/**
	 * Delivers one authenticated pause message to the real registered application controllers.
	 * @param input - Pause request received from the existing browser tab.
	 * @return Validated response delivered through the browser callback.
	 */
	async function request( input: InterruptionPageRequest ) {
		const response = Promise.withResolvers<unknown>();
		await fakeBrowser.runtime.onMessage.trigger( input, sender, response.resolve ).then( () => undefined );
		return InterruptionPageResponseSchema.parse( await response.promise );
	}
	/**
	 * Resolves the redirect handshake from the same authenticated browser tab.
	 * @return Navigation replacement returned by the real controller.
	 */
	async function requestRedirect() {
		const response = Promise.withResolvers<unknown>();
		await fakeBrowser.runtime.onMessage.trigger( { type: 'resolve-navigation-redirect' },
			sender,
			response.resolve ).then( () => undefined );
		return response.promise;
	}
	startProtectionBackgroundApplication( { browser: fakeBrowser } );
	await recoveryEntered.promise;
	return { request, requestRedirect, sender, tab, interruptionUrl,
		/** Releases the browser storage operation that is holding initial recovery. */
		releaseRecovery: () => {
			releaseRecovery.resolve( undefined );
		},
	};
}

const coldRequests: InterruptionPageRequest[] = [
	{ type: InterruptionPageRequestType.CHECKPOINT,
		documentVisible: true, displayedFocusedDurationMilliseconds: 3_000 },
	{ type: InterruptionPageRequestType.CONNECT, documentVisible: true },
	{ type: InterruptionPageRequestType.SYNCHRONIZE, documentVisible: true },
	{ type: InterruptionPageRequestType.RECOVER, documentVisible: true },
];

for ( const recoveryKey of [ LocalDataGenerationStorageKey, BackupImportJournalKey ] ) {
	it.each( coldRequests )( `restores saved progress for cold $type after ${ recoveryKey } recovery`, async ( input ) => {
		const fixture = await createStartupFixture( recoveryKey );
		let responded = false;
		const response = fixture.request( input ).then( ( result ) => {
			responded = true;
			return result;
		} );
		await settleBrowserWork();
		const respondedBeforeRecovery = responded;
		fixture.releaseRecovery();
		const result = await response;
		await settleBrowserWork();
		expect( respondedBeforeRecovery ).toBe( false );
		expect( result ).toMatchObject( {
			state: InterruptionPageResponseState.WAITING, focusedProgressMilliseconds: 3_000,
		} );
		expect( await fakeBrowser.storage.session.get( ProtectionStorageKey.SESSION ) ).toMatchObject( {
			[ ProtectionStorageKey.SESSION ]: { document: { scopes: {
				[ DefaultProtectionScopeId ]: { waitId: 'wait-a', confirmedFocusedDurationMilliseconds: 3_000 },
			} } },
		} );
	} );
}

it( 'answers a warm checkpoint without restarting the recovered pause', async () => {
	const fixture = await createStartupFixture( BackupImportJournalKey );
	fixture.releaseRecovery();
	await settleBrowserWork();
	await expect( fixture.request( { type: InterruptionPageRequestType.CHECKPOINT,
		documentVisible: true, displayedFocusedDurationMilliseconds: 3_000 } ) )
		.resolves.toMatchObject( { state: InterruptionPageResponseState.WAITING, focusedProgressMilliseconds: 3_000 } );
} );

it( 'keeps a cold pause unavailable when backup recovery fails', async () => {
	const fixture = await createStartupFixture( BackupImportJournalKey, true );
	const response = fixture.request( { type: InterruptionPageRequestType.RECOVER, documentVisible: true } );
	fixture.releaseRecovery();
	await expect( response ).resolves.toEqual( { state: InterruptionPageResponseState.UNAVAILABLE } );
	await settleBrowserWork();
	expect( await fakeBrowser.storage.session.get( ProtectionStorageKey.SESSION ) ).toMatchObject( {
		[ ProtectionStorageKey.SESSION ]: { document: { scopes: {
			[ DefaultProtectionScopeId ]: { waitId: 'wait-a', confirmedFocusedDurationMilliseconds: 3_000 },
		} } },
	} );
} );

it( 'waits for startup before creating a pause from a fresh navigation carrier', async () => {
	const fixture = await createStartupFixture( BackupImportJournalKey, false, 'https://example.com/new-visit' );
	let responded = false;
	const response = fixture.requestRedirect().then( ( result ) => {
		responded = true;
		return result;
	} );
	await settleBrowserWork();
	const respondedBeforeRecovery = responded;
	fixture.releaseRecovery();
	const result = await response;
	await settleBrowserWork();
	expect( respondedBeforeRecovery ).toBe( false );
	expect( result ).toEqual( { url: fixture.interruptionUrl } );
	await expect( fixture.requestRedirect() ).resolves.toEqual( { url: fixture.interruptionUrl } );
	await fakeBrowser.tabs.update( fixture.tab.id, { url: fixture.interruptionUrl } );
	fixture.sender.url = fixture.interruptionUrl;
	fixture.sender.tab = { ...fixture.tab, url: fixture.interruptionUrl };
	await expect( fixture.request( { type: InterruptionPageRequestType.CONNECT, documentVisible: true } ) )
		.resolves.toMatchObject( { state: InterruptionPageResponseState.WAITING, focusedProgressMilliseconds: 0 } );
	expect( await fakeBrowser.storage.session.get( ProtectionStorageKey.SESSION ) ).toMatchObject( {
		[ ProtectionStorageKey.SESSION ]: { document: { scopes: {
			[ DefaultProtectionScopeId ]: { participants: [ { retainedDestination: 'https://example.com/new-visit' } ] },
		} } },
	} );
} );

it( 'returns no carrier replacement when initial recovery fails', async () => {
	const fixture = await createStartupFixture( BackupImportJournalKey, true, 'https://example.com/new-visit' );
	const response = fixture.requestRedirect();
	fixture.releaseRecovery();
	await expect( response ).resolves.toEqual( { url: null } );
	await settleBrowserWork();
} );
