import {
	Color, DataTexture, Float32BufferAttribute, LinearFilter, MathUtils, MeshPhysicalMaterial,
	RepeatWrapping, RGBAFormat, SRGBColorSpace, Vector2, type BufferGeometry,
} from 'three';

/**
 * Soft elliptical pigment mask in the original mesh's front coordinates.
 * @param x - Horizontal coordinate.
 * @param y - Vertical coordinate.
 * @param cx - Mask center.
 * @param cy - Mask center.
 * @param rx - Horizontal radius.
 * @param ry - Vertical radius.
 * @return Smooth coverage, leaving the actual sculpted shape intact.
 */
function ellipse( x: number, y: number, cx: number, cy: number, rx: number, ry: number ): number {
	return 1 - MathUtils.smoothstep( Math.hypot( ( x - cx ) / rx, ( y - cy ) / ry ), 0.88, 1.08 );
}

/**
 * Locates the two existing eye bulges, not replacement geometry.
 * @param x - Original horizontal coordinate.
 * @param y - Original vertical coordinate.
 * @param z - Original depth.
 * @return Coverage of glossy eye pigment.
 */
function eyeCoverage( x: number, y: number, z: number ): number {
	return Math.max( ellipse( x, y, -0.255, 0.586, 0.051, 0.065 ),
		ellipse( x, y, 0.303, 0.606, 0.054, 0.059 ) ) * MathUtils.smoothstep( z, 0.20, 0.25 );
}

/**
 * Builds deterministic embedded color and normal grain textures; no network or raster source is used.
 * @return Repeatable color and normal grain textures for the clay material.
 */
function clayTextures() {
	const size = 128;
	const noise = new Float32Array( size * size );
	let seed = 1429;
	for ( let i = 0; i < noise.length; i++ ) {
		seed = ( Math.imul( 1664525, seed ) + 1013904223 ) >>> 0;
		noise[ i ] = seed / 4294967295;
	}
	const color = new Uint8Array( size * size * 4 );
	const normal = new Uint8Array( color.length );
	for ( let y = 0; y < size; y++ ) {
		for ( let x = 0; x < size; x++ ) {
			const index = y * size + x;
			const offset = index * 4;
			const grain = noise[ index ] ?? 0;
			const horizontalGrain = noise[ y * size + ( x + 1 ) % size ] ?? grain;
			const verticalGrain = noise[ ( ( y + 1 ) % size ) * size + x ] ?? grain;
			color.fill( Math.round( 246 + grain * 9 ), offset, offset + 3 );
			color[ offset + 3 ] = 255;
			normal[ offset ] = Math.round( 128 + ( horizontalGrain - grain ) * 45 );
			normal[ offset + 1 ] = Math.round( 128 + ( verticalGrain - grain ) * 45 );
			normal[ offset + 2 ] = 255;
			normal[ offset + 3 ] = 255;
		}
	}
	const map = new DataTexture( color, size, size, RGBAFormat );
	const normalMap = new DataTexture( normal, size, size, RGBAFormat );
	map.name = 'Embedded clay color grain';
	map.colorSpace = SRGBColorSpace;
	normalMap.name = 'Embedded clay normal grain';
	for ( const texture of [ map, normalMap ] ) {
		texture.wrapS = RepeatWrapping;
		texture.wrapT = RepeatWrapping;
		texture.magFilter = LinearFilter;
		texture.minFilter = LinearFilter;
		texture.needsUpdate = true;
	}
	return { map, normalMap };
}

/**
 * Paints existing features with portable vertex colors and embedded PBR textures.
 * @param geometry - Original indexed geometry, owned by the authoring operation.
 * @return Clay and glossy-eye materials; two draw groups keep rendering inexpensive.
 * @since 0.1.0
 */
export function paintMascot( geometry: BufferGeometry ): MeshPhysicalMaterial[] {
	const positions = geometry.getAttribute( 'position' );
	const colors = new Float32Array( positions.count * 3 );
	const uvs = new Float32Array( positions.count * 2 );
	const honey = new Color( '#eea450' );
	const brown = new Color( '#a47548' );
	const black = new Color( '#17130f' );
	const color = new Color();
	for ( let i = 0; i < positions.count; i++ ) {
		const x = positions.getX( i );
		const y = positions.getY( i );
		const z = positions.getZ( i );
		const muzzle = ellipse( x, y, 0.038, 0.419, 0.235, 0.248 ) * MathUtils.smoothstep( z, 0.245, 0.33 );
		const brows = Math.max( ellipse( x, y, -0.280, 0.770, 0.064, 0.032 ),
			ellipse( x, y, 0.323, 0.784, 0.070, 0.031 ) ) * MathUtils.smoothstep( z, 0.09, 0.14 );
		const ears = Math.max( ellipse( x, y, -0.333, 0.867, 0.09, 0.10 ),
			ellipse( x, y, 0.378, 0.879, 0.10, 0.105 ) ) * ( 1 - MathUtils.smoothstep( z, -0.08, 0.02 ) );
		const feet = 1 - MathUtils.smoothstep( y, -0.914, -0.878 );
		const wavePaw = MathUtils.smoothstep( y - 0.52 * x, 0.478, 0.505 ) *
			( 1 - MathUtils.smoothstep( x, -0.51, -0.475 ) );
		const restingPaw = ( 1 - MathUtils.smoothstep( y, -0.432, -0.399 ) ) * MathUtils.smoothstep( x, 0.48, 0.54 );
		color.copy( honey ).lerp( brown, Math.max( muzzle, brows, ears, feet, wavePaw, restingPaw ) );
		color.lerp( black, eyeCoverage( x, y, z ) );
		color.toArray( colors, i * 3 );
		// Repeating grain needs no externally painted atlas; the fine cylindrical seam stays on the back.
		uvs[ i * 2 ] = ( Math.atan2( x - 0.02, z ) / ( 2 * Math.PI ) + 0.5 ) * 12;
		uvs[ i * 2 + 1 ] = ( y + 1.01 ) * 6;
	}
	geometry.setAttribute( 'color', new Float32BufferAttribute( colors, 3 ) );
	geometry.setAttribute( 'uv', new Float32BufferAttribute( uvs, 2 ) );
	const clay: number[] = [];
	const eyes: number[] = [];
	const index = geometry.index;
	if ( index === null ) {
		throw new Error( 'The supplied mascot must retain its indexed triangles.' );
	}
	for ( let face = 0; face < index.count; face += 3 ) {
		const vertices = [ index.getX( face ), index.getX( face + 1 ), index.getX( face + 2 ) ];
		const coverage = vertices.reduce( ( total, vertex ) => total + eyeCoverage(
			positions.getX( vertex ), positions.getY( vertex ), positions.getZ( vertex ),
		), 0 ) / 3;
		( coverage > 0.5 ? eyes : clay ).push( ...vertices );
	}
	geometry.setIndex( [ ...clay, ...eyes ] );
	geometry.clearGroups();
	geometry.addGroup( 0, clay.length, 0 );
	geometry.addGroup( clay.length, eyes.length, 1 );
	return [
		new MeshPhysicalMaterial( { name: 'Honey clay and warm brown details', vertexColors: true,
			...clayTextures(), normalScale: new Vector2( 0.45, 0.45 ), roughness: 0.87, metalness: 0,
			sheen: 0.12, sheenColor: '#ffe6b8', sheenRoughness: 0.85 } ),
		new MeshPhysicalMaterial( { name: 'Polished dark eyes', vertexColors: true,
			roughness: 0.18, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.1 } ),
	];
}
