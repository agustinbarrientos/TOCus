import {
	type BreathingSphereContourPointInput,
	type BreathingSpherePointInput,
	type CartesianPoint,
} from './types';

/**
 * Restricts a numeric value to an inclusive range.
 * @param value - Value to restrict.
 * @param minimum - Inclusive lower bound.
 * @param maximum - Inclusive upper bound.
 * @return Restricted value.
 */
function clamp( value: number, minimum: number, maximum: number ): number {
	return Math.max( minimum, Math.min( maximum, value ) );
}

/**
 * Interpolates between two numeric values.
 * @param start - Value at zero progress.
 * @param end - Value at full progress.
 * @param progress - Normalized interpolation progress.
 * @return Interpolated value.
 */
function interpolate( start: number, end: number, progress: number ): number {
	return start + ( end - start ) * progress;
}

/**
 * Applies a smoothstep curve to normalized progress.
 * @param progress - Progress to smooth.
 * @return Smoothed progress.
 */
function smoothstep( progress: number ): number {
	const value = clamp( progress, 0, 1 );

	return value * value * ( 3 - 2 * value );
}

/**
 * Applies the approved calm asymmetric deformation to one radial point.
 * @param point - Original point coordinates.
 * @param center - Shape center coordinates.
 * @param deformation - Normalized deformation strength.
 * @return Deformed point coordinates.
 */
function deformRadialPoint(
	point: CartesianPoint,
	center: CartesianPoint,
	deformation: number,
): CartesianPoint {
	const amount = clamp( deformation, 0, 1 );
	const offsetX = point.x - center.x;
	const offsetY = point.y - center.y;
	const radius = Math.hypot( offsetX, offsetY );

	if ( radius === 0 ) {
		return point;
	}

	const angle = Math.atan2( offsetY, offsetX );
	const field = 0.78 * Math.cos( 2 * angle - 0.35 ) + 0.22 * Math.sin( 3 * angle + 0.8 );
	const scale = 1 + 0.05 * amount * field;

	return {
		x: center.x + offsetX * scale,
		y: center.y + offsetY * scale,
	};
}

/**
 * Calculates the responsive radius of the breathing sphere.
 * @param minimumDimension - Smaller artboard dimension.
 * @param breathProgress - Normalized Natural breathing progress.
 * @return Sphere radius in CSS pixels.
 * @since 0.1.0 Initial implementation.
 */
export function getBreathingSphereRadius( minimumDimension: number, breathProgress: number ): number {
	return minimumDimension * interpolate( 0.155, 0.235, clamp( breathProgress, 0, 1 ) );
}

/**
 * Calculates how strongly the sphere deforms while settling on exhale.
 * @param breathProgress - Normalized Natural breathing progress.
 * @return Normalized deformation strength.
 * @since 0.1.0 Initial implementation.
 */
export function getBreathingSphereDeformation( breathProgress: number ): number {
	return 1 - smoothstep( breathProgress );
}

/**
 * Calculates a deformed point on the breathing-sphere perimeter.
 * @param input - Sphere geometry and deformation inputs.
 * @return Deformed perimeter coordinates.
 * @since 0.1.0 Initial implementation.
 */
export function getBreathingSpherePoint( input: BreathingSpherePointInput ): CartesianPoint {
	return deformRadialPoint(
		{
			x: input.centerX + Math.cos( input.angle ) * input.radius,
			y: input.centerY + Math.sin( input.angle ) * input.radius,
		},
		{ x: input.centerX, y: input.centerY },
		input.deformation,
	);
}

/**
 * Calculates one point on either approved organic contour personality.
 * @param input - Contour layer, center, point, and breathing progress.
 * @return Deformed contour coordinates.
 * @throws {RangeError} When the contour layer is unsupported.
 * @since 0.1.0 Initial implementation.
 */
export function getBreathingSphereContourPoint(
	input: BreathingSphereContourPointInput,
): CartesianPoint {
	const maximumAmplitude = [ 0.04, 0.06 ][ input.layer ];

	if ( maximumAmplitude === undefined ) {
		throw new RangeError( `Unsupported contour layer: ${ String( input.layer ) }` );
	}

	const amount = clamp( input.breathProgress, 0, 1 );
	const offsetX = input.x - input.centerX;
	const offsetY = input.y - input.centerY;
	const radius = Math.hypot( offsetX, offsetY );

	if ( radius === 0 || amount === 0 ) {
		return { x: input.x, y: input.y };
	}

	const angle = Math.atan2( offsetY, offsetX );
	const profileDrift = input.layer === 0 ? Math.PI / 10 : -14 * Math.PI / 180;
	const profileAngle = angle - profileDrift * amount;
	const field = input.layer === 0
		? 0.78 * Math.cos( 2 * profileAngle - 0.45 ) + 0.22 * Math.sin( 3 * profileAngle + 0.65 )
		: 0.72 * Math.cos( 2 * profileAngle + 1.55 ) + 0.28 * Math.sin( 3 * profileAngle - 0.8 );
	const scale = 1 + maximumAmplitude * amount * field;

	return {
		x: input.centerX + offsetX * scale,
		y: input.centerY + offsetY * scale,
	};
}

export {
	type BreathingSphereContourPointInput,
	type BreathingSpherePointInput,
	type CartesianPoint,
} from './types';
