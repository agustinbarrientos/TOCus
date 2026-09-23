import { Button, Slider, TocusAppearance, TocusProvider } from '@tocus/ui';
import { useEffect, useRef, useState } from 'react';
import {
	MascotSceneStatus, type MascotSceneController, type MascotSceneState,
} from '../../services/mascot-scene/types';
import './style.scss';

/**
 * Compares the earlier interactive mascot with the current riverside character.
 * @return A local, accessible comparison with explicit motion and view controls.
 * @since 1.0.0
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
				<p>An earlier 3D prototype beside the current capybara.
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
								? '3D is unavailable in this browser. The capybara image remains visible.'
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
						The earlier capybara model with its baked greeting animation.
					</p>
				</section>
				<section aria-labelledby="reference-heading">
					<div className="mascot-lab-panel-heading">
						<h2 id="reference-heading">Current capybara</h2>
						<span>Riverside character</span>
					</div>
					<div className="mascot-lab-reference">
						<img src="/images/capybara-mate.webp" alt="Current capybara holding a mate"
							width="700" height="800" />
					</div>
					<p className="mascot-lab-caption mascot-lab-reference-caption">
						The current riverside character with its warm clay material and mate.
					</p>
				</section>
			</div>
			<footer className="mascot-lab-notes">
				<p>Compare at 0&deg; with animation paused: the head-to-body ratio,
					broad muzzle, eye placement, and paw shape.
					Turn the view to inspect volume and the shoulder joint.</p>
				<p>The homepage uses a separate riverside scene with a drinking animation.
					Both models load locally without external services.</p>
			</footer>
		</main>
	</TocusProvider>;
}
