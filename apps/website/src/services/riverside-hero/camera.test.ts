import { describe, expect, test } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { cameraFieldOfView, cameraPosition, easeCameraYaw, pointerYaw } from './camera';
import { HeroCamera } from './types';

describe( 'bounded horizontal hero camera', () => {
	test( 'matches centered poster cover cropping on narrow, desktop and ultrawide surfaces', () => {
		const reference = new PerspectiveCamera( 60, 16 / 9, 0.1, 1400 );
		reference.position.set( 0, 4.8, 11 );
		reference.lookAt( 0, 4.8, 0 );
		reference.updateMatrixWorld();
		for ( const { width, height } of [
			{ width: 390, height: 916 }, { width: 1440, height: 1012 }, { width: 2560, height: 832 },
		] ) {
			const camera = reference.clone();
			camera.aspect = width / height;
			camera.fov = cameraFieldOfView( camera.aspect );
			camera.updateProjectionMatrix();
			const scale = Math.max( width / 2560, height / 1440 );
			for ( const point of [ new Vector3( 0, 4, 0 ), new Vector3( 1, 2, 0 ), new Vector3( -2, 0, 1 ) ] ) {
				const poster = point.clone().project( reference );
				const live = point.clone().project( camera );
				expect( live.x * width / 2 ).toBeCloseTo( poster.x * 2560 * scale / 2, 5 );
				expect( live.y * height / 2 ).toBeCloseTo( poster.y * 1440 * scale / 2, 5 );
			}
		}
	} );
	test( 'maps the viewport edges and center without accepting out-of-bounds movement', () => {
		expect( pointerYaw( 100, 100, 1000 ) ).toBe( -HeroCamera.MAX_YAW );
		expect( pointerYaw( 600, 100, 1000 ) ).toBeCloseTo( 42 * Math.PI / 180 );
		expect( pointerYaw( 350, 100, 1000 ) ).toBeCloseTo( -4 * Math.PI / 180 );
		expect( pointerYaw( 850, 100, 1000 ) ).toBeCloseTo( 46 * Math.PI / 180 );
		expect( pointerYaw( 1100, 100, 1000 ) ).toBe( HeroCamera.MAX_YAW );
		expect( pointerYaw( 9999, 100, 1000 ) ).toBe( HeroCamera.MAX_YAW );
		expect( pointerYaw( -9999, 100, 1000 ) ).toBe( -HeroCamera.MAX_YAW );
		expect( pointerYaw( 1, 0, 0 ) ).toBeCloseTo( 42 * Math.PI / 180 );
		expect( pointerYaw( NaN, 0, 100 ) ).toBeCloseTo( 42 * Math.PI / 180 );
	} );
	test( 'returns to the resting angle more slowly than it follows the pointer, without overshooting', () => {
		const rest = 42 * Math.PI / 180;
		for ( const edge of [ -HeroCamera.MAX_YAW, HeroCamera.MAX_YAW ] ) {
			const returning = easeCameraYaw( edge, rest, 0.25, true );
			const tracking = easeCameraYaw( edge, rest, 0.25, false );
			const remaining = Math.abs( returning - rest ) / Math.abs( edge - rest );
			expect( remaining ).toBeGreaterThan( 0.7 );
			expect( remaining ).toBeLessThan( 0.8 );
			expect( Math.abs( tracking - rest ) / Math.abs( edge - rest ) ).toBeLessThan( 0.4 );
			expect( returning ).toBeGreaterThan( Math.min( edge, rest ) );
			expect( returning ).toBeLessThan( Math.max( edge, rest ) );
			expect( easeCameraYaw( edge, rest, 0, true ) ).toBe( edge );
			let stepped = edge;
			for ( let frame = 0; frame < 60; frame++ ) {
				stepped = easeCameraYaw( stepped, rest, 1 / 60, true );
			}
			expect( stepped ).toBeCloseTo( easeCameraYaw( edge, rest, 1, true ), 10 );
		}
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
