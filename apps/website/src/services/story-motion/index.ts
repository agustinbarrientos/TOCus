import { DemoChapter } from '../../components/product-demo/types';
import { StoryChapterStart, type StoryChapterChangeHandler, type StoryInterval, type StoryNavigationHandler, type StoryProgressChangeHandler } from './types';

/**
 * Maps the native sticky browser's travel to five reversible product scenes.
 * Chapter buttons use the same interval, without changing layout or taking focus.
 * @param root - Website boundary containing the story and chapter buttons.
 * @param onChapterChange - Selects one of the five product steps.
 * @param onProgressChange - Scrubs the illustration within the current step.
 * @return Cleanup for scroll observation and button listeners.
 * @since 0.1.0
 */
export function createStoryMotion(
	root: HTMLElement,
	onChapterChange: StoryChapterChangeHandler,
	onProgressChange?: StoryProgressChangeHandler,
): () => void {
	const chapters = Array.from( root.querySelectorAll<HTMLElement>( '[data-story-chapter]' ) );
	const stage = root.querySelector<HTMLElement>( '.experience-stage' );
	const layout = root.querySelector<HTMLElement>( '.story-layout' );
	const order = Object.values( DemoChapter );
	const originalActive = root.getAttribute( 'data-story-active' );
	const originalPinned = root.hasAttribute( 'data-story-pinned' );
	const originalMarkers = new Map( chapters.map( ( chapter ) => [ chapter, chapter.getAttribute( 'data-current' ) ] ) );
	const originalButtons = new Map( chapters.flatMap( ( chapter ) => {
		const button = chapter.querySelector( 'button' );
		return button ? [ [ button, button.getAttribute( 'aria-current' ) ] as const ] : [];
	} ) );
	const buttonListeners = new Map<HTMLButtonElement, StoryNavigationHandler>();
	let selected: DemoChapter | null = null;
	let previousProgress = -1;
	let frame = 0;
	let disposed = false;
	let pinned = false;
	let needsMeasurement = true;
	let interval: StoryInterval = { start: 0, distance: 1 };

	/**
	 * Reads the CSS-owned sticky travel; rail items never determine scene duration.
	 */
	function measureStory(): void {
		if ( ! stage || ! layout ) {
			return;
		}
		const inset = Number.parseFloat( getComputedStyle( stage ).top ) || 0;
		pinned = stage.offsetHeight + inset * 2 <= window.innerHeight;
		root.toggleAttribute( 'data-story-pinned', pinned );
		const bounds = layout.getBoundingClientRect();
		interval = { start: window.scrollY + bounds.top - inset,
			distance: Math.max( 1, bounds.height - stage.offsetHeight ) };
		needsMeasurement = false;
	}

	/**
	 * Publishes only changed scene state to the isolated story component.
	 * @param chapter - Current explanation and illustration.
	 * @param progress - Normalized position within this chapter.
	 */
	function selectChapter( chapter: DemoChapter, progress: number ): void {
		if ( selected !== chapter ) {
			selected = chapter;
			previousProgress = -1;
			for ( const element of chapters ) {
				const current = element.dataset.storyChapter === chapter;
				element.setAttribute( 'data-current', String( current ) );
				const button = element.querySelector( 'button' );
				if ( current ) {
					button?.setAttribute( 'aria-current', 'step' );
				} else {
					button?.removeAttribute( 'aria-current' );
				}
			}
			onChapterChange( chapter );
		}
		if ( progress !== previousProgress ) {
			previousProgress = progress;
			onProgressChange?.( progress );
		}
	}

	/** Updates scroll-owned scenes only when the complete stage can remain visible. */
	function updateStory(): void {
		cancelAnimationFrame( frame );
		frame = 0;
		if ( disposed || ! layout || ! stage ) {
			return;
		}
		if ( needsMeasurement ) {
			measureStory();
		}
		const { start, distance } = interval;
		root.toggleAttribute( 'data-story-active', window.scrollY >= start );
		if ( ! pinned ) {
			if ( selected === null ) {
				selectChapter( DemoChapter.CHOOSE, 1 );
			}
			return;
		}
		const position = Math.max( 0, Math.min( 1, ( window.scrollY - start ) / distance ) );
		const index = order.findLastIndex( ( chapter ) => position >= StoryChapterStart[ chapter ] );
		const chapter = order[ index ];
		if ( chapter ) {
			const next = order[ index + 1 ];
			const end = next ? StoryChapterStart[ next ] : 1;
			const progress = ( position - StoryChapterStart[ chapter ] ) / ( end - StoryChapterStart[ chapter ] );
			selectChapter( chapter, progress );
		}
	}

	/** Coalesces scroll and resize notifications without running an idle animation loop. */
	function scheduleUpdate(): void {
		if ( ! disposed && frame === 0 ) {
			frame = requestAnimationFrame( updateStory );
		}
	}

	/** Rechecks intrinsic caption and scene height after fonts, content or viewport changes. */
	function scheduleMeasurement(): void {
		needsMeasurement = true;
		scheduleUpdate();
	}

	for ( const element of chapters ) {
		const button = element.querySelector( 'button' );
		const index = order.findIndex( ( chapter ) => chapter === element.dataset.storyChapter );
		if ( ! button || index < 0 ) {
			continue;
		}
		/** Native click also handles Enter and Space exactly once while retaining focus. */
		const navigate = () => {
			measureStory();
			const chapter = order[ index ];
			if ( ! chapter ) {
				return;
			}
			if ( pinned ) {
				const { start, distance } = interval;
				window.scrollTo( { top: Math.max( 0, start + distance * StoryChapterStart[ chapter ] + 1 ), behavior: 'instant' } );
				updateStory();
			} else {
				selectChapter( chapter, 0 );
			}
		};
		button.addEventListener( 'click', navigate );
		buttonListeners.set( button, navigate );
	}

	window.addEventListener( 'scroll', scheduleUpdate, { passive: true } );
	window.addEventListener( 'resize', scheduleMeasurement );
	const resizeObserver = new ResizeObserver( scheduleMeasurement );
	for ( const element of [ root, layout, stage ] ) {
		if ( element ) {
			resizeObserver.observe( element );
		}
	}
	updateStory();

	return () => {
		disposed = true;
		cancelAnimationFrame( frame );
		window.removeEventListener( 'scroll', scheduleUpdate );
		window.removeEventListener( 'resize', scheduleMeasurement );
		resizeObserver.disconnect();
		root.toggleAttribute( 'data-story-pinned', originalPinned );
		for ( const [ button, listener ] of buttonListeners ) {
			button.removeEventListener( 'click', listener );
		}
		for ( const [ element, value ] of originalButtons ) {
			if ( value === null ) {
				element.removeAttribute( 'aria-current' );
			} else {
				element.setAttribute( 'aria-current', value );
			}
		}
		for ( const [ element, value ] of originalMarkers ) {
			if ( value === null ) {
				element.removeAttribute( 'data-current' );
			} else {
				element.setAttribute( 'data-current', value );
			}
		}
		if ( originalActive === null ) {
			root.removeAttribute( 'data-story-active' );
		} else {
			root.setAttribute( 'data-story-active', originalActive );
		}
	};
}

export type { StoryChapterChangeHandler, StoryProgressChangeHandler } from './types';
