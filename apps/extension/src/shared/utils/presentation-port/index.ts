/**
 * Creates the mutable EventTarget boundary consumed by existing page controllers.
 * @param initial - Initial presentation state.
 * @param onChange - Receives each coherent immutable projection.
 * @return Mutable controller-facing state and synchronous user events.
 * @since 0.1.0
 */
export function createPresentationPort<T extends object>(
	initial: T,
	onChange: ( snapshot: Readonly<T> ) => void,
): T & EventTarget {
	const state = { ...initial };
	const port = Object.assign( new EventTarget(), initial );
	let queued = false;

	/** Batches synchronous controller writes without delaying user-gesture events. */
	function schedule(): void {
		if ( queued ) {
			return;
		}
		queued = true;
		queueMicrotask( () => {
			queued = false;
			onChange( Object.freeze( { ...state } ) );
		} );
	}
	for ( const key in initial ) {
		if ( ! Object.hasOwn( initial, key ) ) {
			continue;
		}
		Object.defineProperty( port, key, {
			enumerable: true,
			/**
			 * Reads the most recent controller assignment, even before React renders it.
			 * @return The current value of this declared presentation field.
			 */
			get() {
				return state[ key ];
			},
			/**
			 * Updates a declared field and requests one coherent render.
			 * @param value - Next controller-owned field value.
			 */
			set( value: T[ typeof key ] ) {
				if ( Object.is( state[ key ], value ) ) {
					return;
				}
				state[ key ] = value;
				schedule();
			},
		} );
	}
	schedule();
	return port;
}
