import {
	ACESFilmicToneMapping, AnimationMixer, BufferAttribute, BufferGeometry, DirectionalLight,
	InterleavedBufferAttribute, Mesh,
	type Object3D, PCFSoftShadowMap, PerspectiveCamera,
	Plane, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { disposeObjectResources } from '../mascot-scene/model';
import { cameraPosition, pointerYaw } from './camera';
import { createEnvironment } from './environment';
import { createHeadMotion } from './head-motion';
import { loadRiversideModel } from './model';
import { createSipHeadFollow } from './sip-head-follow';
import {
	HeroCamera, HeroStatus, WaterMotion,
	type HeroController, type HeroHeadMotion, type HeroListener, type HeroSipFollow, type RiversideModel,
} from './types';

/**
 * Owns the bounded camera, local animation, water interaction and GPU lifecycle.
 * @param canvas - Dedicated background canvas.
 * @param onStatus - Reports availability to the image fallback.
 * @return A disposal boundary for the mounted hero.
 * @since 0.1.0
 */
export function createRiversideHero( canvas: HTMLCanvasElement, onStatus: HeroListener ): HeroController {
	const renderer = new WebGLRenderer( { canvas, antialias: true, powerPreference: 'low-power' } );
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	const scene = new Scene();
	const camera = new PerspectiveCamera( HeroCamera.FOV, 1, 0.1, 1400 );
	const environment = createEnvironment();
	scene.add( ...environment.objects );
	const abort = new AbortController();
	const hero = canvas.closest<HTMLElement>( '.hero' ) ?? canvas;
	let disposed = false;
	let inView = true;
	let cached = false;
	let running = false;
	let frame = 0;
	let request = 0;
	let previous = 0;
	let elapsed = 0;
	let yaw = 0;
	let targetYaw = 0;
	let model: RiversideModel | undefined;
	let mixer: AnimationMixer | undefined;
	let head: HeroHeadMotion | undefined;
	let sipFollow: HeroSipFollow | undefined;
	let ripple = 0;
	const pointer = new Vector2();
	const raycaster = new Raycaster();
	const waterPlane = new Plane( new Vector3( 0, 1, 0 ), -WaterMotion.BASE_HEIGHT );
	const hit = new Vector3();
	const plants: Object3D[] = [];
	const plantRotations: number[] = [];

	/** Draws the scene and exposes inexpensive diagnostics for browser verification. */
	function render(): void {
		if ( disposed || ! model ) {
			return;
		}
		const position = cameraPosition( yaw );
		camera.position.set( position.x, position.y, position.z );
		camera.lookAt( 0, HeroCamera.TARGET_HEIGHT, 0 );
		renderer.render( scene, camera );
		canvas.dataset.frame = String( ++frame );
		canvas.dataset.yaw = String( yaw );
		canvas.dataset.cameraHeight = String( camera.position.y );
		if ( frame % 30 === 1 ) {
			canvas.dataset.triangles = String( renderer.info.render.triangles );
			canvas.dataset.drawCalls = String( renderer.info.render.calls );
		}
	}

	/**
	 * Advances only visible time; easing never changes the camera elevation.
	 * @param now - Browser animation frame timestamp.
	 */
	function tick( now: number ): void {
		if ( ! running || disposed ) {
			return;
		}
		const wallDelta = previous ? ( now - previous ) / 1000 : 0;
		const dt = Math.min( wallDelta, 0.25 );
		previous = now;
		elapsed += dt;
		yaw += ( targetYaw - yaw ) * ( 1 - Math.exp( -wallDelta * 4 ) );
		mixer?.update( dt );
		canvas.dataset.animationTime = String( mixer?.time ?? 0 );
		const headYaw = head?.update( yaw ) ?? 0;
		sipFollow?.update( headYaw );
		canvas.dataset.headYaw = String( headYaw );
		environment.time.value = elapsed;
		plants.forEach( ( plant, index ) => {
			plant.rotation.z = ( plantRotations[ index ] ?? 0 ) + Math.sin( elapsed * 1.6 + index * 1.9 ) * 0.004;
		} );
		render();
		request = requestAnimationFrame( tick );
	}

	/** Stops all rendering when hidden, offscreen, or in the browser page cache. */
	function synchronize(): void {
		if ( disposed ) {
			return;
		}
		cancelAnimationFrame( request );
		previous = 0;
		running = Boolean( model ) && inView && ! cached && document.visibilityState === 'visible';
		canvas.dataset.playing = String( running );
		if ( running ) {
			request = requestAnimationFrame( tick );
		}
	}

	/** Maintains the same vertical composition across responsive viewport widths. */
	function resize(): void {
		if ( disposed ) {
			return;
		}
		const width = Math.max( 1, canvas.clientWidth );
		const height = Math.max( 1, canvas.clientHeight );
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio( Math.min( devicePixelRatio, width < 700 ? 1 : 1.5 ) );
		renderer.setSize( width, height, false );
		render();
	}

	/**
	 * Maps horizontal movement over the whole hero, including its text overlay.
	 * @param event - Browser input or lifecycle event.
	 */
	function movePointer( event: PointerEvent ): void {
		if ( event.pointerType === 'touch' || ! running ) {
			return;
		}
		const bounds = hero.getBoundingClientRect();
		targetYaw = pointerYaw( event.clientX, bounds.left, bounds.width );
	}

	/** Returns gently to the centered rear view when the pointer leaves. */
	function leavePointer(): void {
		targetYaw = 0;
	}

	/**
	 * Adds a bounded ripple only when the nearest visible surface is water.
	 * @param event - Browser input or lifecycle event.
	 */
	function addRipple( event: PointerEvent ): void {
		if ( ! running || ( event.target instanceof Element && event.target.closest( 'a,button' ) ) ) {
			return;
		}
		const bounds = hero.getBoundingClientRect();
		pointer.set(
			( event.clientX - bounds.left ) / bounds.width * 2 - 1,
			-( event.clientY - bounds.top ) / bounds.height * 2 + 1,
		);
		raycaster.setFromCamera( pointer, camera );
		if ( ! raycaster.ray.intersectPlane( waterPlane, hit ) ) {
			return;
		}
		const shore = 1.5 + 0.08 * hit.x + 0.8 * Math.sin( 0.17 * hit.x ) + 0.12 * Math.sin( 0.65 * hit.x );
		if ( -hit.z < shore - 0.6 ) {
			return;
		}
		const obstruction = model ? raycaster.intersectObject( model.root, true )[ 0 ] : undefined;
		if ( obstruction && obstruction.distance < camera.position.distanceTo( hit ) ) {
			return;
		}
		const ripples = environment.ripples;
		ripples[ ripple % ripples.length ]?.set( hit.x, hit.z, elapsed, 1 );
		canvas.dataset.ripples = String( ++ripple );
	}

	/**
	 * Suspends the scene across history caching without retaining abandoned pages.
	 * @param event - Browser input or lifecycle event.
	 */
	function hidePage( event: PageTransitionEvent ): void {
		if ( event.persisted ) {
			cached = true; synchronize();
		} else {
			dispose();
		}
	}

	/** Resumes a restored history entry. */
	function showPage(): void {
		cached = false; synchronize();
	}

	/**
	 * Restores the static poster if the GPU context is lost.
	 * @param event - Browser input or lifecycle event.
	 */
	function loseContext( event: Event ): void {
		event.preventDefault();
		dispose();
		onStatus( HeroStatus.UNAVAILABLE );
	}

	const resizeObserver = new ResizeObserver( resize );
	const visibility = new IntersectionObserver( ( entries ) => {
		inView = entries.some( ( entry ) => entry.isIntersecting );
		synchronize();
	}, { threshold: 0.01 } );

	/** Releases animation, observers, network work and all owned graphics resources. */
	function dispose(): void {
		if ( disposed ) {
			return;
		}
		disposed = true;
		running = false;
		canvas.dataset.playing = 'false';
		abort.abort();
		cancelAnimationFrame( request );
		resizeObserver.disconnect();
		visibility.disconnect();
		hero.removeEventListener( 'pointermove', movePointer );
		hero.removeEventListener( 'pointerleave', leavePointer );
		hero.removeEventListener( 'pointerdown', addRipple );
		document.removeEventListener( 'visibilitychange', synchronize );
		window.removeEventListener( 'pagehide', hidePage );
		window.removeEventListener( 'pageshow', showPage );
		canvas.removeEventListener( 'webglcontextlost', loseContext );
		mixer?.stopAllAction();
		sipFollow?.dispose();
		head?.dispose();
		if ( model ) {
			mixer?.uncacheRoot( model.root );
		}
		scene.traverse( ( object ) => {
			if ( object instanceof DirectionalLight ) {
				object.shadow.dispose();
			}
		} );
		disposeObjectResources( scene );
		scene.clear();
		renderer.dispose();
	}

	resizeObserver.observe( canvas );
	visibility.observe( hero );
	hero.addEventListener( 'pointermove', movePointer, { passive: true } );
	hero.addEventListener( 'pointerleave', leavePointer );
	hero.addEventListener( 'pointerdown', addRipple, { passive: true } );
	document.addEventListener( 'visibilitychange', synchronize );
	window.addEventListener( 'pagehide', hidePage );
	window.addEventListener( 'pageshow', showPage );
	canvas.addEventListener( 'webglcontextlost', loseContext );
	resize();
	void loadRiversideModel( abort.signal ).then( ( loaded ) => {
		if ( disposed ) {
			disposeObjectResources( loaded.root ); return;
		}
		model = loaded;
		head = createHeadMotion( model.root );
		sipFollow = createSipHeadFollow( model.root );
		canvas.dataset.headYaw = String( head.update( 0 ) );
		scene.add( model.root );
		mixer = new AnimationMixer( model.root );
		for ( const clip of model.clips ) {
			mixer.clipAction( clip ).play();
		}
		model.root.traverse( ( object ) => {
			if ( object instanceof Mesh && /plant|vegetation/i.test( object.name ) ) {
				plants.push( object );
				plantRotations.push( object.rotation.z );
			}
		} );
		let geometryTriangles = 0;
		scene.traverse( ( object ) => {
			if ( object instanceof Mesh ) {
				const geometry: unknown = object.geometry;
				if ( geometry instanceof BufferGeometry ) {
					const attribute: unknown = geometry.index ?? geometry.getAttribute( 'position' );
					if ( attribute instanceof BufferAttribute || attribute instanceof InterleavedBufferAttribute ) {
						geometryTriangles += attribute.count / 3;
					}
				}
			}
		} );
		canvas.dataset.geometryTriangles = String( geometryTriangles );
		render();
		onStatus( HeroStatus.READY );
		synchronize();
	} ).catch( () => {
		if ( ! disposed ) {
			dispose(); onStatus( HeroStatus.UNAVAILABLE );
		}
	} );
	return { dispose };
}
