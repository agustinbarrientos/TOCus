/**
 * Theme colors required to render the clay breathing sphere.
 * @since 0.1.0 Initial implementation.
 */
export interface BreathingSphereColors {
	clay: string;
	clayHighlightBlend: string;
	clayShadowBlend: string;
	contour: string;
	depth: string;
	depthMuted: string;
	depthShadow: string;
	highlight: string;
	shadow: string;
	stageStart: string;
}

/**
 * Inputs required to render one breathing-sphere Canvas frame.
 * @since 0.1.0 Initial implementation.
 */
export interface BreathingSphereFrameInput {
	breathProgress: number;
	canvas: HTMLCanvasElement;
	colors: BreathingSphereColors;
	still: boolean;
}
