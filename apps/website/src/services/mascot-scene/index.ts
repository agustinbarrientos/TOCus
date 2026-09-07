import {
	ACESFilmicToneMapping, AnimationMixer, Color, DirectionalLight, DoubleSide, HemisphereLight,
	LoopOnce, LoopRepeat, Mesh, MeshBasicMaterial, OrthographicCamera, PCFSoftShadowMap,
	PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial, SRGBColorSpace, WebGLRenderer, type AnimationAction,
} from 'three';
import { disposeObjectResources, loadMascotModel } from './model';
import {
	MascotSceneStatus, type MascotModel, type MascotSceneController, type MascotSceneListener, type MascotSceneOptions,
} from './types';

/**
 * Supplies a single broad reflection panel for calm, smooth black eyes.
 * @return A locally authored studio reflection environment.
 */
function createStudioEnvironment(): Scene {
	const studio = new Scene();
	studio.background = new Color( '#454545' );
	const panel = new Mesh(
		new PlaneGeometry( 3.5, 4.5 ),
		new MeshBasicMaterial( { color: new Color( 4, 4, 4 ), side: DoubleSide } ),
	);
	panel.position.set( -3.5, 5, 4 );
	panel.lookAt( 0, 2, 0 );
	studio.add( panel );
	return studio;
}

/**
 * Owns an abortable GLB load and a disposable studio scene for the supplied mascot.
 * @param canvas - Dedicated mascot canvas.
 * @param onState - Reports loading, availability and animation state to the owner.
 * @param options - Background and playback choices for the homepage or lab.
 * @return Pause, view and disposal operations for the owning component.
 * @since 0.1.0
 */
export function createMascotScene(
	canvas: HTMLCanvasElement, onState: MascotSceneListener, options: MascotSceneOptions = {},
): MascotSceneController {
	const renderer = new WebGLRenderer( { canvas, antialias: true, alpha: options.transparent ?? false, powerPreference: 'low-power' } );
	renderer.outputColorSpace = SRGBColorSpace;
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
	const scene = new Scene();
	scene.background = options.transparent ? null : new Color( '#fff0d8' );
	const camera = new OrthographicCamera( -2, 2, 2.5, -2.5, 0.1, 50 );
	camera.position.set( -0.08, 2.65, 10 );
	camera.lookAt( -0.08, 2.13, 0 );
	const room = createStudioEnvironment();
	const generator = new PMREMGenerator( renderer );
	const environment = generator.fromScene( room, 0.05 );
	scene.environment = environment.texture;
	scene.environmentIntensity = 0.38;
	disposeObjectResources( room );
	generator.dispose();
	const load = new AbortController();
	let model: MascotModel | null = null;
	let mixer: AnimationMixer | null = null;
	let animation: AnimationAction | null = null;
	let status: MascotSceneStatus = MascotSceneStatus.LOADING;
	const floor = new Mesh(
		new PlaneGeometry( 200, 200 ), new ShadowMaterial( { color: '#684322', opacity: 0.15 } ),
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -0.005;
	floor.receiveShadow = true;
	scene.add( floor );
	scene.add( new HemisphereLight( '#fff7e8', '#a57c4d', 0.7 ) );
	const key = new DirectionalLight( '#fff5e6', 1.8 );
	key.position.set( -3.5, 7, 5 );
	key.castShadow = true;
	key.shadow.mapSize.set( 1024, 1024 );
	key.shadow.camera.left = -3.2;
	key.shadow.camera.right = 3.2;
	key.shadow.camera.top = 5;
	key.shadow.camera.bottom = -1;
	key.shadow.normalBias = 0.018;
	key.shadow.bias = -0.0002;
	key.shadow.radius = 5;
	key.target.position.set( 0, 2, 0 );
	scene.add( key, key.target );
	const fill = new DirectionalLight( '#fff0dd', 0.45 );
	fill.position.set( 4, 3, 5 );
	scene.add( fill );
	const rim = new DirectionalLight( '#ffe1a9', 0.7 );
	rim.position.set( 2, 5, -4 );
	scene.add( rim );
	const motion = matchMedia( '(prefers-reduced-motion: reduce)' );
	let paused = motion.matches;
	let inView = true;
	let cached = false;
	let running = false;
	let disposed = false;
	let request = 0;
	let previous = 0;
	let frame = 0;
	let view = 0;

	/** Draws a single deterministic pose without advancing the clock. */
	function render(): void {
		if ( disposed || ! model ) {
			return;
		}
		model.root.rotation.y = view;
		renderer.render( scene, camera );
		canvas.dataset.frame = String( ++frame );
	}

	/**
	 * Advances animation only for time spent visible and explicitly running.
	 * @param now - Animation-frame timestamp.
	 */
	function tick( now: number ): void {
		if ( ! running || disposed ) {
			return;
		}
		if ( previous > 0 ) {
			mixer?.update( Math.min( ( now - previous ) / 1000, 0.05 ) );
		}
		previous = now;
		render();
		if ( ! paused ) {
			request = requestAnimationFrame( tick );
		}
	}

	/** Synchronizes the requested animation with viewport and document visibility. */
	function synchronize(): void {
		if ( disposed ) {
			return;
		}
		cancelAnimationFrame( request );
		previous = 0;
		running = status === MascotSceneStatus.READY && ! paused && ! cached && inView && document.visibilityState === 'visible';
		canvas.dataset.still = String( ! running );
		canvas.dataset.status = status;
		onState( { status, paused, running } );
		if ( running ) {
			request = requestAnimationFrame( tick );
		}
	}

	/** Stops the homepage frame loop once the baked greeting reaches its settled pose. */
	function finishGreeting(): void {
		paused = true;
		synchronize();
	}

	/** Fits both upright character and raised paw within narrow comparison panels. */
	function resize(): void {
		if ( disposed ) {
			return;
		}
		const width = Math.max( 1, canvas.clientWidth );
		const height = Math.max( 1, canvas.clientHeight );
		const aspect = width / height;
		const halfHeight = Math.max( 2.44, 1.79 / aspect );
		camera.left = -halfHeight * aspect;
		camera.right = halfHeight * aspect;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
		camera.updateProjectionMatrix();
		renderer.setSize( width, height, false );
		render();
	}

	/** Honors a newly enabled reduced-motion preference immediately. */
	function updateMotionPreference(): void {
		if ( motion.matches ) {
			paused = true;
		}
		synchronize();
	}

	/**
	 * Suspends a cached document and releases a document that is leaving permanently.
	 * @param event - Browser page transition with the back/forward cache flag.
	 */
	function hidePage( event: PageTransitionEvent ): void {
		if ( event.persisted ) {
			cached = true;
			synchronize();
		} else {
			dispose();
		}
	}

	/** Resumes the existing scene after restoration from the browser's page cache. */
	function showPage(): void {
		cached = false;
		synchronize();
	}

	const resizeObserver = new ResizeObserver( resize );
	const intersection = new IntersectionObserver( ( entries ) => {
		inView = entries.some( ( entry ) => entry.isIntersecting );
		synchronize();
	}, { threshold: 0.05 } );

	/** Releases observers, callbacks and all owned WebGL resources. */
	function dispose(): void {
		if ( disposed ) {
			return;
		}
		disposed = true;
		running = false;
		load.abort();
		cancelAnimationFrame( request );
		resizeObserver.disconnect();
		intersection.disconnect();
		motion.removeEventListener( 'change', updateMotionPreference );
		document.removeEventListener( 'visibilitychange', synchronize );
		window.removeEventListener( 'pagehide', hidePage );
		window.removeEventListener( 'pageshow', showPage );
		canvas.removeEventListener( 'webglcontextlost', loseContext );
		mixer?.removeEventListener( 'finished', finishGreeting );
		mixer?.stopAllAction();
		if ( model ) {
			mixer?.uncacheRoot( model.root );
		}
		disposeObjectResources( scene );
		scene.clear();
		scene.environment = null;
		model = null;
		mixer = null;
		animation = null;
		key.shadow.dispose();
		environment.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
		status = MascotSceneStatus.DISPOSED;
		canvas.dataset.status = MascotSceneStatus.DISPOSED;
		canvas.dataset.still = 'true';
		onState( { status: MascotSceneStatus.DISPOSED, paused: true, running: false } );
	}

	/**
	 * Leaves a clear static-reference fallback after loss of the GPU context.
	 * @param event - Browser WebGL context-loss event.
	 */
	function loseContext( event: Event ): void {
		event.preventDefault();
		unavailable();
	}

	/** Restores the owner's image fallback when loading or rendering is unavailable. */
	function unavailable(): void {
		dispose();
		status = MascotSceneStatus.UNAVAILABLE;
		canvas.dataset.status = MascotSceneStatus.UNAVAILABLE;
		onState( { status: MascotSceneStatus.UNAVAILABLE, paused: true, running: false } );
	}

	resizeObserver.observe( canvas );
	intersection.observe( canvas );
	motion.addEventListener( 'change', updateMotionPreference );
	document.addEventListener( 'visibilitychange', synchronize );
	window.addEventListener( 'pagehide', hidePage );
	window.addEventListener( 'pageshow', showPage );
	canvas.addEventListener( 'webglcontextlost', loseContext );
	resize();
	synchronize();
	void loadMascotModel( load.signal ).then( ( loaded ) => {
		if ( disposed ) {
			disposeObjectResources( loaded.root );
			return;
		}
		model = loaded;
		scene.add( model.root );
		mixer = new AnimationMixer( model.root );
		animation = mixer.clipAction( model.clip );
		animation.setLoop( options.loop ? LoopRepeat : LoopOnce, options.loop ? Infinity : 1 );
		animation.clampWhenFinished = true;
		animation.play();
		mixer.update( 0 );
		mixer.addEventListener( 'finished', finishGreeting );
		canvas.dataset.animation = model.clip.name;
		status = MascotSceneStatus.READY;
		render();
		synchronize();
	} ).catch( () => {
		if ( ! disposed ) {
			unavailable();
		}
	} );
	return {
		/**
		 * Pauses or resumes by explicit user request.
		 * @param value - Requested pause state.
		 */
		setPaused( value ) {
			if ( disposed ) {
				return;
			}
			if ( ! value && animation && ! animation.isRunning() ) {
				animation.reset().play();
			}
			paused = value;
			synchronize();
		},
		/**
		 * Turns the real model for inspecting its depth, including while paused.
		 * @param degrees - View angle limited to the comparison slider's range.
		 */
		setViewDegrees( degrees ) {
			view = Math.max( -55, Math.min( 55, degrees ) ) * Math.PI / 180;
			render();
		},
		dispose,
	};
}
