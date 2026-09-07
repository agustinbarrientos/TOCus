import {
	AnimationClip, Bone, Float32BufferAttribute, MathUtils, Quaternion, QuaternionKeyframeTrack,
	Uint16BufferAttribute, Vector3, type BufferGeometry,
} from 'three';
import { MascotJoint, type MascotRig } from './types';

/**
 * Finds only the raised appendage through mesh connectivity, avoiding the nearby cheek.
 * @param geometry - Indexed source mesh before export.
 * @return Vertices reachable from the palm without crossing the shoulder boundary.
 */
function raisedArm( geometry: BufferGeometry ): Set<number> {
	const positions = geometry.getAttribute( 'position' );
	const adjacency = Array.from( { length: positions.count }, () => new Set<number>() );
	const index = geometry.index;
	if ( index === null ) {
		throw new Error( 'Rigging requires indexed source topology.' );
	}
	for ( let face = 0; face < index.count; face += 3 ) {
		const a = index.getX( face );
		const b = index.getX( face + 1 );
		const c = index.getX( face + 2 );
		const neighborsA = adjacency[ a ];
		const neighborsB = adjacency[ b ];
		const neighborsC = adjacency[ c ];
		if ( neighborsA === undefined || neighborsB === undefined || neighborsC === undefined ) {
			throw new Error( 'The source topology references a missing vertex.' );
		}
		neighborsA.add( b ).add( c );
		neighborsB.add( a ).add( c );
		neighborsC.add( a ).add( b );
	}
	let seed = 0;
	let nearest = Infinity;
	for ( let vertex = 0; vertex < positions.count; vertex++ ) {
		const distance = ( positions.getX( vertex ) + 0.62 ) ** 2 +
			( positions.getY( vertex ) - 0.25 ) ** 2 + ( positions.getZ( vertex ) - 0.147 ) ** 2;
		if ( distance < nearest ) {
			nearest = distance; seed = vertex;
		}
	}
	const result = new Set<number>( [ seed ] );
	const queue = [ seed ];
	for ( const current of queue ) {
		const neighbors = adjacency[ current ];
		if ( neighbors === undefined ) {
			throw new Error( 'The source topology contains no reachable palm vertex.' );
		}
		for ( const vertex of neighbors ) {
			const x = positions.getX( vertex ); const y = positions.getY( vertex );
			if ( ! result.has( vertex ) && x < -0.435 && y > -0.20 && y < 0.445 ) {
				result.add( vertex ); queue.push( vertex );
			}
		}
	}
	return result;
}

/**
 * Adds normalized smooth arm weights and a short greeting, preserving the original raised bind pose.
 * @param geometry - Geometry whose positions remain untouched.
 * @return Ordered bones and a deterministic six-second greeting clip.
 * @since 0.1.0
 */
export function rigMascot( geometry: BufferGeometry ): MascotRig {
	const root = new Bone(); root.name = MascotJoint.ROOT;
	const shoulder = new Bone(); shoulder.name = MascotJoint.SHOULDER;
	shoulder.position.set( -0.425, -0.09, -0.0572 ); root.add( shoulder );
	const elbow = new Bone(); elbow.name = MascotJoint.ELBOW;
	elbow.position.set( -0.115, 0.105, 0.0557 ); shoulder.add( elbow );
	const wrist = new Bone(); wrist.name = MascotJoint.WRIST;
	wrist.position.set( -0.05, 0.165, 0.0583 ); elbow.add( wrist );
	const bones: MascotRig['bones'] = [ root, shoulder, elbow, wrist ];
	const positions = geometry.getAttribute( 'position' );
	const members = raisedArm( geometry );
	const indices = new Uint16Array( positions.count * 4 );
	const weights = new Float32Array( positions.count * 4 );
	for ( let vertex = 0; vertex < positions.count; vertex++ ) {
		const x = positions.getX( vertex ); const y = positions.getY( vertex );
		const arm = members.has( vertex ) ? MathUtils.smoothstep( -x, 0.435, 0.55 ) : 0;
		const forearm = MathUtils.smoothstep( y, 0.005, 0.13 );
		const paw = MathUtils.smoothstep( y, 0.155, 0.25 );
		indices.set( [ 0, 1, 2, 3 ], vertex * 4 );
		weights.set( [ 1 - arm, arm * ( 1 - forearm ), arm * forearm * ( 1 - paw ), arm * forearm * paw ], vertex * 4 );
	}
	geometry.setAttribute( 'skinIndex', new Uint16BufferAttribute( indices, 4 ) );
	geometry.setAttribute( 'skinWeight', new Float32BufferAttribute( weights, 4 ) );
	const times = Array.from( { length: 121 }, ( _, index ) => index / 20 );
	const axis = new Vector3( 0, 0, 1 );
	const tracks = [ [ shoulder, 0.018 ], [ elbow, 0.04 ], [ wrist, 0.11 ] ] as const;
	const animation = tracks.map( ( [ bone, amplitude ] ) => {
		const values = times.flatMap( ( seconds ) => {
			const envelope = MathUtils.smoothstep( seconds, 0.15, 0.8 ) *
				( 1 - MathUtils.smoothstep( seconds, 3.6, 4.6 ) );
			return new Quaternion()
				.setFromAxisAngle( axis, Math.sin( seconds * 5.6 ) * amplitude * envelope ).toArray();
		} );
		return new QuaternionKeyframeTrack( `${ bone.name }.quaternion`, times, values );
	} );
	return { bones, clip: new AnimationClip( 'Greeting', 6, animation ) };
}
