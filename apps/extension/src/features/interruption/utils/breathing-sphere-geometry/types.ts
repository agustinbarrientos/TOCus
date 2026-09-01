/**
 * Cartesian point used by breathing-sphere paths.
 * @since 0.1.0 Initial implementation.
 */
export interface CartesianPoint {
	x: number;
	y: number;
}

/**
 * Inputs used to calculate one breathing-sphere perimeter point.
 * @since 0.1.0 Initial implementation.
 */
export interface BreathingSpherePointInput {
	angle: number;
	centerX: number;
	centerY: number;
	deformation: number;
	radius: number;
}

/**
 * Inputs used to calculate one organic contour point.
 * @since 0.1.0 Initial implementation.
 */
export interface BreathingSphereContourPointInput {
	breathProgress: number;
	centerX: number;
	centerY: number;
	layer: number;
	x: number;
	y: number;
}
