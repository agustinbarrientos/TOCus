import type { AnimationClip, Bone, Group } from 'three';

/**
 * Portable repaired model and its embedded skeletal animation.
 * @since 0.1.0
 */
export interface PreparedMascotAsset {
	root: Group;
	animations: [ AnimationClip ];
}

/**
 * Named deformation joints, also used by portable glTF animation tracks.
 * @since 0.1.0
 */
export const MascotJoint = {
	ROOT: 'MascotRoot', SHOULDER: 'WaveShoulder', ELBOW: 'WaveElbow', WRIST: 'WaveWrist',
} as const;

/**
 * Ordered skeleton with one stationary root and three waving joints.
 * @since 0.1.0
 */
export interface MascotRig {
	bones: [ Bone, Bone, Bone, Bone ];
	clip: AnimationClip;
}
