import {
	AnimationClip, AnimationMixer, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, VectorKeyframeTrack,
} from 'three';
import { describe, expect, test } from 'vitest';
import { createSipHeadFollow } from './sip-head-follow';

/**
 * Builds the same shared limb material and flat animated prop hierarchy as the exported asset.
 * @return The independently inspectable scene parts and their original shared resources.
 */
function fixture() {
	const root = new Group();
	const geometry = new SphereGeometry();
	const material = new MeshStandardMaterial();
	const arm = new Mesh( geometry, material );
	arm.name = 'Right_seamless_arm_and_three-finger_paw001';
	arm.morphTargetDictionary = { 'Sip 04': 0, 'Sip 08': 1 };
	arm.morphTargetInfluences = [ 0, 0 ];
	const restingArm = new Mesh( geometry, material );
	restingArm.name = 'Left_seamless_arm_and_three-finger_paw001';
	const mate = new Mesh( geometry, new MeshStandardMaterial() );
	mate.name = 'Mate_|_Bombilla_straw001';
	root.add( arm, restingArm, mate );
	return { root, geometry, material, arm, restingArm, mate };
}

describe( 'mate follows the looking head during a sip', () => {
	test( 'preserves the animated prop transform without accumulating rotation on constant mixer poses', () => {
		const { root, arm, mate } = fixture();
		const follow = createSipHeadFollow( root );
		const mixer = new AnimationMixer( root );
		const track = new VectorKeyframeTrack( `${ mate.name }.position`, [ 0, 1, 2 ], [ 0, 0, 0, 0.2, 0.8, 0, 0.2, 0.8, 0 ] );
		mixer.clipAction( new AnimationClip( 'sip', 2, [ track ] ) ).play();
		arm.morphTargetInfluences = [ 0, 1 ];
		const yaw = 35 * Math.PI / 180;
		const point = new Vector3( 0.1, 2.2, -1.6 );
		const pivot = new Vector3( 0, 2.5, -0.08 );
		const expected = point.clone().add( new Vector3( 0.2, 0.8, 0 ) ).sub( pivot )
			.applyAxisAngle( new Vector3( 0, 1, 0 ), -yaw ).add( pivot );
		for ( const time of [ 1.1, 1.2, 1.3 ] ) {
			mixer.setTime( time );
			follow.update( yaw );
			root.updateMatrixWorld( true );
			expect( point.clone().applyMatrix4( mate.matrixWorld ).distanceTo( expected ) ).toBeLessThan( 0.000001 );
			expect( mate.position.distanceTo( new Vector3( 0.2, 0.8, 0 ) ) ).toBeLessThan( 0.000001 );
		}
		follow.dispose();
		expect( mate.parent ).toBe( root );
	} );

	test( 'keeps rest poses and other limbs unchanged, and restores owned materials on disposal', () => {
		const { root, arm, mate, material, restingArm, geometry } = fixture();
		const follow = createSipHeadFollow( root );
		follow.update( Math.PI / 5 );
		root.updateMatrixWorld( true );
		expect( mate.matrixWorld.elements ).toEqual( mate.matrix.elements );
		expect( arm.material ).not.toBe( material );
		expect( restingArm.material ).toBe( material );
		expect( Object.hasOwn( material, 'onBeforeCompile' ) ).toBe( false );
		expect( arm.geometry ).toBe( geometry );
		expect( arm.customDepthMaterial ).toBeDefined();
		expect( restingArm.customDepthMaterial ).toBeUndefined();
		expect( arm.frustumCulled ).toBe( false );
		follow.dispose();
		expect( arm.material ).toBe( material );
		expect( arm.customDepthMaterial ).toBeUndefined();
		expect( arm.frustumCulled ).toBe( true );
		expect( mate.parent ).toBe( root );
	} );

	test( 'matches both full-sip turn directions and resets the overlay when the cup is lowered', () => {
		const { root, arm, mate } = fixture();
		const follow = createSipHeadFollow( root );
		const contact = new Vector3( 0, 2.95, -1.75 );
		const pivot = new Vector3( 0, 2.5, -0.08 );
		for ( const yaw of [ -35, 35 ].map( ( degrees ) => degrees * Math.PI / 180 ) ) {
			arm.morphTargetInfluences = [ 0, 1 ];
			follow.update( yaw );
			root.updateMatrixWorld( true );
			const expected = contact.clone().sub( pivot ).applyAxisAngle( new Vector3( 0, 1, 0 ), -yaw ).add( pivot );
			expect( contact.clone().applyMatrix4( mate.matrixWorld ).distanceTo( expected ) ).toBeLessThan( 0.000001 );
		}
		arm.morphTargetInfluences = [ 0, 0 ];
		follow.update( 35 * Math.PI / 180 );
		root.updateMatrixWorld( true );
		expect( contact.clone().applyMatrix4( mate.matrixWorld ).distanceTo( contact ) ).toBe( 0 );
		follow.dispose();
	} );
} );
