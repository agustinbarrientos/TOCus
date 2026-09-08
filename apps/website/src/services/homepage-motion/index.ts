import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * Adds scroll-linked illustration motion without moving the story's browser frame.
 * Layout and narrative state remain owned by CSS and the separate story controller.
 * @param root - Homepage boundary containing the hero and timing illustration.
 * @return Cleanup restoring original styles and releasing owned scroll triggers.
 * @since 0.1.0
 */
export function createHomepageMotion( root: HTMLElement ): () => void {
	gsap.registerPlugin( ScrollTrigger );
	const media = gsap.matchMedia();
	media.add( '(prefers-reduced-motion: no-preference)', () => {
		const layout = root.querySelector<HTMLElement>( '.story-layout' );
		const stage = root.querySelector<HTMLElement>( '.experience-stage' );
		const mascot = root.querySelector( '.hero-art .mascot' );
		if ( layout && stage && mascot ) {
			gsap.to( mascot, {
				opacity: 0, scale: 0.94, transformOrigin: 'center bottom', ease: 'none',
				scrollTrigger: {
					trigger: layout, start: 'top 75%',
					/**
					 * Reads the responsive sticky offset after fonts or viewport sizes change.
					 * @return ScrollTrigger boundary aligned with the browser's sticky position.
					 */
					end: () => `top ${ getComputedStyle( stage ).top }`,
					scrub: true, invalidateOnRefresh: true,
				},
			} );
		}
		const timing = root.querySelector( '.timing-illustration' );
		if ( timing ) {
			const sequence = gsap.timeline( {
				scrollTrigger: { trigger: timing, start: 'top 85%', end: 'bottom 55%', scrub: true },
			} );
			sequence.fromTo(
				timing.querySelectorAll( '.timing-symbol' ),
				{ y: 14, opacity: 0.25 },
				{ y: 0, opacity: 1, stagger: 0.15, ease: 'none' },
			);
			sequence.fromTo(
				timing.querySelector( '.timing-window > span' ),
				{ scaleX: 0.05, transformOrigin: 'left center' },
				{ scaleX: 1, ease: 'none' },
				0.4,
			);
		}
		for ( const section of root.querySelectorAll( '[data-story-reveal]' ) ) {
			if ( section === timing ) {
				continue;
			}
			gsap.fromTo( section, { y: 20 }, { y: 0, ease: 'none',
				scrollTrigger: { trigger: section, start: 'top 90%', end: 'top 55%', scrub: true } } );
		}
	}, root );
	return () => {
		media.revert();
	};
}
