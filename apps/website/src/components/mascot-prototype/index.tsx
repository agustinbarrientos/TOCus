import { Button, Slider, TocusAppearance, TocusProvider } from '@tocus/ui';
import { useEffect, useRef, useState } from 'react';
import {
	MascotSceneStatus, type MascotSceneController, type MascotSceneState,
} from '../../services/mascot-scene/types';
import './style.scss';

/**
 * Presents the experimental real 3D mascot next to the supplied reference image.
 * @return A local, accessible comparison with explicit motion and view controls.
 * @since 0.1.0
 */
export function MascotPrototype() {
	const canvas = useRef<HTMLCanvasElement>( null );
	const controller = useRef<MascotSceneController | null>( null );
	const [ state, setState ] = useState<MascotSceneState | null>( null );
	const [ angle, setAngle ] = useState( 0 );
	useEffect( () => {
		let active = true;
		void import( '../../services/mascot-scene' ).then( ( { createMascotScene } ) => {
			if ( ! active || ! canvas.current ) {
				return;
			}
			controller.current = createMascotScene( canvas.current, ( next ) => {
				if ( active ) {
					setState( next );
				}
			}, { loop: true } );
		} ).catch( () => {
			if ( active ) {
				setState( { status: MascotSceneStatus.UNAVAILABLE, paused: true, running: false } );
			}
		} );
		return () => {
			active = false;
			controller.current?.dispose();
			controller.current = null;
		};
	}, [] );
	const ready = state?.status === MascotSceneStatus.READY;
	const unavailable = state?.status === MascotSceneStatus.UNAVAILABLE;
	return <TocusProvider appearance={TocusAppearance.LIGHT} transparent>
		<main className="mascot-lab">
			<header className="mascot-lab-intro">
				<a href="/" className="mascot-lab-back">TOCus</a>
				<h1>Mascot, in three dimensions.</h1>
				<p>3D prototype beside your supplied reference.
					Pause the wave, then turn the model to compare its shape.</p>
			</header>
			<div className="mascot-lab-comparison">
				<section className="mascot-prototype" aria-labelledby="prototype-heading">
					<div className="mascot-lab-panel-heading">
						<h2 id="prototype-heading">3D prototype</h2>
						<span>Live geometry</span>
					</div>
					<div className="mascot-prototype-stage">
						<canvas ref={canvas} role="img" aria-label="Interactive 3D capybara prototype"
							aria-describedby="prototype-description" />
						{! ready && <p className="mascot-prototype-status" role="status">
							{unavailable
								? '3D is unavailable in this browser. The reference remains visible.'
								: 'Preparing the 3D prototype...'}
						</p>}
					</div>
					<div className="mascot-prototype-controls">
						<Button variant="default" disabled={! ready}
							onClick={() => controller.current?.setPaused( ! state?.paused )}>
							{state?.paused ? 'Play animation' : 'Pause animation'}
						</Button>
						<div className="mascot-prototype-turn">
							<div className="mascot-prototype-turn-label"><span>Turn the model</span><span>{angle}&deg;</span></div>
							<Slider thumbLabel="Turn the 3D model" min={-55} max={55} step={1} value={angle}
								disabled={! ready} label={null} onChange={( degrees ) => {
									setAngle( degrees );
									controller.current?.setViewDegrees( degrees );
								}} />
						</div>
					</div>
					<p id="prototype-description" className="mascot-lab-caption">
						The supplied capybara model with its baked greeting animation.
					</p>
				</section>
				<section aria-labelledby="reference-heading">
					<div className="mascot-lab-panel-heading">
						<h2 id="reference-heading">Your reference</h2>
						<span>Original image</span>
					</div>
					<div className="mascot-lab-reference">
						<img src="/images/mascot-reference.png" alt="Supplied capybara reference"
							width="920" height="1250" />
					</div>
					<p className="mascot-lab-caption mascot-lab-reference-caption">
						The visual target for proportions, expression, color, and surface character.
					</p>
				</section>
			</div>
			<footer className="mascot-lab-notes">
				<p>Compare at 0&deg; with animation paused: the head-to-body ratio,
					broad muzzle, eye placement, and paw shape.
					Turn the view to inspect volume and the shoulder joint.</p>
				<p>The same locally loaded model appears on the homepage.
					Its material and animation are embedded in one portable GLB.</p>
			</footer>
		</main>
	</TocusProvider>;
}
