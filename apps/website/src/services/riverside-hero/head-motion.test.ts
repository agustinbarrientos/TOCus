import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { describe, expect, test } from 'vitest';
import { createHeadMotion } from './head-motion';
import { HeroCamera } from './types';

describe( 'independent hero head movement', () => {
	test( 'turns eyes and ear material parts with the head after loader name sanitization', () => {
		const root = new Group();
		const geometry = new SphereGeometry();
		const material = new MeshStandardMaterial();
		const head = [
			'Body_soft_continuous_head_and_belly004', 'Right_inset_glossy_eye004',
			'Left_inset_glossy_eye004', 'Right_softly_cupped_ear_mesh001_evaluated_web_1',
			'Left_softly_cupped_ear_mesh001_evaluated_web', 'Smile_inset_warm_line_00',
		].map( ( name ) => {
			const mesh = new Mesh( geometry, material );
			mesh.name = name;
			root.add( mesh );
			return mesh;
		} );
		const limb = new Mesh( geometry, new MeshStandardMaterial() );
		limb.name = 'Right_seamless_arm_and_three-finger_paw';
		root.add( limb );
		const motion = createHeadMotion( root );
		for ( const mesh of head ) {
			expect( mesh.customDepthMaterial, mesh.name ).toBeDefined();
			expect( mesh.frustumCulled, mesh.name ).toBe( false );
		}
		expect( limb.customDepthMaterial ).toBeUndefined();
		expect( limb.frustumCulled ).toBe( true );
		motion.dispose();
		geometry.dispose();
		material.dispose();
		limb.material.dispose();
	} );
	test( 'bounds pointer following without rotating the body or rebuilding geometry', () => {
		const root = new Group();
		const body = new Mesh( new SphereGeometry(), new MeshStandardMaterial() );
		body.name = 'Body soft continuous head and belly';
		root.add( body );
		const geometry = body.geometry;
		const motion = createHeadMotion( root );
		expect( motion.update( 0 ) ).toBe( 0 );
		expect( motion.update( HeroCamera.MAX_YAW ) ).toBeCloseTo( 35 * Math.PI / 180 );
		expect( motion.update( HeroCamera.MAX_YAW / 2 ) ).toBeCloseTo( 17.5 * Math.PI / 180 );
		expect( motion.update( -HeroCamera.MAX_YAW ) ).toBeCloseTo( -35 * Math.PI / 180 );
		expect( motion.update( 100 ) ).toBeCloseTo( 35 * Math.PI / 180 );
		expect( body.rotation.toArray() ).toEqual( [ 0, 0, 0, 'XYZ' ] );
		expect( root.rotation.toArray() ).toEqual( [ 0, 0, 0, 'XYZ' ] );
		expect( body.geometry ).toBe( geometry );
		expect( body.frustumCulled ).toBe( false );
		motion.dispose();
		geometry.dispose();
		body.material.dispose();
	} );

	test( 'keeps following the pointer throughout sipping without changing the baked pose', () => {
		const root = new Group();
		const body = new Mesh( new SphereGeometry(), new MeshStandardMaterial() );
		body.name = 'Body soft continuous head and belly';
		body.morphTargetDictionary = { 'Sip 04': 0, 'Sip 08': 1 };
		body.morphTargetInfluences = [ 0, 0 ];
		root.add( body );
		const motion = createHeadMotion( root );
		const resting = motion.update( HeroCamera.MAX_YAW );
		body.morphTargetInfluences[ 0 ] = 1;
		expect( motion.update( HeroCamera.MAX_YAW ) ).toBe( resting );
		expect( body.morphTargetInfluences ).toEqual( [ 1, 0 ] );
		body.morphTargetInfluences = [ 0, 1 ];
		expect( motion.update( HeroCamera.MAX_YAW ) ).toBe( resting );
		expect( motion.update( -HeroCamera.MAX_YAW ) ).toBe( -resting );
		expect( body.morphTargetInfluences ).toEqual( [ 0, 1 ] );
		body.morphTargetInfluences[ 1 ] = 0;
		expect( motion.update( HeroCamera.MAX_YAW ) ).toBe( resting );
		motion.dispose();
		body.geometry.dispose();
		body.material.dispose();
	} );
} );
