import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { prepareMascotAsset } from './index';

/**
 * Embeds the repaired mesh, textures and animation in one portable binary asset.
 * @param source - Unchanged user-supplied GLB bytes.
 * @return Self-contained GLB suitable for standard glTF viewers.
 * @since 0.1.0
 */
export async function exportMascotGlb( source: ArrayBuffer ): Promise<ArrayBuffer> {
	const imported = await new GLTFLoader().parseAsync( source, '' );
	const prepared = prepareMascotAsset( imported.scene );
	const output = await new GLTFExporter().parseAsync( prepared.root, {
		binary: true, animations: prepared.animations,
	} );
	if ( ! ( output instanceof ArrayBuffer ) ) {
		throw new Error( 'Expected binary GLB output.' );
	}
	return output;
}
