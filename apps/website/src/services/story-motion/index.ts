import { DemoChapter } from '../../components/product-demo/types';
import type { StoryChapterChangeHandler, StoryInterval, StoryNavigationHandler, StoryProgressChangeHandler } from './types';

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

	/**
	 * Reads the CSS-owned sticky travel; rail items never determine scene duration.
	 * @return Document position and distance for the complete story.
	 */
	function storyInterval(): StoryInterval {
		const stickyTop = stage ? Number.parseFloat( getComputedStyle( stage ).top ) || 0 : 0;
		const bounds = layout?.getBoundingClientRect();
		return {
			start: window.scrollY + ( bounds?.top ?? 0 ) - stickyTop,
			distance: Math.max( 1, ( bounds?.height ?? 0 ) - ( stage?.offsetHeight ?? 0 ) ),
		};
	}

	/** Updates only changed scene state, including the first and last boundary on exit. */
	function updateStory(): void {
		cancelAnimationFrame( frame );
		frame = 0;
		if ( disposed || ! layout || ! stage ) {
			return;
		}
		const { start, distance } = storyInterval();
		const position = Math.max( 0, Math.min( 1, ( window.scrollY - start ) / distance ) ) * order.length;
		const index = Math.min( order.length - 1, Math.floor( position ) );
		const chapter = order[ index ];
		if ( ! chapter ) {
			return;
		}
		const active = window.scrollY >= start;
		if ( active !== root.hasAttribute( 'data-story-active' ) ) {
			root.toggleAttribute( 'data-story-active', active );
		}
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
		const progress = Math.min( 1, position - index );
		if ( progress !== previousProgress ) {
			previousProgress = progress;
			onProgressChange?.( progress );
		}
	}

	/** Coalesces scroll and resize notifications without running an idle animation loop. */
	function scheduleUpdate(): void {
		if ( ! disposed && frame === 0 ) {
			frame = requestAnimationFrame( updateStory );
		}
	}

	for ( const element of chapters ) {
		const button = element.querySelector( 'button' );
		const index = order.findIndex( ( chapter ) => chapter === element.dataset.storyChapter );
		if ( ! button || index < 0 ) {
			continue;
		}
		/** Native click also handles Enter and Space exactly once while retaining focus. */
		const navigate = () => {
			const { start, distance } = storyInterval();
			window.scrollTo( { top: Math.max( 0, start + distance * index / order.length + 1 ), behavior: 'instant' } );
			updateStory();
		};
		button.addEventListener( 'click', navigate );
		buttonListeners.set( button, navigate );
	}

	window.addEventListener( 'scroll', scheduleUpdate, { passive: true } );
	window.addEventListener( 'resize', scheduleUpdate );
	const resizeObserver = new ResizeObserver( scheduleUpdate );
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
		window.removeEventListener( 'resize', scheduleUpdate );
		resizeObserver.disconnect();
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
