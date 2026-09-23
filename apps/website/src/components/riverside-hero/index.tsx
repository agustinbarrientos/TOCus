import { useEffect, useRef, useState } from 'react';
import { HeroPoster, HeroStatus, type HeroController } from '../../services/riverside-hero/types';
import './style.scss';

/**
 * Presents a local poster until the interactive scene is ready.
 * @return A decorative poster and progressively enhanced canvas.
 * @since 1.0.0
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
		const smallScreen = matchMedia( '(max-width: 35rem)' );
		/** Loads WebGL on larger screens when motion is permitted, or restores the poster. */
		async function enhance(): Promise<void> {
			const current = ++generation;
			controller?.dispose();
			controller = undefined;
			if ( motion.matches || smallScreen.matches ) {
				setStatus( HeroStatus.POSTER ); return;
			}
			setStatus( HeroStatus.LOADING );
			try {
				const { createRiversideHero } = await import( '../../services/riverside-hero' );
				if ( ! active || current !== generation ) {
					return;
				}
				controller = createRiversideHero( surface, ( next ) => {
					if ( active && current === generation ) {
						setStatus( next );
					}
				} );
			} catch {
				if ( active && current === generation ) {
					setStatus( HeroStatus.UNAVAILABLE );
				}
			}
		}
		/** Dispatches async enhancement from a synchronous media-query listener. */
		function updateEnhancement(): void {
			void enhance();
		}
		updateEnhancement();
		motion.addEventListener( 'change', updateEnhancement );
		smallScreen.addEventListener( 'change', updateEnhancement );
		return () => {
			active = false;
			motion.removeEventListener( 'change', updateEnhancement );
			smallScreen.removeEventListener( 'change', updateEnhancement );
			controller?.dispose();
		};
	}, [] );
	return <div className="riverside-hero" data-status={ status } aria-hidden="true">
		<img className="riverside-hero-poster" src="/images/riverside-hero.webp" alt=""
			width={ HeroPoster.WIDTH } height={ HeroPoster.HEIGHT } fetchPriority="high" />
		<canvas ref={ canvas } className="riverside-hero-canvas" />
	</div>;
}
