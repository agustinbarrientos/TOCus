import { useEffect, useRef, useState } from 'react';
import { HeroStatus, type HeroController } from '../../services/riverside-hero/types';
import './style.scss';

/**
 * Presents a local poster until the interactive scene is ready.
 * @return A decorative poster and progressively enhanced canvas.
 * @since 0.1.0
 */
export function RiversideHero() {
	const canvas = useRef<HTMLCanvasElement>( null );
	const [ status, setStatus ] = useState<HeroStatus>( HeroStatus.POSTER );
	useEffect( () => {
		const element = canvas.current;
		if ( ! element ) {
			return;
		}
		const surface: HTMLCanvasElement = element;
		let active = true;
		let generation = 0;
		let controller: HeroController | undefined;
		const motion = matchMedia( '(prefers-reduced-motion: reduce)' );
		/** Loads WebGL only for visitors who permit motion, or restores the poster. */
		async function enhance(): Promise<void> {
			const current = ++generation;
			controller?.dispose();
			controller = undefined;
			if ( motion.matches ) {
				setStatus( HeroStatus.POSTER ); return;
			}
			setStatus( HeroStatus.LOADING );
			try {
				const { createRiversideHero } = await import( '../../services/riverside-hero' );
				if ( ! active || current !== generation ) {
					return;
				}
				controller = createRiversideHero( surface, ( next ) => {
					if ( active ) {
						setStatus( next );
					}
				} );
			} catch {
				if ( active ) {
					setStatus( HeroStatus.UNAVAILABLE );
				}
			}
		}
		/** Dispatches async enhancement from a synchronous media-query listener. */
		function updateMotion(): void {
			void enhance();
		}
		updateMotion();
		motion.addEventListener( 'change', updateMotion );
		return () => {
			active = false;
			motion.removeEventListener( 'change', updateMotion );
			controller?.dispose();
		};
	}, [] );
	return <div className="riverside-hero" data-status={ status } aria-hidden="true">
		<img className="riverside-hero-poster" src="/images/riverside-hero.webp" alt=""
			width="6000" height="2160" fetchPriority="high" />
		<canvas ref={ canvas } className="riverside-hero-canvas" />
	</div>;
}
