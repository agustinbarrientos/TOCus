import { type PreferencesDocument, ThemeMode, Palette, Language } from '../../../../domains/preferences/types';
import {
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	createDraft,
} from './index';


describe( 'Settings draft', () => {
	it( 'notifies subscriptions until cleanup and uses a domain equality predicate', () => {
		const initial = { duration: 10, label: 'first' };
		const draft = createDraft( initial, ( left, right ) => left.duration === right.duration );
		const listener = vi.fn();
		const unsubscribe = draft.subscribe( listener );
		expect( draft.baseline ).toBe( initial );
		draft.change( { duration: 10, label: 'renamed' } );
		expect( draft.snapshot.dirty ).toBe( false );
		expect( listener ).toHaveBeenCalledOnce();
		unsubscribe();
		draft.change( { duration: 20, label: 'renamed' } );
		expect( draft.snapshot.dirty ).toBe( true );
		expect( listener ).toHaveBeenCalledOnce();
	} );
	it( 'skips clean and duplicate saves while retaining non-Error rejection feedback', async () => {
		const draft = createDraft( { duration: 10 } );
		const persist = vi.fn().mockResolvedValue( { duration: 20 } );
		await draft.save( persist );
		expect( persist ).not.toHaveBeenCalled();
		draft.change( { duration: 20 } );
		let reject!: ( reason: unknown ) => void;
		const saving = draft.save( () => new Promise( ( _resolve, fail ) => {
			reject = fail;
		} ) );
		await draft.save( persist );
		expect( persist ).not.toHaveBeenCalled();
		reject( 'unavailable' );
		await saving;
		expect( draft.snapshot ).toMatchObject( { error: 'persistence', dirty: true, saving: false } );
	} );
	it( 'clears previous success when adopting another authoritative scope', async () => {
		const draft = createDraft( { scope: 'first', value: 1 } );
		draft.change( { scope: 'first', value: 2 } );
		await draft.save( ( value ) => Promise.resolve( value ) );
		draft.adopt( { scope: 'second', value: 3 } );
		expect( draft.snapshot.saved ).toBe( false );
		expect( draft.snapshot.dirty ).toBe( false );
	} );
	it( 'retains success when an identical storage echo arrives after save', async () => {
		const draft = createDraft<Partial<PreferencesDocument>>( { language: Language.ENGLISH } );
		draft.change( { language: Language.JAPANESE } );
		await draft.save( ( value ) => Promise.resolve( value ) );
		draft.rebase( { language: Language.JAPANESE } );
		expect( draft.snapshot.saved ).toBe( true );
		expect( draft.snapshot.dirty ).toBe( false );
	} );
	it( 'keeps a newer external baseline while a save settles', async () => {
		const draft = createDraft<Partial<PreferencesDocument>>( {
			language: Language.ENGLISH, palette: Palette.BROWN,
		} );
		draft.change( { language: Language.JAPANESE, palette: Palette.BROWN } );
		const saving = draft.save( () => {
			draft.rebase( { language: Language.GERMAN, palette: Palette.BLUE } );
			return Promise.resolve( { language: Language.JAPANESE, palette: Palette.BROWN } );
		} );
		await saving;
		expect( draft.snapshot.value ).toEqual( { language: Language.JAPANESE, palette: Palette.BLUE } );
		expect( draft.snapshot.dirty ).toBe( true );
		draft.discard();
		expect( draft.snapshot.value ).toEqual( { language: Language.GERMAN, palette: Palette.BLUE } );
	} );
	it( 'retains rejected edits and restores the authoritative value on discard', async () => {
		const draft = createDraft( { duration: 10 } );
		draft.change( { duration: 20 } );
		await draft.save( () => Promise.reject( new Error( 'persistence' ) ) );
		expect( draft.snapshot ).toMatchObject( { value: { duration: 20 }, dirty: true, saving: false, error: 'persistence' } );
		draft.discard();
		expect( draft.snapshot ).toMatchObject( { value: { duration: 10 }, dirty: false, error: null } );
	} );
	it( 'locks edits during save and adopts the returned authoritative value', async () => {
		const draft = createDraft( { duration: 10 } );
		draft.change( { duration: 20 } );
		let finish!: ( value: { duration: number } ) => void;
		const saving = draft.save( () => new Promise( ( resolve ) => {
			finish = resolve;
		} ) );
		expect( draft.snapshot.saving ).toBe( true );
		draft.change( { duration: 30 } );
		draft.discard();
		expect( draft.snapshot.value.duration ).toBe( 20 );
		finish( { duration: 25 } );
		await saving;
		expect( draft.snapshot ).toMatchObject( { value: { duration: 25 }, dirty: false, saved: true } );
	} );
	it( 'merges external preferences around locally changed fields', () => {
		const draft = createDraft<Partial<PreferencesDocument>>( {
			theme: ThemeMode.LIGHT, language: Language.ENGLISH,
		} );
		draft.change( { theme: ThemeMode.DARK, language: Language.ENGLISH } );
		draft.rebase( { theme: ThemeMode.LIGHT, language: Language.GERMAN } );
		expect( draft.snapshot.value ).toEqual( { theme: ThemeMode.DARK, language: Language.GERMAN } );
		draft.discard();
		expect( draft.snapshot.value ).toEqual( { theme: ThemeMode.LIGHT, language: Language.GERMAN } );
	} );
} );
