import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createPreferencesStorageService } from '../../../../domains/preferences/services/preferences-storage';
import {
	DefaultPreferencesDocument,
	Language,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { createLocalizedToolbarCopy } from '../../../../localization/utils/create-localized-toolbar-copy';
import { ToolbarBadgeDurationUnit } from '../../utils/toolbar-badge-projection';
import { createToolbarLanguageController } from './index';

describe( 'createToolbarLanguageController', () => {
	beforeEach( () => {
		fakeBrowser.reset();
		vi.clearAllMocks();
	} );

	it( 'keeps every toolbar projection language-neutral while preferences are loading', () => {
		const deferredPreferences = Promise.withResolvers<PreferencesDocument | null>();
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: {
				load: vi.fn().mockReturnValue( deferredPreferences.promise ),
				save: vi.fn(),
			},
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( vi.fn().mockResolvedValue( undefined ) );

		expect( controller.copy.inactive ).toEqual( { text: '', title: 'TOCus' } );
		expect( controller.copy.formatActiveTitle( 'Pending' ) ).toBe( 'TOCus' );
		expect( controller.copy.formatMultipleIndicator( 2 ) ).toBe( '' );
		expect(
			controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ),
		).toEqual( { text: '', title: 'TOCus' } );
		expect(
			controller.copy.formatAllowance( 2, ToolbarBadgeDurationUnit.MINUTE ),
		).toEqual( { text: '', title: 'TOCus' } );
		expect(
			controller.copy.formatMultipleActive( 2, '2' ),
		).toEqual( { text: '', title: 'TOCus' } );
	} );

	it( 'restores the persisted language and refreshes the visible toolbar projection', async () => {
		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': {
				...DefaultPreferencesDocument,
				language: Language.JAPANESE,
			},
		} );
		const refreshToolbarBadge = vi.fn().mockResolvedValue( undefined );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: createPreferencesStorageService( { area: fakeBrowser.storage.local } ),
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );

		await vi.waitFor( () => {
			expect( controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title ).toBe(
				'\u4e00\u6642\u505c\u6b62\uff1a\u6b8b\u308a 2 \u79d2',
			);
		} );
		expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
	} );

	it( 'updates toolbar copy after the local language preference changes', async () => {
		const refreshToolbarBadge = vi.fn().mockResolvedValue( undefined );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: createPreferencesStorageService( { area: fakeBrowser.storage.local } ),
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );
		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
		} );
		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': {
				...DefaultPreferencesDocument,
				language: Language.SPANISH_VOS,
			},
		} );

		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledTimes( 2 );
		} );
		expect(
			controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
		).toBe( 'Pausa: quedan 2 segundos' );
	} );

	it( 'does not refresh when a local change keeps the same effective language', async () => {
		const refreshToolbarBadge = vi.fn().mockResolvedValue( undefined );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: createPreferencesStorageService( { area: fakeBrowser.storage.local } ),
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );
		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
		} );
		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': DefaultPreferencesDocument,
		} );

		expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
	} );

	it( 'ignores unrelated storage activity and falls back to browser language after invalid preferences', async () => {
		const refreshToolbarBadge = vi.fn().mockResolvedValue( undefined );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: createPreferencesStorageService( { area: fakeBrowser.storage.local } ),
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );
		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
		} );
		await fakeBrowser.storage.session.set( {
			'tocus.preferences.v1': {
				...DefaultPreferencesDocument,
				language: Language.SPANISH_VOS,
			},
		} );
		await fakeBrowser.storage.local.set( { unrelated: true } );
		expect( refreshToolbarBadge ).toHaveBeenCalledOnce();

		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': {
				...DefaultPreferencesDocument,
				language: Language.SPANISH_VOS,
			},
		} );
		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': { schemaVersion: 999 },
		} );

		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledTimes( 3 );
		} );
		expect(
			controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
		).toBe( 'Pause: 2 seconds remaining' );
	} );

	it( 'uses browser language when the local preference is removed', async () => {
		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': {
				...DefaultPreferencesDocument,
				language: Language.SPANISH_VOS,
			},
		} );
		const refreshToolbarBadge = vi.fn().mockResolvedValue( undefined );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: createPreferencesStorageService( { area: fakeBrowser.storage.local } ),
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );
		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
		} );
		await fakeBrowser.storage.onChanged.trigger( {
			'tocus.preferences.v1': {
				oldValue: {
					...DefaultPreferencesDocument,
					language: Language.SPANISH_VOS,
				},
			},
		}, 'local' );

		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledTimes( 2 );
		} );
		expect(
			controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
		).toBe( 'Pause: 2 seconds remaining' );
	} );

	it( 'does not let a stale preferences read replace a newer storage event', async () => {
		const deferredPreferences = Promise.withResolvers<PreferencesDocument | null>();
		const refreshToolbarBadge = vi.fn().mockResolvedValue( undefined );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: {
				load: vi.fn().mockReturnValue( deferredPreferences.promise ),
				save: vi.fn(),
			},
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );
		await fakeBrowser.storage.local.set( {
			'tocus.preferences.v1': {
				...DefaultPreferencesDocument,
				language: Language.SPANISH_VOS,
			},
		} );
		deferredPreferences.resolve( {
			...DefaultPreferencesDocument,
			language: Language.JAPANESE,
		} );
		await deferredPreferences.promise;

		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
		} );
		expect(
			controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
		).toBe( 'Pausa: quedan 2 segundos' );
	} );

	it( 'keeps toolbar localization failures outside the protection lifecycle', async () => {
		const refreshToolbarBadge = vi.fn().mockRejectedValue( new Error( 'Refresh failed.' ) );
		const controller = createToolbarLanguageController( {
			browserLanguage: Language.ENGLISH,
			createToolbarCopy: createLocalizedToolbarCopy,
			storage: {
				load: vi.fn().mockRejectedValue( new Error( 'Read failed.' ) ),
				save: vi.fn(),
			},
			storageChanges: fakeBrowser.storage.onChanged,
		} );

		controller.start( refreshToolbarBadge );

		await vi.waitFor( () => {
			expect( refreshToolbarBadge ).toHaveBeenCalledOnce();
		} );
		expect(
			controller.copy.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
		).toBe( 'Pause: 2 seconds remaining' );
	} );
} );
