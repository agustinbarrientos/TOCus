import type { AnimationClip, Group, Object3D, ShaderMaterial, Vector4 } from 'three';

/**
 * The horizontal orbit never changes the camera height or target.
 * @since 0.1.0
 */
export const HeroCamera = {
	MAX_YAW: Math.PI * 50 / 180,
	RADIUS: 11,
	HEIGHT: 4.8,
	TARGET_HEIGHT: 4.8,
	FOV: 60,
} as const;

/**
 * A six-second swell reaches above both soles and recedes below them.
 * @since 0.1.0
 */
export const WaterMotion = {
	BASE_HEIGHT: 0.1,
	AMPLITUDE: 0.14,
	FADE_START: -1.2,
	FADE_END: 0.45,
} as const;

/**
 * Lifecycle states exposed to the progressive enhancement.
 * @since 0.1.0
 */
export const HeroStatus = {
	POSTER: 'poster', LOADING: 'loading', READY: 'ready', UNAVAILABLE: 'unavailable',
} as const;

/**
 * Observable scene availability.
 * @since 0.1.0
 */
export type HeroStatus = typeof HeroStatus[keyof typeof HeroStatus];

/**
 * An owned scene can be released when the component unmounts.
 * @since 0.1.0
 */
export interface HeroController { dispose: () => void }

/**
 * Reports availability without putting per-frame state into React.
 * @since 0.1.0
 */
export type HeroListener = ( status: HeroStatus ) => void;

/**
 * Self-contained native scene export and its baked soft animation.
 * @since 0.1.0
 */
export interface RiversideModel { root: Group; clips: AnimationClip[] }

/**
 * Procedural environment resources owned by the hero.
 * @since 0.1.0
 */
export interface RiversideEnvironment {
	objects: Object3D[];
	water: ShaderMaterial;
	time: HeroTimeUniform;
	ripples: Vector4[];
}

/**
 * Mutable shader clock owned by the environment.
 * @since 0.1.0
 */
export interface HeroTimeUniform { value: number }

/**
 * Fixed-height camera position around the character.
 * @since 0.1.0
 */
export interface HeroCameraPosition { x: number; y: number; z: number }
