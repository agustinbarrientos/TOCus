import {
	BufferGeometry, Material, Mesh, SkinnedMesh, Texture,
	type Object3D, type Skeleton,
} from 'three';
import type { DisposableResource } from './types';

/**
 * Releases resources owned by a riverside model or its surrounding scene.
 * @param root - Exclusive owner of the geometries, materials, textures and skeletons.
 * @since 1.0.0
 */
export function disposeObjectResources( root: Object3D ): void {
	const geometries = new Set<DisposableResource>();
	const materials = new Set<DisposableResource>();
	const textures = new Set<DisposableResource>();
	const images = new Set<ImageBitmap>();
	const skeletons = new Set<Skeleton>();
	root.traverse( ( object ) => {
		if ( ! ( object instanceof Mesh ) ) {
			return;
		}
		const geometry: unknown = object.geometry;
		if ( geometry instanceof BufferGeometry ) {
			geometries.add( geometry );
		}
		if ( object instanceof SkinnedMesh ) {
			skeletons.add( object.skeleton );
		}
		const ownedMaterial: unknown = object.material;
		const ownedMaterials: unknown[] = Array.isArray( ownedMaterial ) ? ownedMaterial : [ ownedMaterial ];
		for ( const material of ownedMaterials ) {
			if ( ! ( material instanceof Material ) ) {
				continue;
			}
			materials.add( material );
			const values: unknown[] = Object.values( material );
			for ( const value of values ) {
				if ( value instanceof Texture ) {
					textures.add( value );
					const image: unknown = value.source.data;
					if ( typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ) {
						images.add( image );
					}
				}
			}
		}
	} );
	for ( const image of images ) {
		image.close();
	}
	for ( const texture of textures ) {
		texture.dispose();
	}
	for ( const material of materials ) {
		material.dispose();
	}
	for ( const geometry of geometries ) {
		geometry.dispose();
	}
	for ( const skeleton of skeletons ) {
		skeleton.dispose();
	}
}
