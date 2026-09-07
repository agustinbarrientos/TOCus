import {
	AnimationMixer, Bone, BufferGeometry, Group, LoopOnce, Mesh, MeshPhysicalMaterial,
	MeshStandardMaterial, Skeleton, SkinnedMesh, Texture, Vector3,
} from 'three';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { disposeObjectResources, loadMascotModel } from './model';

/**
 * Encodes a deliberately asymmetric triangle and a half-turn of its authored paw.
 * @param hasMesh - Whether the scene contains the required mesh.
 * @param animationName - The authored animation name.
 * @param bufferUri - Optional resource reference for testing portable-asset validation.
 * @return A self-contained glTF binary, unless an external buffer was requested.
 */
function mascotFixture( hasMesh = true, animationName = 'Greeting', bufferUri?: string ): ArrayBuffer {
	const binary = new Float32Array( [
		-2, 0, 0, 1, 0, 0, 0, 3, 1,
		0, 1,
		0, 0, 0, 1, 0, 0, 1, 0,
	] );
	const document = {
		asset: { version: '2.0' },
		scene: 0,
		scenes: [ { nodes: [ 0 ] } ],
		nodes: [
			{ name: 'AuthoredMascot', translation: [ 4, 5, 6 ], children: [ 1 ] },
			{ name: 'WavingPaw', scale: [ 1.5, 2, 3 ], ...( hasMesh ? { mesh: 0 } : {} ) },
		],
		meshes: [ { primitives: [ { attributes: { POSITION: 0 }, material: 0 } ] } ],
		materials: [ { pbrMetallicRoughness: { baseColorFactor: [ 0.8, 0.3, 0.1, 1 ], roughnessFactor: 0.65 } } ],
		buffers: [ { byteLength: binary.byteLength, ...( bufferUri ? { uri: bufferUri } : {} ) } ],
		bufferViews: [
			{ buffer: 0, byteOffset: 0, byteLength: 36 },
			{ buffer: 0, byteOffset: 36, byteLength: 8 },
			{ buffer: 0, byteOffset: 44, byteLength: 32 },
		],
		accessors: [
			{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [ -2, 0, 0 ], max: [ 1, 3, 1 ] },
			{ bufferView: 1, componentType: 5126, count: 2, type: 'SCALAR', min: [ 0 ], max: [ 1 ] },
			{ bufferView: 2, componentType: 5126, count: 2, type: 'VEC4' },
		],
		animations: [ {
			name: animationName,
			samplers: [ { input: 1, output: 2, interpolation: 'LINEAR' } ],
			channels: [ { sampler: 0, target: { node: 1, path: 'rotation' } } ],
		} ],
	};
	const json = new TextEncoder().encode( JSON.stringify( document ) );
	const jsonLength = Math.ceil( json.byteLength / 4 ) * 4;
	const glb = new ArrayBuffer( 12 + 8 + jsonLength + 8 + binary.byteLength );
	const header = new DataView( glb );
	header.setUint32( 0, 0x46546c67, true );
	header.setUint32( 4, 2, true );
	header.setUint32( 8, glb.byteLength, true );
	header.setUint32( 12, jsonLength, true );
	header.setUint32( 16, 0x4e4f534a, true );
	new Uint8Array( glb, 20, jsonLength ).fill( 0x20 ).set( json );
	header.setUint32( 20 + jsonLength, binary.byteLength, true );
	header.setUint32( 24 + jsonLength, 0x004e4942, true );
	new Uint8Array( glb, 28 + jsonLength ).set( new Uint8Array( binary.buffer ) );
	return glb;
}

/**
 * Replaces only the network boundary and requires the expected local asset route.
 * @param response - Real HTTP response consumed by the loader.
 */
function serveMascot( response: Response ): void {
	vi.stubGlobal( 'fetch', ( input: string, init?: RequestInit ) => {
		if ( input !== '/models/mascot.glb' || ! ( init?.signal instanceof AbortSignal ) ) {
			return Promise.reject( new Error( 'The mascot must use its local asset route and cancellation signal.' ) );
		}
		return Promise.resolve( response );
	} );
}

afterEach( () => {
	vi.unstubAllGlobals();
} );

describe( 'loading the authored mascot', () => {
	test( 'preserves imported vertices, hierarchy, transforms, and material appearance', async () => {
		serveMascot( new Response( mascotFixture() ) );
		const model = await loadMascotModel( new AbortController().signal );
		try {
			const paw = model.root.getObjectByName( 'WavingPaw' );
			if ( ! ( paw instanceof Mesh ) || ! ( paw.material instanceof MeshStandardMaterial ) ) {
				throw new Error( 'Expected the authored paw mesh and its PBR material.' );
			}
			const geometry = paw.geometry as BufferGeometry;
			expect( Array.from( geometry.getAttribute( 'position' ).array ) ).toEqual( [
				-2, 0, 0, 1, 0, 0, 0, 3, 1,
			] );
			expect( paw.parent?.name ).toBe( 'AuthoredMascot' );
			expect( paw.parent?.position.toArray() ).toEqual( [ 4, 5, 6 ] );
			expect( paw.scale.toArray() ).toEqual( [ 1.5, 2, 3 ] );
			expect( paw.material.color.toArray() ).toEqual( [ 0.8, 0.3, 0.1 ] );
			expect( paw.material.roughness ).toBe( 0.65 );
			expect( paw.castShadow ).toBe( true );
			expect( paw.receiveShadow ).toBe( true );
		} finally {
			disposeObjectResources( model.root );
		}
	} );

	test( 'returns the baked Greeting track that poses the authored paw through AnimationMixer', async () => {
		serveMascot( new Response( mascotFixture() ) );
		const model = await loadMascotModel( new AbortController().signal );
		const mixer = new AnimationMixer( model.root );
		try {
			const paw = model.root.getObjectByName( 'WavingPaw' );
			if ( ! paw ) {
				throw new Error( 'Expected the authored animation target.' );
			}
			expect( model.clip.name ).toBe( 'Greeting' );
			mixer.clipAction( model.clip ).setLoop( LoopOnce, 1 ).play();
			mixer.setTime( 0.5 );
			const direction = new Vector3( 1, 0, 0 ).applyQuaternion( paw.quaternion );
			expect( direction.x ).toBeCloseTo( 0 );
			expect( direction.y ).toBeCloseTo( 1 );
			expect( direction.z ).toBeCloseTo( 0 );
			mixer.setTime( 0 );
			expect( paw.quaternion.toArray() ).toEqual( [ 0, 0, 0, 1 ] );
		} finally {
			mixer.stopAllAction();
			mixer.uncacheRoot( model.root );
			disposeObjectResources( model.root );
		}
	} );

	test( 'rejects an unsuccessful asset response even when its body is a valid model', async () => {
		serveMascot( new Response( mascotFixture(), { status: 503 } ) );
		await expect( loadMascotModel( new AbortController().signal ) ).rejects.toThrow( /503/ );
	} );

	test.each( [
		{ missing: 'mesh', hasMesh: false, animationName: 'Greeting' },
		{ missing: 'Greeting animation', hasMesh: true, animationName: 'Idle' },
	] )( 'rejects an asset missing its $missing', async ( { hasMesh, animationName } ) => {
		serveMascot( new Response( mascotFixture( hasMesh, animationName ) ) );
		await expect( loadMascotModel( new AbortController().signal ) ).rejects.toThrow( /mesh or greeting/i );
	} );

	test( 'rejects a model that requires a separate network resource', async () => {
		serveMascot( new Response( mascotFixture( true, 'Greeting', 'https://example.com/mascot.bin' ) ) );
		await expect( loadMascotModel( new AbortController().signal ) ).rejects.toThrow( /own resources/i );
	} );

	test( 'never returns a usable model when its request was already aborted', async () => {
		serveMascot( new Response( mascotFixture() ) );
		const controller = new AbortController();
		controller.abort();
		await expect( loadMascotModel( controller.signal ) ).rejects.toMatchObject( { name: 'AbortError' } );
	} );

	test( 'discards response bytes that finish arriving after cancellation', async () => {
		const body = new TransformStream<Uint8Array, Uint8Array>();
		serveMascot( new Response( body.readable ) );
		const controller = new AbortController();
		const loading = loadMascotModel( controller.signal );
		const rejected = expect( loading ).rejects.toMatchObject( { name: 'AbortError' } );
		const writer = body.writable.getWriter();
		await writer.write( new Uint8Array( mascotFixture() ) );
		controller.abort();
		await writer.close();
		await rejected;
	} );
} );

describe( 'disposing imported mascot resources', () => {
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
