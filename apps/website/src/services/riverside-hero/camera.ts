import { HeroCamera, HeroPoster, type HeroCameraPosition } from './types';

/**
 * Matches the poster's centered cover crop, including wide, shallow windows.
 * @param aspect - Positive width-to-height ratio of the whole hero surface.
 * @return Vertical field of view in degrees.
 * @since 1.0.0
 */
export function cameraFieldOfView( aspect: number ): number {
	const visibleHeight = Math.min( 1, HeroPoster.WIDTH / HeroPoster.HEIGHT / aspect );
	return 2 * Math.atan( Math.tan( HeroCamera.FOV * Math.PI / 360 ) * visibleHeight ) * 180 / Math.PI;
}

/**
 * Maps the page center to the resting view while retaining both orbit endpoints.
 * @param clientX - Horizontal pointer position.
 * @param left - Left edge of the hero.
 * @param width - Rendered hero width.
 * @return A bounded position or angle.
 * @since 1.0.0
 */
export function pointerYaw( clientX: number, left: number, width: number ): number {
	if ( ! Number.isFinite( clientX ) || width <= 0 ) {
		return HeroCamera.REST_YAW;
	}
	const offset = Math.max( -1, Math.min( 1, ( clientX - left ) / width * 2 - 1 ) );
	return offset < 0
		? -HeroCamera.MAX_YAW + ( offset + 1 ) * ( HeroCamera.REST_YAW + HeroCamera.MAX_YAW )
		: HeroCamera.REST_YAW + offset * ( HeroCamera.MAX_YAW - HeroCamera.REST_YAW );
}

/**
 * Follows the pointer responsively and drifts home more slowly after it leaves.
 * @param current - Current camera angle in radians.
 * @param target - Requested camera angle in radians.
 * @param seconds - Nonnegative elapsed frame time.
 * @param returning - Whether the pointer has left the hero.
 * @return The eased angle, with the same timing at different frame rates.
 * @since 1.0.0
 */
export function easeCameraYaw( current: number, target: number, seconds: number, returning: boolean ): number {
	const speed = returning ? 1.2 : 4;
	return current + ( target - current ) * ( 1 - Math.exp( -seconds * speed ) );
}

/**
 * Keeps orbit radius and elevation invariant at every permitted angle.
 * @param yaw - Desired horizontal angle in radians.
 * @return A bounded position or angle.
 * @since 1.0.0
 */
export function cameraPosition( yaw: number ): HeroCameraPosition {
	const angle = Math.max( -HeroCamera.MAX_YAW, Math.min( HeroCamera.MAX_YAW, yaw ) );
	return { x: Math.sin( angle ) * HeroCamera.RADIUS, y: HeroCamera.HEIGHT, z: Math.cos( angle ) * HeroCamera.RADIUS };
}
