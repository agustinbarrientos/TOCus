import { setupI18n } from '@lingui/core';
import { Brand, BrandSize, Button, Icon, IconName, TocusProvider, VisuallyHidden } from '@tocus/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Palette, ThemeMode } from '../../../../extension/src/domains/preferences/types';
import { DefaultTimingConfiguration } from '../../../../extension/src/domains/protection/types/timing-configuration';
import { BreathingMotionPhase, getBreathingMotionFrame } from '../../../../extension/src/features/interruption/utils/breathing-motion';
import {
	readBreathingSphereColors, renderBreathingSphereFrame, resizeBreathingSphereCanvas,
} from '../../../../extension/src/features/interruption/utils/breathing-sphere-renderer';
import { createInterruptionCopy } from '../../../../extension/src/localization/utils/create-interruption-copy';
import youtubeIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-youtube.svg?url';
import instagramIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-instagram.svg?url';
import redditIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-reddit.svg?url';
import xIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-x.svg?url';
import tiktokIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-tiktok.svg?url';
import twitchIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-twitch.svg?url';
import { DemoChapter, DemoThumbnail, type ProductDemoProps } from './types';
import { BrowserChrome } from './browser-chrome';
import './style.scss';

const WAIT_MILLISECONDS = DefaultTimingConfiguration.initialWaitMilliseconds;
const ALLOWANCE_SECONDS = DefaultTimingConfiguration.allowanceMilliseconds / 1000;
const Sites = [
	{ name: 'YouTube', host: 'youtube.com', icon: youtubeIcon, selectedAt: 0 },
	{ name: 'Instagram', host: 'instagram.com', icon: instagramIcon, selectedAt: 0.25 },
	{ name: 'Reddit', host: 'reddit.com', icon: redditIcon, selectedAt: 0.6 },
	{ name: 'X', host: 'x.com', icon: xIcon, selectedAt: 2 },
	{ name: 'TikTok', host: 'tiktok.com', icon: tiktokIcon, selectedAt: 2 },
	{ name: 'Twitch', host: 'twitch.tv', icon: twitchIcon, selectedAt: 2 },
] as const;

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
	const canvas = useRef<HTMLCanvasElement>( null );
	const colorProbe = useRef<HTMLSpanElement>( null );
	const sceneProgress = Number.isFinite( progress ) ? Math.max( 0, Math.min( 1, progress ) ) : 0;
	const choosing = chapter === DemoChapter.CHOOSE;
	const ready = chapter === DemoChapter.CONTINUE;
	const paused = chapter === DemoChapter.PAUSE || ready;
	const browsing = chapter === DemoChapter.BROWSE;
	const frame = getBreathingMotionFrame(
		ready ? WAIT_MILLISECONDS : Math.min( 0.999, sceneProgress ) * WAIT_MILLISECONDS,
		WAIT_MILLISECONDS,
		reducedMotion,
	);
	const title = choosing || paused ? 'TOCus' : 'YouTube';
	const address = choosing ? 'TOCus' : 'youtube.com';
	const allowanceSeconds = ALLOWANCE_SECONDS - Math.floor( sceneProgress * 30 );
	const allowance = `${ String( Math.floor( allowanceSeconds / 60 ) ) }:${
		String( allowanceSeconds % 60 ).padStart( 2, '0' ) }`;
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

	useEffect( () => {
		const element = canvas.current;
		const probe = colorProbe.current;
		if ( ! paused || ! element || ! probe ) {
			return;
		}
		const colors = readBreathingSphereColors( probe );
		/** Paints exactly the scroll-owned production frame, with no background clock. */
		const paint = () => {
			resizeBreathingSphereCanvas( element );
			renderBreathingSphereFrame( {
				canvas: element, colors, breathProgress: frame.breathProgress, still: reducedMotion,
			} );
		};
		paint();
		const observer = new ResizeObserver( paint );
		observer.observe( element );
		return () => {
			observer.disconnect();
		};
	}, [ paused, frame.breathProgress, reducedMotion ] );

	/** Moves to the next explanation when the illustrated Continue action is activated. */
	function continueStory(): void {
		const nextChapter = stage.current?.closest( '.story-layout' )
			?.querySelector<HTMLButtonElement>( `[data-story-chapter="${ DemoChapter.BROWSE }"] button` );
		nextChapter?.focus( { preventScroll: true } );
		nextChapter?.click();
	}

	return <section id="product-story-screen" className="product-demo product-preview"
		aria-label={ copy.label } data-scene={ chapter } data-reduced-motion={ reducedMotion }>
		<TocusProvider appearance={ ThemeMode.LIGHT } palette={ Palette.BROWN }
			reducedMotion={ reducedMotion } transparent>
			<VisuallyHidden role="status" aria-live="polite" aria-atomic="true">{ status }</VisuallyHidden>
			<div className="product-demo-scene">
				<div className="product-demo-browser">
					<BrowserChrome title={ title } address={ address } />
					<div className="product-demo-stage" ref={ stage }>
						{ choosing ? <div className="product-demo-choose">
							<header className="product-demo-stage-header"><Brand size={ BrandSize.STANDARD } /></header>
							<h3>{ copy.chooseTitle }</h3>
							<ul className="product-demo-site-options" aria-label={ copy.chooseTitle }>
								{ Sites.map( ( site ) => {
									const selected = ( reducedMotion ? 1 : sceneProgress ) >= site.selectedAt;
									return <li className="product-demo-site-option" key={ site.host }
										data-selected={ selected }>
										<img src={ site.icon } width="36" height="36" alt="" />
										<strong>{ site.name }</strong>
										<span className="product-demo-site-check" aria-hidden="true">
											{ selected && <Icon name={ IconName.CIRCLE_CHECK } /> }
										</span>
										{ selected && <VisuallyHidden>{ copy.siteSelected }</VisuallyHidden> }
									</li>;
								} ) }
							</ul>
						</div> : paused ? <div className={ `product-demo-pause${ ready ? ' product-demo-ready' : '' }` }>
							<header className="product-demo-stage-header">
								<Brand size={ BrandSize.STANDARD } />
								<p className="product-demo-countdown">{ ready ? localized.readyAnnouncement
									: localized.formatRemainingTime( Math.ceil( frame.remainingMilliseconds / 1000 ) ) }
								</p>
							</header>
							<h3 className="product-demo-phase">{ ready || reducedMotion ? localized.takeAMoment
								: frame.phase === BreathingMotionPhase.INHALE
									? localized.breatheIn : localized.breatheOut }</h3>
							<canvas ref={ canvas } className="product-demo-sphere" data-still={ reducedMotion } role="img"
								aria-label={ reducedMotion
									? localized.stillSphereAlternative : localized.sphereAlternative } />
							<span ref={ colorProbe } className="product-demo-color-probe" aria-hidden="true" />
							<Button className="product-demo-continue" disabled={ ! ready } onClick={ continueStory }>
								{ localized.continueLabel }
							</Button>
						</div> : <div className="product-demo-youtube" aria-label="YouTube">
							<header className="product-demo-youtube-header">
								<span className="product-demo-youtube-brand">
									<img src={ youtubeIcon } alt="" width="30" height="30" />YouTube</span>
								{ browsing ? <div className="product-demo-time-left"><Icon name={ IconName.STOPWATCH } />
									<span>{ copy.timeLeft } <time dateTime={ `PT${ String( allowanceSeconds ) }S` }>
										{ allowance }</time></span>
								</div> : <div className="product-demo-search" aria-hidden="true"><i /><span /></div> }
							</header>
							<VisuallyHidden component="h3">{ copy.visitTitle }</VisuallyHidden>
							<div className="product-demo-video-grid" aria-hidden="true">
								{ Object.values( DemoThumbnail ).map( ( video ) => <div className="product-demo-video" key={ video }>
									<div className={ `product-demo-thumbnail product-demo-thumbnail-${ video }` }>
										<i /><b /><span className="product-demo-play" /></div>
									<div className="product-demo-video-caption"><span /><div><i /><i /></div></div>
								</div> ) }
							</div>
						</div> }
					</div>
				</div>
			</div>
		</TocusProvider>
	</section>;
}
