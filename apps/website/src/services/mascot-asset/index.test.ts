import { readFileSync } from 'node:fs';
import { AnimationMixer, BufferGeometry, Mesh, SkinnedMesh, Vector3, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, test } from 'vitest';
import { prepareMascotAsset } from './index';

/**
 * Reads the user's geometry rather than substituting a hand-built character.
 * @return Parsed original source asset.
 */
async function sourceModel() {
	const bytes = readFileSync( new URL( './assets/white-mesh.glb', import.meta.url ) );
	return new GLTFLoader().parseAsync( bytes.buffer.slice( bytes.byteOffset, bytes.byteOffset + bytes.byteLength ), '' );
}

describe( 'repairing the supplied mascot asset', () => {
	test( 'preserves the supplied triangle positions while adding a usable textured skin', async () => {
		const original = await sourceModel();
		const originalMesh = original.scene.getObjectByProperty( 'isMesh', true );
		if ( ! ( originalMesh instanceof Mesh ) ) {
			throw new Error( 'Expected the supplied mesh.' );
		}
		if ( ! ( originalMesh.geometry instanceof BufferGeometry ) ) {
			throw new Error( 'Expected buffer geometry.' );
		}
		const originalGeometry = originalMesh.geometry as BufferGeometry;
		const positions = Array.from( originalGeometry.getAttribute( 'position' ).array );
		const repaired = prepareMascotAsset( original.scene );
		const mesh = repaired.root.getObjectByProperty( 'isSkinnedMesh', true );
		expect( mesh ).toBeInstanceOf( SkinnedMesh );
		if ( ! ( mesh instanceof SkinnedMesh ) ) {
			throw new Error( 'Expected a skinned source mesh.' );
		}
		if ( ! ( mesh.geometry instanceof BufferGeometry ) ) {
			throw new Error( 'Expected buffer geometry.' );
		}
		const geometry = mesh.geometry as BufferGeometry;
		expect( Array.from( geometry.getAttribute( 'position' ).array ) ).toEqual( positions );
		expect( geometry.index?.count ).toBe( 90000 );
		for ( const name of [ 'normal', 'tangent', 'uv', 'color', 'skinWeight', 'skinIndex' ] ) {
			expect( geometry.getAttribute( name ).array.every( Number.isFinite ) ).toBe( true );
		}
		const weights = geometry.getAttribute( 'skinWeight' );
		for ( let index = 0; index < weights.count; index++ ) {
			expect( weights.getX( index ) + weights.getY( index ) + weights.getZ( index ) + weights.getW( index ) )
				.toBeCloseTo( 1, 5 );
		}
		const material = mesh.material as Material | Material[];
		const materials = Array.isArray( material ) ? material : [ material ];
		expect( materials.some( ( material ) => 'map' in material && material.map !== null ) ).toBe( true );
		expect( materials.some( ( material ) => 'normalMap' in material && material.normalMap !== null ) ).toBe( true );
	} );

	test( 'waves the original paw without moving the cheek or feet and returns to bind pose', async () => {
		const repaired = prepareMascotAsset( ( await sourceModel() ).scene );
		const mesh = repaired.root.getObjectByProperty( 'isSkinnedMesh', true );
		expect( mesh ).toBeInstanceOf( SkinnedMesh );
		if ( ! ( mesh instanceof SkinnedMesh ) ) {
			throw new Error( 'Expected a skinned source mesh.' );
		}
		if ( ! ( mesh.geometry instanceof BufferGeometry ) ) {
			throw new Error( 'Expected buffer geometry.' );
		}
		const geometry = mesh.geometry as BufferGeometry;
		expect( repaired.animations[ 0 ].duration ).toBeGreaterThan( 1 );
		const mixer = new AnimationMixer( repaired.root );
		mixer.clipAction( repaired.animations[ 0 ] ).play();
		const position = geometry.getAttribute( 'position' );
		const candidates = Array.from( { length: position.count }, ( _, index ) => index );
		/**
		 * @param target - Original-space feature location on the supplied mesh.
		 * @return Nearest original vertex to a hand-measured surface landmark.
		 */
		const findNearest = ( target: Vector3 ) => candidates.reduce( ( best, index ) =>
			new Vector3().fromBufferAttribute( position, index ).distanceToSquared( target ) <
			new Vector3().fromBufferAttribute( position, best ).distanceToSquared( target ) ? index : best, 0 );
		const paw = findNearest( new Vector3( -0.62, 0.31, 0.13 ) );
		const cheek = findNearest( new Vector3( -0.43, 0.28, 0.22 ) );
		const foot = findNearest( new Vector3( -0.25, -0.96, 0.24 ) );
		/**
		 * @param index - Original vertex to evaluate after applying the skeleton.
		 * @param seconds - Absolute time within the greeting animation.
		 * @return Deformed position at an absolute, reproducible animation time.
		 */
		const at = ( index: number, seconds: number ) => {
			mixer.setTime( seconds );
			repaired.root.updateMatrixWorld( true );
			mesh.skeleton.update();
			return mesh.applyBoneTransform( index, new Vector3().fromBufferAttribute( position, index ) );
		};
		const bind = at( paw, 0 );
		expect( at( paw, 1.1 ).distanceTo( bind ) ).toBeGreaterThan( 0.003 );
		expect( at( paw, 1.1 ).distanceTo( bind ) ).toBeLessThan( 0.1 );
		for ( const index of [ cheek, foot ] ) {
			expect( at( index, 1.1 ).distanceTo( at( index, 0 ) ) ).toBeLessThan( 0.00001 );
		}
		expect( at( paw, 0 ).distanceTo( bind ) ).toBeLessThan( 0.00001 );
	} );
} );
