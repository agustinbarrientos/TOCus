/**
 * Moves the layered illustration without changing its perspective or replacing the artwork.
 * @param root - Illustration containing the chair, shoreline and interaction target.
 * @return Cleanup for input, visibility and animation observers.
 * @since 0.1.0
 */
export function createBeachScene( root: HTMLElement ): () => void {
	const listeners = new AbortController();
	let visible = false;
	let frame = 0;
	let previous = 0;
	let time = 0;
	let ripple = 0;
	let targetX = 0;
	let targetY = 0;
	let x = 0;
	let y = 0;
	/**
	 * Advances foreground and shoreline movement while visible.
	 * @param now - Current animation timestamp in milliseconds.
	 */
	function tick( now: number ): void {
		const delta = previous ? Math.min( ( now - previous ) / 1000, .05 ) : 0;
		previous = now;
		time += delta;
		ripple = Math.max( 0, ripple - delta );
		x += ( targetX - x ) * ( 1 - Math.exp( -delta * 7 ) );
		y += ( targetY - y ) * ( 1 - Math.exp( -delta * 7 ) );
		root.style.setProperty( '--tocus-beach-x', `${ String( x * 5 ) }px` );
		root.style.setProperty( '--tocus-beach-y', `${ String( y * 3 ) }px` );
		root.style.setProperty( '--tocus-beach-breath', String( 1 + Math.sin( time * Math.PI / 3 ) * .003 ) );
		root.style.setProperty( '--tocus-beach-tide', `${ String( Math.sin( time * .6 ) * 8 ) }px` );
		root.style.setProperty( '--tocus-beach-ripple', String( 1 - ripple / 1.6 ) );
		root.dataset.reacting = String( ripple > 0 );
		frame = requestAnimationFrame( tick );
	}
	/** Pauses all animation work offscreen and in background tabs. */
	function synchronize(): void {
		cancelAnimationFrame( frame );
		previous = 0;
		const playing = visible && ! document.hidden;
		root.dataset.playing = String( playing );
		if ( playing ) {
			frame = requestAnimationFrame( tick );
		}
	}
	root.addEventListener( 'pointermove', ( event ) => {
		if ( event.pointerType !== 'mouse' ) {
			return;
		}
		const bounds = root.getBoundingClientRect();
		targetX = ( event.clientX - bounds.left ) / bounds.width * 2 - 1;
		targetY = ( event.clientY - bounds.top ) / bounds.height * 2 - 1;
	}, { signal: listeners.signal } );
	root.addEventListener( 'pointerleave', () => {
		targetX = 0;
		targetY = 0;
	}, { signal: listeners.signal } );
	root.addEventListener( 'click', () => {
		ripple = 1.6;
		root.dataset.reacting = 'true';
	}, { signal: listeners.signal } );
	document.addEventListener( 'visibilitychange', synchronize, { signal: listeners.signal } );
	const observer = new IntersectionObserver( ( entries ) => {
		visible = entries.some( ( entry ) => entry.isIntersecting );
		synchronize();
	} );
	observer.observe( root );
	root.dataset.ready = 'true';
	return () => {
		cancelAnimationFrame( frame );
		listeners.abort();
		observer.disconnect();
		root.dataset.playing = 'false';
		root.dataset.reacting = 'false';
		for ( const property of [ '--tocus-beach-x', '--tocus-beach-y', '--tocus-beach-breath', '--tocus-beach-tide', '--tocus-beach-ripple' ] ) {
			root.style.removeProperty( property );
		}
		delete root.dataset.ready;
	};
}
