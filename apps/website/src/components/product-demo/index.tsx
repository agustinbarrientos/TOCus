import { setupI18n } from '@lingui/core';
import { TocusProvider, VisuallyHidden } from '@tocus/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Palette, ThemeMode } from '../../../../extension/src/domains/preferences/types';
import { createInterruptionCopy } from '../../../../extension/src/localization/utils/create-interruption-copy';
import { DemoChapter, type ProductDemoProps } from './types';
import { BrowserChrome } from './browser-chrome';
import { ProductDemoScene } from './scene';
import './style.scss';

/**
 * Illustrates the same five product steps as the surrounding explanation.
 * Scroll progress selects sites, advances the real breathing renderer, and reveals
 * the allowed website. A fixed browser surface keeps every step spatially stable.
 * @param props - Localized website labels, production translations, and scroll state.
 * @param props.languageTag - Active website language.
 * @param props.messages - Compiled extension translations.
 * @param props.copy - Concise labels for website selection and the browsing allowance.
 * @param props.chapter - Active product step.
 * @param props.progress - Normalized progress within that step.
 * @return A local, reversible illustration using the production UI and sphere.
 * @since 0.1.0
 */
export function ProductDemo( {
	languageTag, messages, copy, chapter = DemoChapter.CHOOSE, progress = 0,
}: ProductDemoProps ) {
	const localized = useMemo( () => createInterruptionCopy( setupI18n( {
		locale: languageTag, messages: { [ languageTag ]: messages },
	} ) ), [ languageTag, messages ] );
	const [ reducedMotion, setReducedMotion ] = useState( true );
	const stage = useRef<HTMLDivElement>( null );
	const sceneProgress = Number.isFinite( progress ) ? Math.max( 0, Math.min( 1, progress ) ) : 0;
	const choosing = chapter === DemoChapter.CHOOSE;
	const ready = chapter === DemoChapter.CONTINUE;
	const paused = chapter === DemoChapter.PAUSE || ready;
	const browsing = chapter === DemoChapter.BROWSE;
	const title = choosing || paused ? 'TOCus' : 'YouTube';
	const address = choosing ? 'TOCus' : 'youtube.com';
	const status = choosing ? copy.chooseTitle : ready ? localized.readyAnnouncement
		: paused ? localized.takeAMoment : browsing ? copy.timeLeft : copy.visitTitle;

	useEffect( () => {
		const query = window.matchMedia( '(prefers-reduced-motion: reduce)' );
		/** Applies the current motion preference without changing the selected story step. */
		const updateMotion = () => {
			setReducedMotion( query.matches );
		};
		updateMotion();
		query.addEventListener( 'change', updateMotion );
		return () => {
			query.removeEventListener( 'change', updateMotion );
		};
	}, [] );

	/** Moves to the next explanation when the illustrated Continue action is activated. */
	const continueStory = useCallback( () => {
		const nextChapter = stage.current?.closest( '.story-layout' )
			?.querySelector<HTMLButtonElement>( `[data-story-chapter="${ DemoChapter.BROWSE }"] button` );
		nextChapter?.focus( { preventScroll: true } );
		nextChapter?.click();
	}, [] );

	return <section id="product-story-screen" className="product-demo product-preview"
		aria-label={ copy.label } data-scene={ chapter } data-reduced-motion={ reducedMotion }>
		<TocusProvider appearance={ ThemeMode.LIGHT } palette={ Palette.BROWN }
			reducedMotion={ reducedMotion } transparent>
			<VisuallyHidden role="status" aria-live="polite" aria-atomic="true">{ status }</VisuallyHidden>
			<div className="product-demo-scene">
				<div className="product-demo-browser">
					<BrowserChrome title={ title } address={ address } />
					<div className="product-demo-stage" ref={ stage }>
						{ Object.values( DemoChapter ).map( ( sceneChapter ) => <ProductDemoScene
							key={ sceneChapter } { ...copy } localized={ localized }
							chapter={ sceneChapter } active={ chapter === sceneChapter }
							progress={ chapter === sceneChapter ? sceneProgress : 0 } reducedMotion={ reducedMotion }
							onContinue={ continueStory } /> ) }
					</div>
				</div>
			</div>
		</TocusProvider>
	</section>;
}
