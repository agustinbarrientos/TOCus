import {
	DefaultPreferencesDocument,
	PreferencesDocumentSchema,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { PreferencesStorageKey } from '../../../../domains/preferences/services/preferences-storage';
import {
	type PreferencesController,
	type PreferencesControllerOptions,
	type PreferencesChangeListener,
	type PreferencesStorageChanges,
} from './types';

/**
 * Creates a live projection of local preferences for one extension context.
 * @param options - Persistence, browser preference, and presentation dependencies.
 * @return Preference lifecycle and effective reduced-motion source.
 * @since 0.1.0 Initial implementation.
 */
export function createPreferencesController(
	options: PreferencesControllerOptions,
): PreferencesController {
	const motionChangeTarget = new EventTarget();
	const preferencesChangeListeners = new Set<PreferencesChangeListener>();
	let preferences: Readonly<PreferencesDocument> = DefaultPreferencesDocument;
	let effectiveReducedMotion = false;
	let lifecycleGeneration = 0;
	let projectionRevision = 0;
	let observing = false;
	let startPromise: Promise<void> | null = null;

	/**
	 * Synchronizes the effective reduced-motion value and notifies active consumers.
	 * @since 0.1.0 Initial implementation.
	 */
	function synchronizeReducedMotion(): void {
		const nextReducedMotion = preferences.reducedMotion || options.systemMotionPreference.matches;
		options.appearanceTarget.setAttribute(
			'data-tocus-reduced-motion',
			String( nextReducedMotion ),
		);

		if ( effectiveReducedMotion === nextReducedMotion ) {
			return;
		}

		effectiveReducedMotion = nextReducedMotion;
		motionChangeTarget.dispatchEvent( new Event( 'change' ) );
	}

	/**
	 * Projects one complete preference document into this extension context.
	 * @param nextPreferences - Complete validated preferences to project.
	 * @since 0.1.0 Initial implementation.
	 */
	function projectPreferences( nextPreferences: PreferencesDocument ): void {
		preferences = nextPreferences;
		options.appearanceTarget.setAttribute( 'data-tocus-theme', nextPreferences.theme );
		options.appearanceTarget.setAttribute( 'data-tocus-palette', nextPreferences.palette );

		if ( options.presentation !== undefined ) {
			options.presentation.mode = nextPreferences.pauseMode;
		}

		synchronizeReducedMotion();
	}

	/**
	 * Projects one validated storage result and publishes its recoverability state.
	 * @param nextPreferences - Valid preferences or a malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	function applyStoredPreferences( nextPreferences: PreferencesDocument | null ): void {
		projectionRevision += 1;
		projectPreferences( nextPreferences ?? DefaultPreferencesDocument );

		for ( const listener of preferencesChangeListeners ) {
			listener( nextPreferences );
		}
	}

	/**
	 * Projects one in-memory preference preview and publishes its validated state.
	 * @param nextPreferences - Complete preferences to preview.
	 * @since 0.1.0 Initial implementation.
	 */
	function apply( nextPreferences: PreferencesDocument ): void {
		applyStoredPreferences( nextPreferences );
	}

	/**
	 * Begins delivering validated preferences projections and malformed-data markers to one listener.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	function addPreferencesChangeListener( listener: PreferencesChangeListener ): void {
		preferencesChangeListeners.add( listener );
	}

	/**
	 * Resolves one unknown stored value to validated preferences or a malformed-data marker.
	 * @param input - Unknown value supplied by browser storage.
	 * @return Valid preferences, safe defaults for a removed key, or null for malformed data.
	 * @since 0.1.0 Initial implementation.
	 */
	function resolveStoredPreferences( input: unknown ): PreferencesDocument | null {
		if ( input === undefined ) {
			return DefaultPreferencesDocument;
		}

		const result = PreferencesDocumentSchema.safeParse( input );

		return result.success ? result.data : null;
	}

	/**
	 * Recomputes effective motion after an operating-system preference change.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleSystemMotionChange(): void {
		synchronizeReducedMotion();
	}

	/**
	 * Applies one relevant local preferences change from another extension context.
	 * @param changes - Browser storage changes indexed by key.
	 * @param areaName - Browser storage area that changed.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleStorageChange( changes: PreferencesStorageChanges, areaName: string ): void {
		if (
			! observing ||
			areaName !== 'local' ||
			! Object.hasOwn( changes, PreferencesStorageKey.PREFERENCES )
		) {
			return;
		}

		applyStoredPreferences(
			resolveStoredPreferences( changes[ PreferencesStorageKey.PREFERENCES ]?.newValue ),
		);
	}

	/**
	 * Begins delivering effective motion changes to one listener.
	 * @param type - Effective motion change event name.
	 * @param listener - Effective motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	function addEventListener(
		type: 'change',
		listener: EventListenerOrEventListenerObject,
	): void {
		motionChangeTarget.addEventListener( type, listener );
	}

	/**
	 * Stops delivering effective motion changes to one listener.
	 * @param type - Effective motion change event name.
	 * @param listener - Effective motion change listener.
	 * @since 0.1.0 Initial implementation.
	 */
	function removeEventListener(
		type: 'change',
		listener: EventListenerOrEventListenerObject,
	): void {
		motionChangeTarget.removeEventListener( type, listener );
	}

	/**
	 * Stops delivering validated preferences projections and malformed-data markers to one listener.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	function removePreferencesChangeListener( listener: PreferencesChangeListener ): void {
		preferencesChangeListeners.delete( listener );
	}

	/**
	 * Reads local preferences and converts read failures to the safe runtime fallback.
	 * @return Stored preferences or null when the read is unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	async function loadPreferences(): Promise<PreferencesDocument | null> {
		try {
			return await options.storage.load();
		} catch {
			return null;
		}
	}

	/**
	 * Completes one initial preferences read without allowing stale data to win.
	 * @param currentGeneration - Lifecycle generation that started the read.
	 * @param initialProjectionRevision - Projection revision observed before the read.
	 * @return Promise resolved after the initial local read settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function completeStart(
		currentGeneration: number,
		initialProjectionRevision: number,
	): Promise<void> {
		const loadedPreferences = await loadPreferences();

		if (
			currentGeneration !== lifecycleGeneration ||
			initialProjectionRevision !== projectionRevision
		) {
			return;
		}

		projectPreferences( loadedPreferences ?? DefaultPreferencesDocument );
	}

	/**
	 * Releases the retained startup operation when the same operation settles.
	 * @param operation - Startup operation that settled.
	 * @since 0.1.0 Initial implementation.
	 */
	function releaseStartPromise( operation: Promise<void> ): void {
		if ( startPromise === operation ) {
			startPromise = null;
		}
	}

	/**
	 * Disconnects active browser preference observers and invalidates pending startup work.
	 * @since 0.1.0 Initial implementation.
	 */
	function disconnectObservers(): void {
		observing = false;
		lifecycleGeneration += 1;
		options.storageChanges.removeListener( handleStorageChange );
		options.systemMotionPreference.removeEventListener( 'change', handleSystemMotionChange );
	}

	/**
	 * Rolls back observers when the active startup operation fails.
	 * @since 0.1.0 Initial implementation.
	 */
	function handleStartFailure(): void {
		disconnectObservers();
		startPromise = null;
	}

	/**
	 * Loads and begins observing preferences without allowing a stale read to win.
	 * @return Promise resolved after the initial local read settles.
	 * @since 0.1.0 Initial implementation.
	 */
	async function start(): Promise<void> {
		if ( startPromise !== null ) {
			return startPromise;
		}

		if ( observing ) {
			return Promise.resolve();
		}

		observing = true;
		lifecycleGeneration += 1;
		const currentGeneration = lifecycleGeneration;
		const initialProjectionRevision = projectionRevision;

		try {
			options.storageChanges.addListener( handleStorageChange );
			options.systemMotionPreference.addEventListener( 'change', handleSystemMotionChange );
			projectPreferences( DefaultPreferencesDocument );
		} catch ( error ) {
			disconnectObservers();

			throw error;
		}

		const operation = completeStart( currentGeneration, initialProjectionRevision );

		startPromise = operation;
		void operation.then(
			() => {
				releaseStartPromise( operation );
			},
			() => {
				handleStartFailure();
			},
		);

		return operation;
	}

	/**
	 * Stops every preference observer owned by this context.
	 * @since 0.1.0 Initial implementation.
	 */
	function stop(): void {
		if ( ! observing ) {
			return;
		}

		disconnectObservers();
		startPromise = null;
	}

	return {
		/**
		 * Reports whether either the user or operating system currently requests reduced motion.
		 * @return Effective reduced-motion preference.
		 * @since 0.1.0 Initial implementation.
		 */
		get matches(): boolean {
			return effectiveReducedMotion;
		},
		addEventListener,
		addPreferencesChangeListener,
		apply,
		removeEventListener,
		removePreferencesChangeListener,
		start,
		stop,
	};
}

export * from './types';
