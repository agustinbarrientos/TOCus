import { BufferGeometry, Group, Mesh, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { paintMascot } from './paint';
import { rigMascot } from './rig';
import type { PreparedMascotAsset } from './types';

/**
 * Checks imported values at the untyped asset boundary.
 * @param value - Candidate geometry from the source scene.
 * @return Whether the value is a supported buffer geometry.
 */
function isBufferGeometry( value: unknown ): value is BufferGeometry {
	return value instanceof BufferGeometry;
}

/**
 * Prepares the supplied mesh for local GLB export.
 * @param source - Original imported scene.
 * @return Exportable asset.
 * @since 0.1.0
 */
export function prepareMascotAsset( source: Group ): PreparedMascotAsset {
	const original = source.getObjectByProperty( 'isMesh', true );
	if ( ! ( original instanceof Mesh ) ) {
		throw new Error( `The source GLB needs a compatible mesh (received ${ original?.type ?? 'none' }).` );
	}
	const sourceGeometry: unknown = original.geometry;
	if ( ! isBufferGeometry( sourceGeometry ) ) {
		throw new Error( 'Expected buffer geometry.' );
	}
	const geometry = sourceGeometry.clone();
	geometry.computeVertexNormals();
	const materials = paintMascot( geometry );
	// A portable tangent basis also avoids renderer-specific normal-map handedness.
	geometry.computeTangents();
	const { bones, clip } = rigMascot( geometry );
	const mesh = new SkinnedMesh( geometry, materials );
	mesh.name = 'Supplied capybara mesh';
	mesh.add( bones[ 0 ] );
	mesh.bind( new Skeleton( bones ) );
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	const root = new Group();
	root.name = 'TOCus supplied capybara';
	root.add( mesh );
	geometry.computeBoundingBox();
	const bounds = geometry.boundingBox;
	if ( bounds === null ) {
		throw new Error( 'The supplied geometry has no finite bounds.' );
	}
	const scale = 4.2 / bounds.getSize( new Vector3() ).y;
	root.scale.setScalar( scale );
	root.position.y = -bounds.min.y * scale;
	root.updateMatrixWorld( true );
	return { root, animations: [ clip ] };
}
