import type { AnimationClip, Group, Object3D, ShaderMaterial, Vector4 } from 'three';

/**
 * The horizontal orbit never changes the camera height or target.
 * @since 1.0.0
 */
export const HeroCamera = {
	MAX_YAW: Math.PI * 50 / 180,
	REST_YAW: 42 * Math.PI / 180,
	RADIUS: 11,
	HEIGHT: 4.8,
	TARGET_HEIGHT: 4.8,
	FOV: 60,
} as const;

/**
 * Dimensions of the resting-view capture used before WebGL is ready.
 * @since 1.0.0
 */
export const HeroPoster = { WIDTH: 2560, HEIGHT: 1440 } as const;

/**
 * A six-second swell reaches above both soles and recedes below them.
 * @since 1.0.0
 */
export const WaterMotion = {
	BASE_HEIGHT: 0.1,
	AMPLITUDE: 0.14,
	FADE_START: -1.2,
	FADE_END: 0.45,
} as const;

/**
 * Lifecycle states exposed to the progressive enhancement.
 * @since 1.0.0
 */
export const HeroStatus = {
	POSTER: 'poster', LOADING: 'loading', READY: 'ready', UNAVAILABLE: 'unavailable',
} as const;

/**
 * Observable scene availability.
 * @since 1.0.0
 */
export type HeroStatus = typeof HeroStatus[keyof typeof HeroStatus];

/**
 * An owned scene can be released when the component unmounts.
 * @since 1.0.0
 */
export interface HeroController { dispose: () => void }

/**
 * A head-only deformation layered over the baked sipping and blinking poses.
 * @since 1.0.0
 */
export interface HeroHeadMotion { update: ( cameraYaw: number ) => number; dispose: () => void }

/**
 * Keeps the raised cup and grip attached to the independently turning head.
 * @since 1.0.0
 */
export interface HeroSipFollow { update: ( headYaw: number ) => void; dispose: () => void }

/**
 * Reports availability without putting per-frame state into React.
 * @since 1.0.0
 */
export type HeroListener = ( status: HeroStatus ) => void;

/**
 * Self-contained native scene export and its baked soft animation.
 * @since 1.0.0
 */
export interface RiversideModel { root: Group; clips: AnimationClip[] }

/**
 * Procedural environment resources owned by the hero.
 * @since 1.0.0
 */
export interface RiversideEnvironment {
	objects: Object3D[];
	water: ShaderMaterial;
	time: HeroTimeUniform;
	ripples: Vector4[];
}

/**
 * Mutable shader clock owned by the environment.
 * @since 1.0.0
 */
export interface HeroTimeUniform { value: number }

/**
 * Fixed-height camera position around the character.
 * @since 1.0.0
 */
export interface HeroCameraPosition { x: number; y: number; z: number }

/**
 * An owned WebGL resource whose allocation must be released during teardown.
 * @since 1.0.0
 */
export interface DisposableResource {
	dispose: () => void;
}
