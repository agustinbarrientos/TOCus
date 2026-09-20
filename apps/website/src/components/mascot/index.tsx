import type { MascotProps } from './types';
import './style.scss';

/**
 * Enhances a packaged illustration with an optional, visibility-limited beach scene.
 * @param props - Localized artwork description and interaction label.
 * @return Accessible layered artwork with a static reduced-motion presentation.
 * @since 0.1.0
 */
export function Mascot( props: MascotProps ) {
	const { alt, interactionLabel } = props;
	const root = useRef<HTMLDivElement>( null );
	useEffect( () => {
		const element = root.current;
		if ( ! element ) {
			return;
		}
		const motion = matchMedia( '(prefers-reduced-motion: reduce)' );
		let generation = 0;
		let dispose: ( () => void ) | undefined;
		/** Keeps the static illustration when movement is unwanted or unavailable. */
		function configure(): void {
			const current = ++generation;
			dispose?.();
			dispose = undefined;
			if ( motion.matches || ! element ) {
				return;
			}
			void import( '../../services/beach-scene' ).then( ( { createBeachScene } ) => {
				if ( current !== generation ) {
					return;
				}
				const cleanup = createBeachScene( element );
				if ( current !== generation ) {
					cleanup();
				} else {
					dispose = cleanup;
				}
			} ).catch( () => { /* The local illustration remains available if enhancement fails. */ } );
		}
		configure();
		motion.addEventListener( 'change', configure );
		return () => {
			generation++;
			dispose?.();
			motion.removeEventListener( 'change', configure );
		};
	}, [] );
	return <div className="mascot beach-scene" ref={ root } data-playing="false">
		<div className="beach-water" aria-hidden="true"><span /><span /><span /></div>
		<div className="beach-sand" aria-hidden="true" />
		<div className="beach-shadow" aria-hidden="true" />
		<img data-mascot src="/images/capybara-lounge.webp" width="1100" height="1100"
			fetchPriority="high" alt={ alt } />
		<UnstyledButton className="beach-interaction" aria-label={ interactionLabel }>
			<span className="beach-ripple" aria-hidden="true" />
		</UnstyledButton>
	</div>;
}
import { useEffect, useRef } from 'react';
import { UnstyledButton } from '@tocus/ui';
