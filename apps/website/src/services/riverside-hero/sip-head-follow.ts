import {
	Group, type Material, MathUtils, Matrix4, Mesh, MeshDepthMaterial, MeshStandardMaterial, type Object3D,
	RGBADepthPacking,
} from 'three';
import type { HeroSipFollow } from './types';

const ArmShader = `
uniform float sipFollowYaw;
uniform float sipBlendEnd;
vec3 turnSipVector(vec3 v, float angle) {
	float c = cos(angle), s = sin(angle);
	return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}
float sipArmWeight(vec3 p) {
	return smoothstep(0.12, sipBlendEnd, distance(p, vec3(0.80, 1.94, -0.02)));
}
vec3 turnSipPosition(vec3 p) {
	vec3 pivot = vec3(0.0, 2.5, -0.08);
	return pivot + turnSipVector(p - pivot, -sipFollowYaw * sipArmWeight(p));
}
vec3 turnSipNormal(vec3 p, vec3 n) {
	vec3 direction = p - vec3(0.80, 1.94, -0.02);
	float radius = length(direction);
	float span = sipBlendEnd - 0.12;
	float t = clamp((radius - 0.12) / span, 0.0, 1.0);
	float angle = -sipFollowYaw * sipArmWeight(p);
	vec3 offset = turnSipVector(p - vec3(0.0, 2.5, -0.08), angle);
	vec3 normal = turnSipVector(n, angle);
	vec3 gradient = direction / max(radius, 0.0001) * (-sipFollowYaw * 6.0 * t * (1.0 - t) / span);
	gradient = turnSipVector(gradient, angle);
	vec3 tangent = vec3(offset.z, 0.0, -offset.x);
	return normalize(normal - gradient * dot(tangent, normal) / (1.0 + dot(tangent, gradient)));
}
`;

/**
 * Narrows loaded scene objects without propagating the mesh constructor's untyped generics.
 * @param object - A node in the exported scene.
 * @return Whether the node is a mesh with the standard geometry and material contract.
 */
function isMesh( object: Object3D ): object is Mesh {
	return object instanceof Mesh;
}

/**
 * Adds the viewer-facing turn to the raised cup and grip while keeping the shoulder anchored.
 * @param root - The flat, world-space character export, before its animation mixer is created.
 * @return An overlay updated after the mixer and head, plus its owned-resource cleanup.
 * @since 0.1.0
 */
export function createSipHeadFollow( root: Object3D ): HeroSipFollow {
	const yaw = { value: 0 };
	const blendEnd = { value: 1.08 };
	const overlay = new Group();
	overlay.name = 'Mate head follow';
	overlay.matrixAutoUpdate = false;
	const rotation = new Matrix4();
	const inversePivot = new Matrix4().makeTranslation( 0, -2.5, 0.08 );
	const props = new Map<Mesh, Object3D>();
	const materials: Material[] = [];
	const depth = new MeshDepthMaterial( { depthPacking: RGBADepthPacking } );
	let arm: Mesh | undefined;
	root.traverse( ( object ) => {
		if ( ! isMesh( object ) ) {
			return;
		}
		const name = object.name.replaceAll( '_', ' ' );
		if ( /^Right.*seamless arm/u.test( name ) ) {
			arm = object;
		} else if ( name.startsWith( 'Mate |' ) && object.parent ) {
			props.set( object, object.parent );
		}
	} );
	root.add( overlay );
	for ( const object of props.keys() ) {
		overlay.add( object );
	}
	const originalMaterial = arm?.material;
	const originalDepth = arm?.customDepthMaterial;
	const originalCulling = arm?.frustumCulled;

	/**
	 * Uses the same post-morph turn for the lit surface and its shadow.
	 * @param material - An exclusive arm surface or depth material.
	 * @param normals - Whether the shader needs the deformation's inverse-transpose normal.
	 */
	function prepare( material: Material, normals: boolean ): void {
		material.onBeforeCompile = ( shader ) => {
			shader.uniforms.sipFollowYaw = yaw;
			shader.uniforms.sipBlendEnd = blendEnd;
			let source = shader.vertexShader.replace( '#include <common>', `#include <common>\n${ ArmShader }` );
			if ( normals ) {
				source = source.replace( '#include <defaultnormal_vertex>', '' ).replace( '#include <normal_vertex>', '' );
			}
			shader.vertexShader = source.replace( '#include <project_vertex>', `
				${ normals ? `objectNormal = turnSipNormal(transformed, objectNormal);
				#include <defaultnormal_vertex>
				#include <normal_vertex>` : '' }
				transformed = turnSipPosition(transformed);
				#include <project_vertex>
			` );
		};
		material.customProgramCacheKey = () => `riverside-sip-follow-${ String( normals ) }`;
	}

	prepare( depth, false );
	if ( arm && originalMaterial ) {
		const owned: unknown = originalMaterial;
		const candidates: unknown[] = Array.isArray( owned ) ? owned : [ owned ];
		for ( const candidate of candidates ) {
			if ( candidate instanceof MeshStandardMaterial ) {
				const material = candidate.clone();
				prepare( material, true );
				materials.push( material );
			}
		}
		arm.material = Array.isArray( originalMaterial ) ? materials : materials[ 0 ] ?? originalMaterial;
		arm.customDepthMaterial = depth;
		arm.frustumCulled = false;
	}
	const sipTargets = Object.entries( arm?.morphTargetDictionary ?? {} )
		.filter( ( [ name ] ) => /^Sip \d{2}$/u.test( name ) )
		.map( ( [ name, index ] ) => ( { index, amount: Number( name.slice( 4 ) ) / 8 } ) );
	return {
		/**
		 * Follows the head as the cup rises without changing any mixer-authored transforms.
		 * @param headYaw - The current head turn, in radians.
		 */
		update( headYaw ) {
			const sip = MathUtils.clamp( sipTargets.reduce( ( amount, target ) =>
				amount + ( arm?.morphTargetInfluences?.[ target.index ] ?? 0 ) * target.amount, 0 ), 0, 1 );
			yaw.value = headYaw * MathUtils.smoothstep( sip, 0.1, 0.95 );
			blendEnd.value = 1.08 + 0.48 * sip * sip;
			overlay.matrix.makeTranslation( 0, 2.5, -0.08 )
				.multiply( rotation.makeRotationY( -yaw.value ) ).multiply( inversePivot );
			overlay.matrixWorldNeedsUpdate = true;
		},
		/** Restores shared limb resources and removes only this controller's overlay. */
		dispose() {
			for ( const [ object, parent ] of props ) {
				parent.add( object );
			}
			overlay.removeFromParent();
			if ( arm && originalMaterial ) {
				arm.material = originalMaterial;
				arm.customDepthMaterial = originalDepth;
				arm.frustumCulled = originalCulling ?? true;
			}
			for ( const material of materials ) {
				material.dispose();
			}
			depth.dispose();
		},
	};
}
