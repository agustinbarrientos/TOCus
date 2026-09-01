import {
	getBreathingSphereContourPoint,
	getBreathingSphereDeformation,
	getBreathingSpherePoint,
	getBreathingSphereRadius,
} from '../breathing-sphere-geometry';
import { type BreathingSphereColors, type BreathingSphereFrameInput } from './types';

const PATH_POINT_COUNT = 96;
const MAXIMUM_DEVICE_PIXEL_RATIO = 2;

/**
 * Reads one resolved theme color inherited by the component.
 * @param colorProbe - Hidden element that resolves inherited custom properties.
 * @param colorExpression - Theme color or color-mix expression.
 * @return Resolved CSS color.
 */
function resolveThemeColor( colorProbe: HTMLElement, colorExpression: string ): string {
	colorProbe.style.color = colorExpression;

	return getComputedStyle( colorProbe ).color;
}

/**
 * Reads every theme color needed by the Canvas renderer.
 * @param colorProbe - Hidden element that resolves inherited custom properties.
 * @return Resolved Breathing Sphere palette.
 * @since 0.1.0 Initial implementation.
 */
export function readBreathingSphereColors( colorProbe: HTMLElement ): BreathingSphereColors {
	return {
		clay: resolveThemeColor( colorProbe, 'var(--tocus-color-breathing-sphere)' ),
		clayHighlightBlend: resolveThemeColor(
			colorProbe,
			'color-mix(in srgb, var(--tocus-color-breathing-sphere-highlight) 55%, var(--tocus-color-breathing-sphere) 45%)',
		),
		clayShadowBlend: resolveThemeColor(
			colorProbe,
			'color-mix(in srgb, var(--tocus-color-breathing-sphere) 82%, var(--tocus-color-breathing-sphere-shadow) 18%)',
		),
		contour: resolveThemeColor( colorProbe, 'var(--tocus-color-breathing-sphere-contour)' ),
		depth: resolveThemeColor( colorProbe, 'var(--tocus-color-shadow-depth)' ),
		depthMuted: resolveThemeColor(
			colorProbe,
			'color-mix(in srgb, var(--tocus-color-shadow-depth) 34%, transparent)',
		),
		depthShadow: resolveThemeColor(
			colorProbe,
			'color-mix(in srgb, var(--tocus-color-shadow-depth) 24%, transparent)',
		),
		highlight: resolveThemeColor( colorProbe, 'var(--tocus-color-breathing-sphere-highlight)' ),
		shadow: resolveThemeColor( colorProbe, 'var(--tocus-color-breathing-sphere-shadow)' ),
		stageStart: resolveThemeColor( colorProbe, 'var(--tocus-color-stage-start)' ),
	};
}

/**
 * Creates the current breathing-sphere body path.
 * @param centerX - Horizontal sphere center.
 * @param centerY - Vertical sphere center.
 * @param radius - Current responsive radius.
 * @param deformation - Current exhale deformation strength.
 * @return Closed Canvas path.
 */
function createSpherePath(
	centerX: number,
	centerY: number,
	radius: number,
	deformation: number,
): Path2D {
	const path = new Path2D();

	for ( let index = 0; index <= PATH_POINT_COUNT; index += 1 ) {
		const angle = index / PATH_POINT_COUNT * Math.PI * 2;
		const point = getBreathingSpherePoint( {
			angle,
			centerX,
			centerY,
			deformation,
			radius,
		} );

		if ( index === 0 ) {
			path.moveTo( point.x, point.y );
		} else {
			path.lineTo( point.x, point.y );
		}
	}

	path.closePath();

	return path;
}

/**
 * Creates one current organic contour path.
 * @param centerX - Horizontal sphere center.
 * @param centerY - Vertical sphere center.
 * @param radius - Current responsive radius.
 * @param layer - Supported contour layer.
 * @param breathProgress - Current normalized Natural progress.
 * @return Closed Canvas path.
 */
function createContourPath(
	centerX: number,
	centerY: number,
	radius: number,
	layer: number,
	breathProgress: number,
): Path2D {
	const path = new Path2D();

	for ( let index = 0; index <= PATH_POINT_COUNT; index += 1 ) {
		const angle = index / PATH_POINT_COUNT * Math.PI * 2;
		const point = getBreathingSphereContourPoint( {
			breathProgress,
			centerX,
			centerY,
			layer,
			x: centerX + Math.cos( angle ) * radius,
			y: centerY + Math.sin( angle ) * radius,
		} );

		if ( index === 0 ) {
			path.moveTo( point.x, point.y );
		} else {
			path.lineTo( point.x, point.y );
		}
	}

	path.closePath();

	return path;
}

/**
 * Draws the soft color volume surrounding the sphere.
 * @param context - Canvas drawing context.
 * @param centerX - Horizontal sphere center.
 * @param centerY - Vertical sphere center.
 * @param radius - Current sphere radius.
 * @param color - Current clay color.
 * @param opacity - Current glow opacity.
 */
function drawAmbientGlow(
	context: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	radius: number,
	color: string,
	opacity: number,
): void {
	const gradient = context.createRadialGradient( centerX, centerY, 0, centerX, centerY, radius );

	gradient.addColorStop( 0, color );
	gradient.addColorStop( 1, 'transparent' );
	context.save();
	context.globalAlpha = opacity;
	context.fillStyle = gradient;
	context.fillRect( centerX - radius, centerY - radius, radius * 2, radius * 2 );
	context.restore();
}

/**
 * Draws the breathing sphere's soft grounding shadow.
 * @param context - Canvas drawing context.
 * @param centerX - Horizontal shadow center.
 * @param centerY - Vertical shadow center.
 * @param horizontalRadius - Horizontal shadow radius.
 * @param verticalRadius - Vertical shadow radius.
 * @param color - Current depth color.
 * @param middleColor - Current translucent depth color.
 * @param opacity - Current shadow opacity.
 */
function drawGroundShadow(
	context: CanvasRenderingContext2D,
	centerX: number,
	centerY: number,
	horizontalRadius: number,
	verticalRadius: number,
	color: string,
	middleColor: string,
	opacity: number,
): void {
	const gradient = context.createRadialGradient(
		centerX,
		centerY,
		0,
		centerX,
		centerY,
		horizontalRadius,
	);

	gradient.addColorStop( 0, color );
	gradient.addColorStop( 0.58, middleColor );
	gradient.addColorStop( 1, 'transparent' );
	context.save();
	context.globalAlpha = opacity;
	context.scale( 1, verticalRadius / horizontalRadius );
	context.fillStyle = gradient;
	context.beginPath();
	context.arc( centerX, centerY * horizontalRadius / verticalRadius, horizontalRadius, 0, Math.PI * 2 );
	context.fill();
	context.restore();
}

/**
 * Fills the sphere path with dimensional clay lighting.
 * @param context - Canvas drawing context.
 * @param path - Current deformed sphere path.
 * @param centerX - Horizontal sphere center.
 * @param centerY - Vertical sphere center.
 * @param radius - Current sphere radius.
 * @param colors - Current inherited palette.
 */
function fillClay(
	context: CanvasRenderingContext2D,
	path: Path2D,
	centerX: number,
	centerY: number,
	radius: number,
	colors: BreathingSphereColors,
): void {
	const clayGradient = context.createRadialGradient(
		centerX - radius * 0.34,
		centerY - radius * 0.39,
		radius * 0.05,
		centerX,
		centerY,
		radius * 1.22,
	);

	clayGradient.addColorStop( 0, colors.highlight );
	clayGradient.addColorStop( 0.24, colors.clayHighlightBlend );
	clayGradient.addColorStop( 0.64, colors.clay );
	clayGradient.addColorStop( 0.84, colors.clayShadowBlend );
	clayGradient.addColorStop( 1, colors.shadow );
	context.save();
	context.shadowColor = colors.depthShadow;
	context.shadowBlur = 27 * 1.08;
	context.shadowOffsetX = 13 * 1.08;
	context.shadowOffsetY = 19 * 1.08;
	context.fillStyle = clayGradient;
	context.fill( path );
	context.shadowColor = 'transparent';
	context.clip( path );

	const insetGlow = context.createRadialGradient(
		centerX - radius * 0.34,
		centerY - radius * 0.38,
		0,
		centerX - radius * 0.28,
		centerY - radius * 0.32,
		radius * 0.58,
	);

	insetGlow.addColorStop( 0, colors.stageStart );
	insetGlow.addColorStop( 1, 'transparent' );
	context.globalAlpha = 0.24;
	context.fillStyle = insetGlow;
	context.fillRect( centerX - radius * 1.3, centerY - radius * 1.3, radius * 2.6, radius * 2.6 );
	context.restore();
}

/**
 * Draws both approved contour personalities around the sphere.
 * @param context - Canvas drawing context.
 * @param paths - Inner and outer contour paths.
 * @param centerX - Horizontal sphere center.
 * @param centerY - Vertical sphere center.
 * @param breathProgress - Current normalized Natural progress.
 * @param color - Current contour color.
 */
function drawContours(
	context: CanvasRenderingContext2D,
	paths: readonly [ Path2D, Path2D ],
	centerX: number,
	centerY: number,
	breathProgress: number,
	color: string,
): void {
	const opacity = 0.2 + ( 0.78 - 0.2 ) * breathProgress;

	for ( const [ layer, path ] of paths.entries() ) {
		const startScale = layer === 0 ? 1.12 : 1.22;
		const endScale = layer === 0 ? 1.27 : 1.46;
		const scale = startScale + ( endScale - startScale ) * breathProgress;

		context.save();
		context.translate( centerX, centerY );
		context.scale( scale, scale );
		context.translate( -centerX, -centerY );
		context.globalAlpha = opacity * ( layer === 0 ? 1 : 0.58 );
		context.strokeStyle = color;
		context.lineWidth = layer === 0 ? 1.15 : 0.92;
		context.stroke( path );
		context.restore();
	}
}

/**
 * Synchronizes Canvas backing pixels with its displayed size.
 * @param canvas - Responsive Canvas whose backing size is synchronized.
 * @since 0.1.0 Initial implementation.
 */
export function resizeBreathingSphereCanvas( canvas: HTMLCanvasElement ): void {
	const bounds = canvas.getBoundingClientRect();
	const width = Math.max( 1, bounds.width );
	const height = Math.max( 1, bounds.height );
	const devicePixelRatio = Math.min( MAXIMUM_DEVICE_PIXEL_RATIO, window.devicePixelRatio );
	const pixelWidth = Math.round( width * devicePixelRatio );
	const pixelHeight = Math.round( height * devicePixelRatio );

	if ( canvas.width !== pixelWidth || canvas.height !== pixelHeight ) {
		canvas.width = pixelWidth;
		canvas.height = pixelHeight;
	}
}

/**
 * Draws one complete breathing-sphere frame from explicit presentation inputs.
 * @param input - Canvas, color probe, and current motion inputs.
 * @since 0.1.0 Initial implementation.
 */
export function renderBreathingSphereFrame( input: BreathingSphereFrameInput ): void {
	const context = input.canvas.getContext( '2d' );

	if ( context === null ) {
		return;
	}

	const bounds = input.canvas.getBoundingClientRect();
	const width = Math.max( 1, bounds.width );
	const height = Math.max( 1, bounds.height );
	const devicePixelRatio = Math.min( MAXIMUM_DEVICE_PIXEL_RATIO, window.devicePixelRatio );
	const requestedProgress = Number.isFinite( input.breathProgress ) ? input.breathProgress : 0;
	const breathProgress = input.still ? 0.5 : Math.max( 0, Math.min( 1, requestedProgress ) );
	const contourProgress = input.still ? 0 : breathProgress;
	const deformation = input.still ? 0 : getBreathingSphereDeformation( breathProgress );
	const centerX = width * 0.5;
	const centerY = height * 0.46;
	const radius = getBreathingSphereRadius( Math.min( width, height ), breathProgress );
	const spherePath = createSpherePath( centerX, centerY, radius, deformation );
	const contourPaths: [ Path2D, Path2D ] = [
		createContourPath( centerX, centerY, radius, 0, contourProgress ),
		createContourPath( centerX, centerY, radius, 1, contourProgress ),
	];

	context.setTransform( devicePixelRatio, 0, 0, devicePixelRatio, 0, 0 );
	context.clearRect( 0, 0, width, height );
	drawAmbientGlow(
		context,
		centerX,
		centerY,
		radius * 2.5,
		input.colors.clay,
		0.16 + breathProgress * 0.05,
	);
	drawGroundShadow(
		context,
		centerX,
		centerY + radius * 1.19,
		radius * ( 0.76 + ( 0.98 - 0.76 ) * breathProgress ),
		radius * 0.2,
		input.colors.depth,
		input.colors.depthMuted,
		0.27 + ( 0.17 - 0.27 ) * breathProgress,
	);
	fillClay( context, spherePath, centerX, centerY, radius, input.colors );
	drawContours( context, contourPaths, centerX, centerY, contourProgress, input.colors.contour );
}
