import {
	Bone, BufferGeometry, Group, Mesh, MeshPhysicalMaterial,
	MeshStandardMaterial, Skeleton, SkinnedMesh, Texture,
} from 'three';
import { describe, expect, test } from 'vitest';
import { disposeObjectResources } from './dispose';

describe( 'disposing riverside scene resources', () => {
	test( 'releases shared geometry and every material once across nested meshes and material arrays', () => {
		const geometry = new BufferGeometry();
		const clay = new MeshStandardMaterial();
		const detail = new MeshStandardMaterial();
		const nested = new Group().add( new Mesh( geometry, [ clay, detail, clay ] ) );
		const root = new Group().add( new Mesh( geometry, clay ), nested );
		const released: string[] = [];
		geometry.addEventListener( 'dispose', () => released.push( 'geometry' ) );
		clay.addEventListener( 'dispose', () => released.push( 'clay' ) );
		detail.addEventListener( 'dispose', () => released.push( 'detail' ) );

		disposeObjectResources( root );

		expect( released.sort() ).toEqual( [ 'clay', 'detail', 'geometry' ] );
	} );

	test( 'releases every physical-material texture slot and deduplicates textures shared across materials', () => {
		const slots = [
			'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'envMap', 'lightMap', 'map',
			'metalnessMap', 'normalMap', 'roughnessMap', 'anisotropyMap', 'clearcoatMap', 'clearcoatNormalMap',
			'clearcoatRoughnessMap', 'iridescenceMap', 'iridescenceThicknessMap', 'sheenColorMap',
			'sheenRoughnessMap', 'specularColorMap', 'specularIntensityMap', 'thicknessMap', 'transmissionMap',
		] as const;
		const material = new MeshPhysicalMaterial();
		const released: string[] = [];
		for ( const slot of slots ) {
			const texture = new Texture();
			texture.addEventListener( 'dispose', () => released.push( slot ) );
			material[ slot ] = texture;
		}
		const secondMaterial = new MeshStandardMaterial( { map: material.map, normalMap: material.normalMap } );
		const root = new Mesh( new BufferGeometry(), [ material, secondMaterial ] );

		disposeObjectResources( root );

		expect( released.sort() ).toEqual( [ ...slots ].sort() );
	} );

	test( 'releases the bone texture of a skeleton shared by multiple skinned meshes', () => {
		const skeleton = new Skeleton( [ new Bone() ] ).computeBoneTexture();
		const geometry = new BufferGeometry();
		const material = new MeshStandardMaterial();
		const firstMesh = new SkinnedMesh( geometry, material );
		const secondMesh = new SkinnedMesh( geometry, material );
		firstMesh.bind( skeleton );
		secondMesh.bind( skeleton );
		let released = 0;
		skeleton.boneTexture?.addEventListener( 'dispose', () => released++ );

		disposeObjectResources( new Group().add( firstMesh, secondMesh ) );

		expect( released ).toBe( 1 );
		expect( skeleton.boneTexture ).toBeNull();
	} );
} );
