import { isPlaybackSite } from '../../utils/playback-site-catalog';
import {
	type MediaPlaybackController,
	type MediaPlaybackControllerOptions,
	type MediaPlaybackSnapshot,
} from './types';

/**
 * Creates the native video interruption lifecycle for one document.
 * @param options - Document and live location dependencies.
 * @return Playback lifecycle for the content document.
 * @since 0.1.0 Initial implementation.
 */
export function createMediaPlaybackController(
	options: MediaPlaybackControllerOptions,
): MediaPlaybackController {
	let held = false;
	let stopped = false;
	let snapshots: MediaPlaybackSnapshot[] = [];

	/**
	 * Reports whether the current page supports native playback control.
	 * @return Whether this document may have its playback controlled.
	 * @since 0.1.0 Initial implementation.
	 */
	function isSupportedPage(): boolean {
		return isPlaybackSite( new URL( options.location.href ) );
	}

	/**
	 * Suppresses native playback attempts while the interruption owns the hold.
	 * @since 0.1.0 Initial implementation.
	 */
	function enforcePause(): void {
		if ( ! isSupportedPage() ) {
			return;
		}
		for ( const media of options.document.querySelectorAll( 'video' ) ) {
			if ( ! media.paused && ! media.ended ) {
				media.pause();
			}
		}
	}

	/**
	 * Captures playing media once before holding subsequent playback attempts.
	 * @since 0.1.0 Initial implementation.
	 */
	function pause(): void {
		if ( stopped || held || ! isSupportedPage() ) {
			return;
		}

		held = true;
		for ( const media of options.document.querySelectorAll( 'video' ) ) {
			if ( ! media.paused && ! media.ended ) {
				snapshots.push( {
					currentSrc: media.currentSrc,
					href: options.location.href,
					media,
					src: media.src,
					srcObject: media.srcObject,
				} );
			}
		}
		options.document.addEventListener( 'play', enforcePause, { capture: true } );
		enforcePause();
	}

	/**
	 * Releases the document listener and consumes every playback snapshot.
	 * @return Previously owned playback snapshots.
	 * @since 0.1.0 Initial implementation.
	 */
	function release(): MediaPlaybackSnapshot[] {
		if ( held ) {
			options.document.removeEventListener( 'play', enforcePause, { capture: true } );
		}
		held = false;
		const previous = snapshots;
		snapshots = [];
		return previous;
	}

	/**
	 * Attempts restoration only while the original element, source, and page remain unchanged.
	 * @return Completion of native playback attempts, including browser denials.
	 * @since 0.1.0 Initial implementation.
	 */
	async function resume(): Promise<void> {
		const previous = release();
		await Promise.allSettled( previous.map( async ( snapshot ) => {
			const { media } = snapshot;
			if (
				isSupportedPage() &&
				media.isConnected &&
				media.paused &&
				! media.ended &&
				options.location.href === snapshot.href &&
				media.src === snapshot.src &&
				media.currentSrc === snapshot.currentSrc &&
				media.srcObject === snapshot.srcObject
			) {
				await media.play();
			}
		} ) );
	}

	/**
	 * Ends the lifecycle without starting media playback.
	 * @since 0.1.0 Initial implementation.
	 */
	function stop(): void {
		stopped = true;
		release();
	}

	return { pause, resume, stop };
}

export { type MediaPlaybackController, type MediaPlaybackControllerOptions } from './types';
