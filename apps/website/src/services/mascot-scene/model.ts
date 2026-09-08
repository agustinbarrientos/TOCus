import {
	BufferGeometry, LoadingManager, Material, Mesh, SkinnedMesh, Texture,
	type Object3D, type Skeleton,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { DisposableResource, MascotModel } from './types';

/**
 * Releases resources owned by an imported model or its surrounding studio.
 * @param root - Exclusive owner of the geometries, materials, textures and skeletons.
 * @since 0.1.0
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

/**
 * Loads the user's portable mascot and baked greeting from this website only.
 * @param signal - Cancels network work and discards parsing that completes after disposal.
 * @return The authored mesh hierarchy and its greeting clip.
 * @since 0.1.0
 */
export async function loadMascotModel( signal: AbortSignal ): Promise<MascotModel> {
	const response = await fetch( '/models/mascot.glb', { signal } );
	if ( ! response.ok ) {
		throw new Error( `The mascot asset could not be loaded (${ String( response.status ) }).` );
	}
	const data = await response.arrayBuffer();
	signal.throwIfAborted();
	const manager = new LoadingManager();
	manager.setURLModifier( ( url ) => {
		if ( ! url.startsWith( 'blob:' ) && ! url.startsWith( 'data:' ) ) {
			throw new Error( 'The mascot asset must contain its own resources.' );
		}
		return url;
	} );
	const gltf = await new GLTFLoader( manager ).parseAsync( data, '' );
	const clip = gltf.animations.find( ( animation ) => animation.name === 'Greeting' );
	const hasMesh = gltf.scene.getObjectByProperty( 'isMesh', true ) !== undefined;
	gltf.scene.traverse( ( object ) => {
		if ( object instanceof Mesh ) {
			object.castShadow = true;
			object.receiveShadow = true;
		}
	} );
	if ( signal.aborted || ! clip || ! hasMesh ) {
		disposeObjectResources( gltf.scene );
		signal.throwIfAborted();
		throw new Error( 'The mascot asset is missing its mesh or greeting animation.' );
	}
	return { root: gltf.scene, clip };
}
