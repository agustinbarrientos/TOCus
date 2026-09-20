import { DemoChapter } from '../../components/product-demo/types';
import { StoryChapterDuration, type StoryFrameHandler } from './types';

/**
 * Plays a local demonstration while visible, with explicit pause and chapter controls.
 * @param root - Story section containing the player and chapter buttons.
 * @param onFrame - Receives active captions and the current illustrative frame.
 * @return Cleanup for all browser observations and controls.
 * @since 0.1.0
 */
export function createStoryMotion( root: HTMLElement, onFrame: StoryFrameHandler ): () => void {
	const order = Object.values( DemoChapter );
	const motion = window.matchMedia( '(prefers-reduced-motion: reduce)' );
	const listeners = new AbortController();
	let chapter: DemoChapter = DemoChapter.CHOOSE;
	let elapsed = 0;
	let visible = false;
	let requested = ! motion.matches;
	let complete = false;
	let animation = 0;
	let previous = 0;

	/** Reports the selected scene and its elapsed fraction to React. */
	function publish(): void {
		onFrame( { chapter, progress: elapsed / StoryChapterDuration[ chapter ],
			playing: requested && visible && ! document.hidden && ! motion.matches && ! complete,
			complete, reducedMotion: motion.matches } );
	}

	/**
	 * Advances only elapsed foreground time; there is no scroll-owned progress.
	 * @param now - Current animation frame timestamp.
	 */
	function tick( now: number ): void {
		elapsed += previous ? now - previous : 0;
		previous = now;
		while ( elapsed >= StoryChapterDuration[ chapter ] ) {
			const next = order[ order.indexOf( chapter ) + 1 ];
			if ( ! next ) {
				elapsed = StoryChapterDuration[ chapter ];
				complete = true;
				requested = false;
				break;
			}
			elapsed -= StoryChapterDuration[ chapter ];
			chapter = next;
		}
		publish();
		animation = complete ? 0 : requestAnimationFrame( tick );
	}

	/** Starts or suspends the single clock after visibility or user intent changes. */
	function reconcile(): void {
		cancelAnimationFrame( animation );
		animation = 0;
		previous = 0;
		publish();
		if ( requested && visible && ! document.hidden && ! motion.matches && ! complete ) {
			animation = requestAnimationFrame( tick );
		}
	}

	root.addEventListener( 'click', ( event ) => {
		const target = event.target instanceof Element ? event.target : null;
		const step = target?.closest<HTMLElement>( '[data-story-chapter]' )?.dataset.storyChapter;
		const selected = order.find( ( value ) => value === step );
		if ( selected ) {
			chapter = selected;
			elapsed = 0;
			complete = false;
			requested = false;
		} else if ( target?.closest( '[data-story-toggle]' ) ) {
			if ( complete ) {
				chapter = DemoChapter.CHOOSE;
				elapsed = 0;
				complete = false;
			}
			requested = ! requested;
		} else {
			return;
		}
		reconcile();
	}, { signal: listeners.signal } );
	motion.addEventListener( 'change', () => {
		requested = false;
		reconcile();
	}, { signal: listeners.signal } );
	document.addEventListener( 'visibilitychange', reconcile, { signal: listeners.signal } );
	const observer = new IntersectionObserver( ( entries ) => {
		visible = entries.some( ( entry ) => entry.isIntersecting );
		reconcile();
	}, { threshold: 0 } );
	observer.observe( root.querySelector( '.product-demo-browser' ) ?? root );
	reconcile();
	return () => {
		cancelAnimationFrame( animation );
		listeners.abort();
		observer.disconnect();
	};
}
