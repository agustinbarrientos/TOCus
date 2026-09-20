import { TocusProvider, TocusAppearance, TocusPalette, VisuallyHidden } from '@tocus/ui';
import { useCallback, useRef } from 'react';
import { DemoChapter, type ProductDemoProps } from './types';
import { BrowserChrome } from './browser-chrome';
import { ProductDemoScene } from './scene';
import './style.scss';

/**
 * Illustrates the same five product steps as the surrounding explanation.
 * Timed progress selects sites, animates the breathing illustration, and reveals the allowed website.
 * @param props - Localized website labels and player state.
 * @param props.copy - Concise labels for website selection and the browsing allowance.
 * @param props.chapter - Active product step.
 * @param props.progress - Normalized progress within that step.
 * @param props.reducedMotion - Whether the scene should remain still.
 * @return A local, reversible illustration using shared controls and website-owned artwork.
 * @since 0.1.0
 */
export function ProductDemo( {
	copy, reducedMotion, chapter = DemoChapter.CHOOSE, progress = 0,
}: ProductDemoProps ) {
	const stage = useRef<HTMLDivElement>( null );
	const sceneProgress = Number.isFinite( progress ) ? Math.max( 0, Math.min( 1, progress ) ) : 0;
	const choosing = chapter === DemoChapter.CHOOSE;
	const ready = chapter === DemoChapter.CONTINUE;
	const paused = chapter === DemoChapter.PAUSE || ready;
	const browsing = chapter === DemoChapter.BROWSE;
	const title = choosing || paused ? 'TOCus' : browsing ? 'YouTube' : copy.newTab;
	const address = choosing ? 'TOCus' : browsing || paused ? 'youtube.com' : '';
	const status = choosing ? copy.chooseTitle : ready ? copy.ready
		: paused ? copy.takeAMoment : browsing ? copy.timeLeft : copy.visitTitle;

	/** Moves to the next explanation when the illustrated Continue action is activated. */
	const continueStory = useCallback( () => {
		const nextChapter = stage.current?.closest( '.story-layout' )
			?.querySelector<HTMLButtonElement>( `[data-story-chapter="${ DemoChapter.BROWSE }"] button` );
		nextChapter?.focus( { preventScroll: true } );
		nextChapter?.click();
	}, [] );

	return <section id="product-story-screen" className="product-demo product-preview"
		aria-label={ copy.label } data-scene={ chapter } data-reduced-motion={ reducedMotion }>
		<TocusProvider appearance={ TocusAppearance.LIGHT } palette={ TocusPalette.BROWN }
			reducedMotion={ reducedMotion } transparent>
			<VisuallyHidden role="status" aria-live="polite" aria-atomic="true">{ status }</VisuallyHidden>
			<div className="product-demo-scene">
				<div className="product-demo-browser">
					<BrowserChrome title={ title } address={ address }
						allowance={ browsing ? copy.allowanceMinutes.replace( '{minutes}', '5' ) : undefined } />
					<div className="product-demo-stage" ref={ stage }>
						{ Object.values( DemoChapter ).map( ( sceneChapter ) => <ProductDemoScene
							key={ sceneChapter } { ...copy }
							chapter={ sceneChapter } active={ chapter === sceneChapter }
							progress={ chapter === sceneChapter ? sceneProgress : 0 } reducedMotion={ reducedMotion }
							onContinue={ continueStory } /> ) }
					</div>
				</div>
			</div>
		</TocusProvider>
	</section>;
}
