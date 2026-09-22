import { HeroCamera, type HeroCameraPosition } from './types';

/**
 * Converts horizontal pointer position to the authored, clamped orbit.
 * @param clientX - Horizontal pointer position.
 * @param left - Left edge of the hero.
 * @param width - Rendered hero width.
 * @return A bounded position or angle.
 * @since 0.1.0
 */
export function pointerYaw( clientX: number, left: number, width: number ): number {
	if ( ! Number.isFinite( clientX ) || width <= 0 ) {
		return 0;
	}
	return Math.max( -1, Math.min( 1, ( clientX - left ) / width * 2 - 1 ) ) * HeroCamera.MAX_YAW;
}

/**
 * Keeps orbit radius and elevation invariant at every permitted angle.
 * @param yaw - Desired horizontal angle in radians.
 * @return A bounded position or angle.
 * @since 0.1.0
 */
export function cameraPosition( yaw: number ): HeroCameraPosition {
	const angle = Math.max( -HeroCamera.MAX_YAW, Math.min( HeroCamera.MAX_YAW, yaw ) );
	return { x: Math.sin( angle ) * HeroCamera.RADIUS, y: HeroCamera.HEIGHT, z: Math.cos( angle ) * HeroCamera.RADIUS };
}
