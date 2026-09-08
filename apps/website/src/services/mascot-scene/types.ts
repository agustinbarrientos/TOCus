import type { AnimationClip, Group } from 'three';

/**
 * An owned WebGL resource whose allocation must be released during teardown.
 * @since 0.1.0
 */
export interface DisposableResource {
	dispose: () => void;
}

/**
 * Imported geometry and the greeting baked into its portable GLB.
 * @since 0.1.0
 */
export interface MascotModel {
	root: Group;
	clip: AnimationClip;
}

/**
 * Observable lifecycle of the independent WebGL comparison.
 * @since 0.1.0
 */
export const MascotSceneStatus = {
	LOADING: 'loading', READY: 'ready', UNAVAILABLE: 'unavailable', DISPOSED: 'disposed',
} as const;

/**
 * One of the prototype's lifecycle states.
 * @since 0.1.0
 */
export type MascotSceneStatus = typeof MascotSceneStatus[keyof typeof MascotSceneStatus];

/**
 * Accessible controls follow the actual renderer lifecycle and animation state.
 * @since 0.1.0
 */
export interface MascotSceneState {
	status: MascotSceneStatus;
	paused: boolean;
	running: boolean;
}

/**
 * Notifies the owning component when animation or availability changes.
 * @since 0.1.0
 */
export type MascotSceneListener = ( state: MascotSceneState ) => void;

/**
 * Presentation and playback choices shared by the homepage and comparison lab.
 * @since 0.1.0
 */
export interface MascotSceneOptions {
	/** Leaves the homepage background visible through the canvas. */
	transparent?: boolean;
	/** Repeats the baked greeting for the lab's explicit animation controls. */
	loop?: boolean;
}

/**
 * Explicit control and cleanup boundary for one comparison canvas.
 * @since 0.1.0
 */
export interface MascotSceneController {
	setPaused: ( paused: boolean ) => void;
	setViewDegrees: ( degrees: number ) => void;
	dispose: () => void;
}
