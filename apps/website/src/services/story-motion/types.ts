import { DemoChapter } from '../../components/product-demo/types';

/**
 * Duration of each website-only demonstration beat.
 * @since 0.1.0
 */
export const StoryChapterDuration = {
	[ DemoChapter.CHOOSE ]: 4_000,
	[ DemoChapter.VISIT ]: 3_000,
	[ DemoChapter.PAUSE ]: 10_000,
	[ DemoChapter.CONTINUE ]: 3_000,
	[ DemoChapter.BROWSE ]: 5_000,
} as const;

/**
 * Publishes the current demonstration frame.
 * @since 0.1.0
 */
export interface StoryFrame {
	chapter: DemoChapter;
	progress: number;
	playing: boolean;
	complete: boolean;
	reducedMotion: boolean;
}

/**
 * Receives playback state without owning a browser clock.
 * @since 0.1.0
 */
export type StoryFrameHandler = ( frame: StoryFrame ) => void;
