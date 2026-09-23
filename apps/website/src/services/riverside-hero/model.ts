import { LoadingManager, Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { disposeObjectResources } from './dispose';
import type { RiversideModel } from './types';

/**
 * Loads only the packaged scene, retaining its baked soft deformation.
 * @param signal - Cancels downloading and discards stale parsing.
 * @return The native geometry and baked animation clips.
 * @since 1.0.0
 */
export async function loadRiversideModel( signal: AbortSignal ): Promise<RiversideModel> {
	const response = await fetch( '/models/riverside/hero.glb', { signal } );
	if ( ! response.ok ) {
		throw new Error( `Scene download failed (${ String( response.status ) }).` );
	}
	const data = await response.arrayBuffer();
	signal.throwIfAborted();
	const manager = new LoadingManager();
	manager.setURLModifier( ( url ) => {
		if ( ! url.startsWith( 'blob:' ) && ! url.startsWith( 'data:' ) ) {
			throw new Error( 'The scene must include all of its own resources.' );
		}
		return url;
	} );
	const gltf = await new GLTFLoader( manager ).setMeshoptDecoder( MeshoptDecoder ).parseAsync( data, '' );
	if ( signal.aborted || ! gltf.scene.getObjectByProperty( 'isMesh', true ) || ! gltf.animations.length ) {
		disposeObjectResources( gltf.scene );
		signal.throwIfAborted();
		throw new Error( 'The scene is missing geometry or its drinking animation.' );
	}
	gltf.scene.traverse( ( object ) => {
		if ( object instanceof Mesh ) {
			object.castShadow = true;
			object.receiveShadow = true;
		}
	} );
	return { root: gltf.scene, clips: gltf.animations };
}
