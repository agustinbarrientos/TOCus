import {
	type Material, MathUtils, Mesh, MeshDepthMaterial, MeshStandardMaterial, type Object3D, RGBADepthPacking,
} from 'three';
import { HeroCamera, type HeroHeadMotion } from './types';

const MaxHeadYaw = 35 * Math.PI / 180;

// Exported character meshes use world-space coordinates, Y up, with the neck at (0, 2.5, -0.08).
const HeadShader = `
uniform float headYaw;
float neckWeight(vec3 p) { return smoothstep(2.02, 2.85, p.y); }
vec3 turnHeadVector(vec3 v, float angle) {
	float c = cos(angle), s = sin(angle);
	return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}
vec3 turnHeadPosition(vec3 p) {
	vec3 pivot = vec3(0.0, 2.5, -0.08);
	return pivot + turnHeadVector(p - pivot, -headYaw * neckWeight(p));
}
vec3 turnHeadNormal(vec3 p, vec3 n) {
	float t = clamp((p.y - 2.02) / 0.83, 0.0, 1.0);
	float angle = -headYaw * neckWeight(p);
	vec3 offset = turnHeadVector(p - vec3(0.0, 2.5, -0.08), angle);
	vec3 normal = turnHeadVector(n, angle);
	float rate = -headYaw * 6.0 * t * (1.0 - t) / 0.83;
	normal.y -= rate * (offset.z * normal.x - offset.x * normal.z);
	return normalize(normal);
}
`;

/**
 * Turns the head after the exported pose deformation, leaving the body and limbs anchored.
 * @param root - The exclusive scene loaded from the self-contained hero asset.
 * @return A shared shader control and disposal boundary for the matching shadow material.
 * @since 0.1.0
 */
export function createHeadMotion( root: Object3D ): HeroHeadMotion {
	const uniform = { value: 0 };
	const depth = new MeshDepthMaterial( { depthPacking: RGBADepthPacking } );
	const materials = new Set<Material>();

	/**
	 * Adds the same deformation to color and shadow shaders without extra geometry.
	 * @param material - An owned head material or the shared depth material.
	 * @param normals - Whether the shader also needs corrected surface normals.
	 */
	function prepare( material: Material, normals: boolean ): void {
		material.onBeforeCompile = ( shader ) => {
			shader.uniforms.headYaw = uniform;
			let source = shader.vertexShader.replace( '#include <common>', `#include <common>\n${ HeadShader }` );
			if ( normals ) {
				source = source.replace( '#include <defaultnormal_vertex>', '' ).replace( '#include <normal_vertex>', '' );
			}
			shader.vertexShader = source.replace( '#include <project_vertex>', `
				${ normals ? `objectNormal = turnHeadNormal(transformed, objectNormal);
				#include <defaultnormal_vertex>
				#include <normal_vertex>` : '' }
				transformed = turnHeadPosition(transformed);
				#include <project_vertex>
			` );
		};
		material.customProgramCacheKey = () => `riverside-head-${ String( normals ) }`;
	}

	prepare( depth, false );
	root.traverse( ( object ) => {
		const name = object.name.replaceAll( '_', ' ' );
		const isHead = /^(?:Body|Smile)|inset glossy eye|softly cupped ear/u.test( name );
		if ( ! ( object instanceof Mesh ) || ! isHead ) {
			return;
		}
		// GPU head turns move small facial details outside their undeformed CPU bounds.
		object.frustumCulled = false;
		object.customDepthMaterial = depth;
		const owned: unknown = object.material;
		const candidates: unknown[] = Array.isArray( owned ) ? owned : [ owned ];
		for ( const material of candidates ) {
			if ( material instanceof MeshStandardMaterial && ! materials.has( material ) ) {
				materials.add( material );
				prepare( material, true );
			}
		}
	} );
	return {
		/**
		 * Turns toward the viewer independently of the ongoing sip and blink animation.
		 * @param cameraYaw - The already-eased camera angle.
		 * @return The applied screen-directed head angle in radians.
		 */
		update( cameraYaw ) {
			uniform.value = MathUtils.clamp( cameraYaw / HeroCamera.MAX_YAW, -1, 1 ) * MaxHeadYaw;
			return uniform.value;
		},
		/** Releases the custom shadow material alongside the owning scene. */
		dispose() {
			depth.dispose();
		},
	};
}
