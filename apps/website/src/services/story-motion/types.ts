import { DemoChapter } from '../../components/product-demo/types';

/**
 * Deliberate beats give the breathing pause more reading and animation time.
 * @since 0.1.0
 */
export const StoryChapterStart = {
	[ DemoChapter.CHOOSE ]: 0,
	[ DemoChapter.VISIT ]: 0.18,
	[ DemoChapter.PAUSE ]: 0.30,
	[ DemoChapter.CONTINUE ]: 0.66,
	[ DemoChapter.BROWSE ]: 0.80,
} as const;

/**
 * Selects the product scene matching the current explanation.
 * @since 0.1.0
 */
export type StoryChapterChangeHandler = ( chapter: DemoChapter ) => void;

/**
 * Scrubs the active product scene using normalized chapter progress.
 * @since 0.1.0
 */
export type StoryProgressChangeHandler = ( progress: number ) => void;

/**
 * Chapter button action that follows the ordinary scroll position.
 * @since 0.1.0
 */
export type StoryNavigationHandler = () => void;

/**
 * CSS-owned document interval during which the story frame stays sticky.
 * @since 0.1.0
 */
export interface StoryInterval {
	start: number;
	distance: number;
}
