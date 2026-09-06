/**
 * Browser dependencies for playback held during an interruption.
 * @since 0.1.0 Initial implementation.
 */
export interface MediaPlaybackControllerOptions {
	/**
	 * Document containing the page's native video elements.
	 * @since 0.1.0 Initial implementation.
	 */
	document: Pick<Document, 'querySelectorAll' | 'addEventListener' | 'removeEventListener'>;
	/**
	 * Live location used to reject playback restoration after navigation.
	 * @since 0.1.0 Initial implementation.
	 */
	location: Pick<Location, 'href'>;
}

/**
 * Identity of native video playback paused by the controller.
 * @since 0.1.0 Initial implementation.
 */
export interface MediaPlaybackSnapshot {
	/**
	 * Resolved media resource at interruption entry.
	 * @since 0.1.0 Initial implementation.
	 */
	currentSrc: string;
	/**
	 * Page URL at interruption entry.
	 * @since 0.1.0 Initial implementation.
	 */
	href: string;
	/**
	 * Video element at interruption entry.
	 * @since 0.1.0 Initial implementation.
	 */
	media: HTMLVideoElement;
	/**
	 * Assigned media URL at interruption entry.
	 * @since 0.1.0 Initial implementation.
	 */
	src: string;
	/**
	 * Assigned stream at interruption entry.
	 * @since 0.1.0 Initial implementation.
	 */
	srcObject: HTMLMediaElement['srcObject'];
}

/**
 * Lifecycle of native video playback held by an interruption.
 * @since 0.1.0 Initial implementation.
 */
export interface MediaPlaybackController {
	/**
	 * Holds playback and remembers only videos already playing at entry.
	 * @since 0.1.0 Initial implementation.
	 */
	pause(): void;
	/**
	 * Releases the hold and attempts to restore unchanged controller-owned playback once.
	 * Browser playback denial settles without retrying or rejecting.
	 * @return Completion of every restoration attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	resume(): Promise<void>;
	/**
	 * Permanently releases listeners and ownership without restoring playback.
	 * @since 0.1.0 Initial implementation.
	 */
	stop(): void;
}
