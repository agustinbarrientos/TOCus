import { describe, expect, it, vi } from 'vitest';
import {
	DefaultPreferencesDocument,
	Palette,
	PauseMode,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { PreferencesStorageKey } from '../../../../domains/preferences/services/preferences-storage';
import {
	createPreferencesController,
	type PreferencesStorageChangeListener,
	type PreferencesStorageChangeSource,
	type PreferencesSystemMotionPreference,
} from './index';

/**
 * Mutable system motion preference used by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemorySystemMotionPreference extends EventTarget implements PreferencesSystemMotionPreference {
	matches = false;

	/**
	 * Updates the preference and emits its native change event.
	 * @param matches - Whether the operating system requests reduced motion.
	 * @since 0.1.0 Initial implementation.
	 */
	setMatches( matches: boolean ): void {
		this.matches = matches;
		this.dispatchEvent( new Event( 'change' ) );
	}
}

/**
 * Mutable storage-change source used by controller tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryPreferencesStorageChangeSource implements PreferencesStorageChangeSource {
	private readonly listeners = new Set<PreferencesStorageChangeListener>();

	/**
	 * Reports the number of currently active storage-change listeners.
	 * @return Active listener count.
	 * @since 0.1.0 Initial implementation.
	 */
	get listenerCount(): number {
		return this.listeners.size;
	}

	/**
	 * Begins delivering storage changes to one listener.
	 * @param listener - Preferences storage listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addListener( listener: PreferencesStorageChangeListener ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops delivering storage changes to one listener.
	 * @param listener - Preferences storage listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeListener( listener: PreferencesStorageChangeListener ): void {
		this.listeners.delete( listener );
	}

	/**
	 * Emits one local preference change.
	 * @param newValue - New value stored under the preferences key.
	 * @param areaName - Browser storage area that changed.
	 * @since 0.1.0 Initial implementation.
	 */
	emit( newValue: unknown, areaName = 'local' ): void {
		for ( const listener of this.listeners ) {
			listener( {
				[ PreferencesStorageKey.PREFERENCES ]: { newValue },
			}, areaName );
		}
	}

	/**
	 * Emits one unrelated local storage change.
	 * @since 0.1.0 Initial implementation.
	 */
	emitUnrelated(): void {
		for ( const listener of this.listeners ) {
			listener( { unrelated: { newValue: true } }, 'local' );
		}
	}
}

/**
 * Creates one complete nondefault preferences fixture.
 * @param overrides - Preference fields to replace.
 * @return Valid complete preferences fixture.
 * @since 0.1.0 Initial implementation.
 */
function createPreferences(
	overrides: Partial<PreferencesDocument> = {},
): PreferencesDocument {
	return {
		...DefaultPreferencesDocument,
		theme: ThemeMode.DARK,
		palette: Palette.PURPLE,
		pauseMode: PauseMode.QUIET,
		...overrides,
	};
}

/**
 * Provides an inert initial callback before a deferred load captures its resolver.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignoreDeferredResolution(): undefined {
	return undefined;
}

/**
 * Provides an inert initial callback before a deferred load captures its rejection.
 * @param reason - Unused rejection reason.
 * @return Undefined inert result.
 * @since 0.1.0 Initial implementation.
 */
function ignoreDeferredRejection( reason?: unknown ): undefined {
	void reason;

	return undefined;
}

/**
 * Creates one controller fixture around injected test doubles.
 * @param preferences - Preferences returned by the initial local read.
 * @return Controller and observable dependencies.
 * @since 0.1.0 Initial implementation.
 */
function createFixture( preferences: PreferencesDocument | null = createPreferences() ) {
	const attributes = new Map<string, string>();
	const target = {
		setAttribute: vi.fn<( name: string, value: string ) => void>( ( name, value ) => {
			attributes.set( name, value );
		} ),
	};
	const presentation = { mode: PauseMode.BREATHING };
	const storage = { load: vi.fn().mockResolvedValue( preferences ), save: vi.fn() };
	const storageChanges = new MemoryPreferencesStorageChangeSource();
	const systemMotionPreference = new MemorySystemMotionPreference();
	const controller = createPreferencesController( {
		appearanceTarget: target,
		presentation,
		storage,
		storageChanges,
		systemMotionPreference,
	} );

	return {
		attributes,
		controller,
		presentation,
		storage,
		storageChanges,
		systemMotionPreference,
		target,
	};
}

describe( 'createPreferencesController', () => {
	it( 'projects persisted appearance and pause preferences', async () => {
		const fixture = createFixture();

		await fixture.controller.start();

		expect( fixture.attributes ).toEqual( new Map( [
			[ 'data-tocus-theme', 'dark' ],
			[ 'data-tocus-palette', 'purple' ],
			[ 'data-tocus-reduced-motion', 'false' ],
		] ) );
		expect( fixture.presentation.mode ).toBe( PauseMode.QUIET );
		expect( fixture.controller.matches ).toBe( false );
	} );

	it( 'projects appearance without requiring an interruption presentation', async () => {
		const target = { setAttribute: vi.fn() };
		const controller = createPreferencesController( {
			appearanceTarget: target,
			storage: { load: vi.fn().mockResolvedValue( createPreferences() ), save: vi.fn() },
			storageChanges: new MemoryPreferencesStorageChangeSource(),
			systemMotionPreference: new MemorySystemMotionPreference(),
		} );

		await controller.start();

		expect( target.setAttribute ).toHaveBeenCalledWith( 'data-tocus-theme', ThemeMode.DARK );
		expect( target.setAttribute ).toHaveBeenCalledWith( 'data-tocus-palette', Palette.PURPLE );
		expect( target.setAttribute ).toHaveBeenCalledWith( 'data-tocus-reduced-motion', 'false' );
	} );

	it( 'combines the stored setting with the operating-system motion preference', async () => {
		const fixture = createFixture( createPreferences( { reducedMotion: false } ) );
		const listener = vi.fn();

		fixture.controller.addEventListener( 'change', listener );
		await fixture.controller.start();
		fixture.systemMotionPreference.setMatches( true );

		expect( fixture.controller.matches ).toBe( true );
		expect( fixture.attributes.get( 'data-tocus-reduced-motion' ) ).toBe( 'true' );
		expect( listener ).toHaveBeenCalledTimes( 1 );

		fixture.systemMotionPreference.setMatches( false );

		expect( fixture.controller.matches ).toBe( false );
		expect( fixture.attributes.get( 'data-tocus-reduced-motion' ) ).toBe( 'false' );
		expect( listener ).toHaveBeenCalledTimes( 2 );

		fixture.controller.removeEventListener( 'change', listener );
		fixture.systemMotionPreference.setMatches( true );

		expect( listener ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'keeps reduced motion active when the user setting is enabled', async () => {
		const fixture = createFixture( createPreferences( { reducedMotion: true } ) );
		const listener = vi.fn();

		fixture.controller.addEventListener( 'change', listener );
		await fixture.controller.start();
		fixture.systemMotionPreference.setMatches( true );
		fixture.systemMotionPreference.setMatches( false );

		expect( fixture.controller.matches ).toBe( true );
		expect( listener ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'applies valid local storage changes and ignores unrelated changes', async () => {
		const fixture = createFixture();

		await fixture.controller.start();
		fixture.storageChanges.emitUnrelated();
		fixture.storageChanges.emit( createPreferences( {
			theme: ThemeMode.LIGHT,
			palette: Palette.GREEN,
			pauseMode: PauseMode.BREATHING,
			reducedMotion: true,
		} ) );

		expect( fixture.attributes ).toEqual( new Map( [
			[ 'data-tocus-theme', 'light' ],
			[ 'data-tocus-palette', 'green' ],
			[ 'data-tocus-reduced-motion', 'true' ],
		] ) );
		expect( fixture.presentation.mode ).toBe( PauseMode.BREATHING );
		expect( fixture.controller.matches ).toBe( true );
	} );

	it( 'delivers complete preference projections to active settings listeners', async () => {
		const fixture = createFixture();
		const listener = vi.fn();

		fixture.controller.addPreferencesChangeListener( listener );
		await fixture.controller.start();
		listener.mockClear();
		const preferences = createPreferences( {
			palette: Palette.ORANGE,
			theme: ThemeMode.LIGHT,
		} );

		fixture.storageChanges.emit( preferences );
		expect( listener ).toHaveBeenCalledWith( preferences );

		fixture.controller.removePreferencesChangeListener( listener );
		fixture.storageChanges.emit( createPreferences() );
		expect( listener ).toHaveBeenCalledOnce();
	} );

	it( 'falls back safely when loaded preferences are unavailable', async () => {
		const fixture = createFixture( null );

		await fixture.controller.start();

		expect( fixture.attributes ).toEqual( new Map( [
			[ 'data-tocus-theme', 'system' ],
			[ 'data-tocus-palette', 'brown' ],
			[ 'data-tocus-reduced-motion', 'false' ],
		] ) );
		expect( fixture.presentation.mode ).toBe( PauseMode.BREATHING );
	} );

	it( 'falls back safely when the initial storage read rejects', async () => {
		const fixture = createFixture();

		fixture.storage.load.mockRejectedValueOnce( new Error( 'Local read unavailable.' ) );
		await fixture.controller.start();

		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.SYSTEM );
		expect( fixture.attributes.get( 'data-tocus-palette' ) ).toBe( Palette.BROWN );
	} );

	it( 'uses defaults after the preferences key is removed or replaced with malformed data', async () => {
		const fixture = createFixture();
		const listener = vi.fn();

		fixture.controller.addPreferencesChangeListener( listener );
		await fixture.controller.start();
		listener.mockClear();
		fixture.storageChanges.emit( undefined );
		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.SYSTEM );
		expect( listener ).toHaveBeenLastCalledWith( DefaultPreferencesDocument );

		fixture.storageChanges.emit( { ...DefaultPreferencesDocument, palette: 'teal' } );
		expect( fixture.attributes.get( 'data-tocus-palette' ) ).toBe( Palette.BROWN );
		expect( listener ).toHaveBeenLastCalledWith( null );
	} );

	it( 'does not let a stale initial read replace a newer storage event', async () => {
		let resolveLoad: ( preferences: PreferencesDocument ) => void = ignoreDeferredResolution;
		const fixture = createFixture();

		fixture.storage.load.mockReturnValueOnce( new Promise<PreferencesDocument>( ( resolve ) => {
			resolveLoad = resolve;
		} ) );
		const startPromise = fixture.controller.start();
		fixture.storageChanges.emit( createPreferences( {
			theme: ThemeMode.LIGHT,
			palette: Palette.ORANGE,
		} ) );
		resolveLoad( createPreferences() );
		await startPromise;

		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.LIGHT );
		expect( fixture.attributes.get( 'data-tocus-palette' ) ).toBe( Palette.ORANGE );
	} );

	it( 'does not let a failed initial read replace a newer in-memory preview', async () => {
		let rejectLoad: ( reason?: unknown ) => void = ignoreDeferredRejection;
		const fixture = createFixture();

		fixture.storage.load.mockReturnValueOnce( new Promise<PreferencesDocument>( (
			_resolve,
			reject,
		) => {
			rejectLoad = reject;
		} ) );
		const startPromise = fixture.controller.start();
		fixture.controller.apply( createPreferences( {
			theme: ThemeMode.LIGHT,
			palette: Palette.PINK,
		} ) );
		rejectLoad( new Error( 'Local read unavailable.' ) );
		await startPromise;

		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.LIGHT );
		expect( fixture.attributes.get( 'data-tocus-palette' ) ).toBe( Palette.PINK );
	} );

	it( 'projects an immediate valid preview without persisting it', async () => {
		const fixture = createFixture();

		await fixture.controller.start();
		fixture.controller.apply( createPreferences( {
			theme: ThemeMode.LIGHT,
			palette: Palette.PINK,
		} ) );

		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.LIGHT );
		expect( fixture.attributes.get( 'data-tocus-palette' ) ).toBe( Palette.PINK );
		expect( fixture.storage.save ).not.toHaveBeenCalled();
	} );

	it( 'stops reacting after disconnection', async () => {
		const fixture = createFixture();

		await fixture.controller.start();
		fixture.controller.stop();
		fixture.storageChanges.emit( createPreferences( { theme: ThemeMode.LIGHT } ) );
		fixture.systemMotionPreference.setMatches( true );

		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.DARK );
		expect( fixture.controller.matches ).toBe( false );
	} );

	it( 'keeps repeated lifecycle calls idempotent', async () => {
		const fixture = createFixture();

		await fixture.controller.start();
		await fixture.controller.start();
		fixture.controller.stop();
		fixture.controller.stop();

		expect( fixture.storage.load ).toHaveBeenCalledOnce();
	} );

	it( 'keeps concurrent start callers pending until the initial read settles', async () => {
		let resolveLoad: ( preferences: PreferencesDocument ) => void = ignoreDeferredResolution;
		const fixture = createFixture();

		fixture.storage.load.mockReturnValueOnce( new Promise<PreferencesDocument>( ( resolve ) => {
			resolveLoad = resolve;
		} ) );
		let secondStartSettled = false;
		const firstStart = fixture.controller.start();
		const secondStart = fixture.controller.start().then( () => {
			secondStartSettled = true;
		} );

		await Promise.resolve();
		expect( secondStartSettled ).toBe( false );
		resolveLoad( createPreferences() );
		await Promise.all( [ firstStart, secondStart ] );
		expect( fixture.storage.load ).toHaveBeenCalledOnce();
	} );

	it( 'ignores a pending initial read after stopping', async () => {
		let resolveLoad: ( preferences: PreferencesDocument ) => void = ignoreDeferredResolution;
		const fixture = createFixture();

		fixture.storage.load.mockReturnValueOnce( new Promise<PreferencesDocument>( ( resolve ) => {
			resolveLoad = resolve;
		} ) );
		const startPromise = fixture.controller.start();

		fixture.controller.stop();
		resolveLoad( createPreferences() );
		await startPromise;

		expect( fixture.attributes.get( 'data-tocus-theme' ) ).toBe( ThemeMode.SYSTEM );
		expect( fixture.attributes.get( 'data-tocus-palette' ) ).toBe( Palette.BROWN );
	} );

	it( 'releases a failed startup projection', async () => {
		const fixture = createFixture();

		fixture.target.setAttribute.mockImplementation( ( name, value ) => {
			if ( name === 'data-tocus-theme' && value === ThemeMode.DARK ) {
				throw new Error( 'Appearance target unavailable.' );
			}

			fixture.attributes.set( name, value );
		} );

		await expect( fixture.controller.start() ).rejects.toThrow(
			'Appearance target unavailable.',
		);
		expect( fixture.storageChanges.listenerCount ).toBe( 0 );

		fixture.target.setAttribute.mockImplementation( ( name, value ) => {
			fixture.attributes.set( name, value );
		} );
		await fixture.controller.start();

		expect( fixture.storage.load ).toHaveBeenCalledTimes( 2 );
		expect( fixture.storageChanges.listenerCount ).toBe( 1 );
	} );

	it( 'returns a rejected promise and removes observers when default projection fails', async () => {
		const fixture = createFixture();

		fixture.target.setAttribute.mockImplementation( () => {
			throw new Error( 'Appearance target unavailable.' );
		} );
		const startOperation = fixture.controller.start();

		await expect( startOperation ).rejects.toThrow( 'Appearance target unavailable.' );
		expect( fixture.storage.load ).not.toHaveBeenCalled();
		expect( fixture.storageChanges.listenerCount ).toBe( 0 );
	} );
} );
