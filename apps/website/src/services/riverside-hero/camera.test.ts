import { describe, expect, test } from 'vitest';
import { cameraPosition, pointerYaw } from './camera';
import { HeroCamera } from './types';

describe( 'bounded horizontal hero camera', () => {
	test( 'maps the viewport edges and center without accepting out-of-bounds movement', () => {
		expect( pointerYaw( 100, 100, 1000 ) ).toBe( -HeroCamera.MAX_YAW );
		expect( pointerYaw( 600, 100, 1000 ) ).toBe( 0 );
		expect( pointerYaw( 1100, 100, 1000 ) ).toBe( HeroCamera.MAX_YAW );
		expect( pointerYaw( 9999, 100, 1000 ) ).toBe( HeroCamera.MAX_YAW );
		expect( pointerYaw( -9999, 100, 1000 ) ).toBe( -HeroCamera.MAX_YAW );
		expect( pointerYaw( 1, 0, 0 ) ).toBe( 0 );
		expect( pointerYaw( NaN, 0, 100 ) ).toBe( 0 );
	} );
	test( 'preserves camera height, distance and rear hemisphere throughout the sweep', () => {
		for ( let yaw = -2; yaw <= 2; yaw += 0.05 ) {
			const position = cameraPosition( yaw );
			expect( position.y ).toBe( HeroCamera.HEIGHT );
			expect( Math.hypot( position.x, position.z ) ).toBeCloseTo( HeroCamera.RADIUS );
			expect( position.z ).toBeGreaterThan( 0 );
			expect( Math.abs( Math.atan2( position.x, position.z ) ) ).toBeLessThanOrEqual( HeroCamera.MAX_YAW );
		}
	} );
} );
