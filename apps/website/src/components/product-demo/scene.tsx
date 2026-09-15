import { Brand, BrandSize, Button, Icon, IconName, VisuallyHidden } from '@tocus/ui';
import { memo, useEffect, useRef } from 'react';
import { DefaultTimingConfiguration } from '../../../../extension/src/domains/protection/types/timing-configuration';
import { BreathingMotionPhase, getBreathingMotionFrame } from '../../../../extension/src/features/interruption/utils/breathing-motion';
import {
	readBreathingSphereColors, renderBreathingSphereFrame, resizeBreathingSphereCanvas,
} from '../../../../extension/src/features/interruption/utils/breathing-sphere-renderer';
import youtubeIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-youtube.svg?url';
import instagramIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-instagram.svg?url';
import redditIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-reddit.svg?url';
import xIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-x.svg?url';
import tiktokIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-tiktok.svg?url';
import twitchIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-twitch.svg?url';
import { DemoChapter, DemoThumbnail, type ProductDemoSceneProps } from './types';

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
 * Keeps each real chapter in the shared grid while exposing and painting only the active scene.
 * @param props - Chapter identity, visibility, localized product copy and reversible progress.
 * @return A scene whose readable contents determine the stable browser height.
 * @since 0.1.0
 */
function ProductDemoSceneContent( props: ProductDemoSceneProps ) {
	const { chapter, active, progress, reducedMotion, localized, onContinue, ...copy } = props;
	const canvas = useRef<HTMLCanvasElement>( null );
	const colorProbe = useRef<HTMLSpanElement>( null );
	const choosing = chapter === DemoChapter.CHOOSE;
	const ready = chapter === DemoChapter.CONTINUE;
	const paused = chapter === DemoChapter.PAUSE || ready;
	const browsing = chapter === DemoChapter.BROWSE;
	const frame = getBreathingMotionFrame(
		ready ? WAIT_MILLISECONDS : Math.min( 0.999, progress ) * WAIT_MILLISECONDS,
		WAIT_MILLISECONDS,
		reducedMotion,
	);
	const allowanceSeconds = ALLOWANCE_SECONDS - Math.floor( progress * 30 );
	const allowance = `${ String( Math.floor( allowanceSeconds / 60 ) ) }:${
		String( allowanceSeconds % 60 ).padStart( 2, '0' ) }`;
	const phase = ready || reducedMotion ? localized.takeAMoment
		: frame.phase === BreathingMotionPhase.INHALE ? localized.breatheIn : localized.breatheOut;
	const phases = Array.from( new Set( [ localized.takeAMoment, localized.breatheIn, localized.breatheOut ] ) );
	const className = choosing ? 'product-demo-choose' : paused
		? `product-demo-pause${ ready ? ' product-demo-ready' : '' }` : 'product-demo-youtube';

	useEffect( () => {
		const element = canvas.current;
		const probe = colorProbe.current;
		if ( ! active || ! paused || ! element || ! probe ) {
			return;
		}
		const colors = readBreathingSphereColors( probe );
		/** Paints the visible scroll-owned frame without creating a background clock. */
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
	}, [ active, paused, frame.breathProgress, reducedMotion ] );

	return <div className={ className } data-demo-chapter={ chapter } aria-hidden={ ! active } inert={ ! active }
		aria-label={ ! choosing && ! paused ? 'YouTube' : undefined }>
		{ choosing ? <>
			<header className="product-demo-stage-header"><Brand size={ BrandSize.STANDARD } /></header>
			<h3>{ copy.chooseTitle }</h3>
			<ul className="product-demo-site-options" aria-label={ copy.chooseTitle }>
				{ Sites.map( ( site ) => {
					const selected = ( reducedMotion ? 1 : progress ) >= site.selectedAt;
					return <li className="product-demo-site-option" key={ site.host } data-selected={ selected }>
						<img src={ site.icon } width="36" height="36" alt="" />
						<strong>{ site.name }</strong>
						<span className="product-demo-site-check" aria-hidden="true">
							{ selected && <Icon name={ IconName.CIRCLE_CHECK } /> }
						</span>
						{ selected && <VisuallyHidden>{ copy.siteSelected }</VisuallyHidden> }
					</li>;
				} ) }
			</ul>
		</> : paused ? <>
			<header className="product-demo-stage-header">
				<Brand size={ BrandSize.STANDARD } />
				<p className="product-demo-countdown">{ ready ? localized.readyAnnouncement
					: localized.formatRemainingTime( Math.ceil( frame.remainingMilliseconds / 1000 ) ) }</p>
			</header>
			<h3 className="product-demo-phase">
				{ phases.map( ( label ) => <span key={ label } aria-hidden={ label !== phase }>{ label }</span> ) }
			</h3>
			<canvas ref={ canvas } className="product-demo-sphere" data-still={ reducedMotion } role="img"
				aria-label={ reducedMotion ? localized.stillSphereAlternative : localized.sphereAlternative } />
			<span ref={ colorProbe } className="product-demo-color-probe" aria-hidden="true" />
			<Button className="product-demo-continue" disabled={ ! ready } onClick={ onContinue }>
				{ localized.continueLabel }
			</Button>
		</> : <>
			<header className="product-demo-youtube-header">
				<span className="product-demo-youtube-brand">
					<img src={ youtubeIcon } alt="" width="30" height="30" />YouTube</span>
				{ browsing ? <div className="product-demo-time-left"><Icon name={ IconName.PAUSE } />
					<span>{ copy.timeLeft } <time dateTime={ `PT${ String( allowanceSeconds ) }S` }>{ allowance }</time></span>
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
		</> }
	</div>;
}

/**
 * Skips unchanged inactive scenes while their real content continues to reserve layout space.
 * @since 0.1.0
 */
export const ProductDemoScene = memo( ProductDemoSceneContent );
