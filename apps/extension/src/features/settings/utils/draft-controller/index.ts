import type {
	DraftSnapshot,
	DraftEquality,
} from './types';


/**
 * Keeps edits, persistence feedback and authoritative values independently observable.
 * @param initial - Safe initial value used before the first authoritative load.
 * @param equals - Optional domain-aware comparison, defaulting to structural JSON equality.
 * @return Controller whose immutable snapshots integrate with React subscriptions.
 * @since 0.1.0
 */
export function createDraft<T extends object>( initial: T, equals?: DraftEquality<T> ) {
	let baseline = initial;
	let revision = 0;
	let snapshot: DraftSnapshot<T> = {
		value: initial, dirty: false, saving: false, saved: false, error: null,
	};
	const listeners = new Set<() => void>();

	/**
	 * Recomputes dirty state and notifies every subscribed rendering consumer.
	 * @param changes - Presentation fields replaced by this transition.
	 */
	function emit( changes: Partial<DraftSnapshot<T>> ): void {
		snapshot = { ...snapshot, ...changes };
		snapshot.dirty = equals ? ! equals( snapshot.value, baseline )
			: JSON.stringify( snapshot.value ) !== JSON.stringify( baseline );
		listeners.forEach( ( listener ) => {
			listener();
		} );
	}

	return {
		/**
		 * Reads the stable snapshot reference consumed by React.
		 * @return Current immutable presentation state.
		 */
		get snapshot() {
			return snapshot;
		},
		/**
		 * Reads the latest authoritative value used by Discard and partial updates.
		 * @return Latest accepted storage value.
		 */
		get baseline() {
			return baseline;
		},
		/**
		 * Observes draft transitions without coupling the controller to React.
		 * @param listener - Callback invoked after each snapshot replacement.
		 * @return Subscription cleanup callback.
		 */
		subscribe: ( listener: () => void ) => {
			listeners.add( listener );
			return () => {
				listeners.delete( listener );
			};
		},
		/**
		 * Applies an edit unless persistence currently owns the draft.
		 * @param value - Complete next candidate.
		 */
		change: ( value: T ): void => {
			if ( ! snapshot.saving ) {
				emit( { value, saved: false, error: null } );
			}
		},
		/** Restores the latest authoritative value without writing storage. */
		discard: (): void => {
			if ( ! snapshot.saving ) {
				emit( { value: baseline, saved: false, error: null } );
			}
		},
		/**
		 * Accepts a complete value from an initial load or explicit recovery.
		 * @param value - Validated authoritative value.
		 */
		adopt: ( value: T ): void => {
			revision++;
			baseline = value;
			emit( { value, error: null, saved: false } );
		},
		/**
		 * Merges external preference changes around fields edited in this page.
		 * @param value - Newly authoritative preference projection.
		 */
		rebase: ( value: T ): void => {
			if ( JSON.stringify( value ) === JSON.stringify( baseline ) ) {
				return;
			}
			revision++;
			const merged = { ...value };
			for ( const key in value ) {
				if ( snapshot.value[ key ] !== baseline[ key ] ) {
					merged[ key ] = snapshot.value[ key ];
				}
			}
			baseline = value;
			emit( { value: merged, saved: false } );
		},
		/**
		 * Locks the candidate until persistence settles, retaining failed edits.
		 * @param persist - Domain operation returning its authoritative stored value.
		 * @return Completion of the save and its observable feedback.
		 */
		save: async ( persist: ( value: T ) => Promise<T> ): Promise<void> => {
			if ( snapshot.saving || ! snapshot.dirty ) {
				return;
			}
			emit( { saving: true, saved: false, error: null } );
			const savedRevision = revision;
			try {
				const value = await persist( snapshot.value );
				// A storage echo or external update may already have supplied a newer baseline.
				if ( revision === savedRevision ) {
					baseline = value;
					emit( { value, saved: true } );
				} else {
					emit( { saved: true } );
				}
			} catch ( error ) {
				emit( { error: error instanceof Error ? error.message : 'persistence' } );
			} finally {
				emit( { saving: false } );
			}
		},
	};
}
