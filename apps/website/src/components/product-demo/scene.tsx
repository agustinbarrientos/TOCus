import { Brand, BrandSize, Button, Icon, IconName, TextInput, VisuallyHidden } from '@tocus/ui';
import { memo } from 'react';
import youtubeIcon from '@tocus/theme/site-icons/site-youtube.svg?url';
import instagramIcon from '@tocus/theme/site-icons/site-instagram.svg?url';
import redditIcon from '@tocus/theme/site-icons/site-reddit.svg?url';
import xIcon from '@tocus/theme/site-icons/site-x.svg?url';
import tiktokIcon from '@tocus/theme/site-icons/site-tiktok.svg?url';
import twitchIcon from '@tocus/theme/site-icons/site-twitch.svg?url';
import { DemoChapter, type ProductDemoSceneProps } from './types';

const WAIT_MILLISECONDS = 10_000;
const Sites = [
	{ name: 'YouTube', host: 'youtube.com', icon: youtubeIcon, selectedAt: 0.18 },
	{ name: 'Reddit', host: 'reddit.com', icon: redditIcon, selectedAt: 0.72 },
	{ name: 'X', host: 'x.com', icon: xIcon, selectedAt: 2 },
	{ name: 'Instagram', host: 'instagram.com', icon: instagramIcon, selectedAt: 0.45 },
	{ name: 'TikTok', host: 'tiktok.com', icon: tiktokIcon, selectedAt: 2 },
	{ name: 'Twitch', host: 'twitch.tv', icon: twitchIcon, selectedAt: 2 },
] as const;

/**
 * Presents website-owned illustrations of onboarding, the pause, and an allowed visit.
 * @param props - Chapter identity, visibility, localized copy and reversible progress.
 * @return A stable scene that shares only the public theme and UI package with the extension.
 * @since 0.1.0
 */
function ProductDemoSceneContent( props: ProductDemoSceneProps ) {
	const { chapter, active, progress, reducedMotion, onContinue, ...copy } = props;
	const choosing = chapter === DemoChapter.CHOOSE;
	const ready = chapter === DemoChapter.CONTINUE;
	const paused = chapter === DemoChapter.PAUSE || ready;
	const browsing = chapter === DemoChapter.BROWSE;
	const remaining = Math.ceil( ( 1 - progress ) * WAIT_MILLISECONDS / 1000 );
	const breath = reducedMotion ? 0 : ( 1 - Math.cos( progress * Math.PI * 4 ) ) / 2;
	const phase = reducedMotion ? copy.takeAMoment
		: progress % 0.5 < 0.25 ? copy.breatheIn : copy.breatheOut;
	const phases = Array.from( new Set( [ copy.takeAMoment, copy.breatheIn, copy.breatheOut ] ) );
	const shortcut = copy.continueShortcut.split( '{key}' );
	const className = choosing ? 'product-demo-choose' : paused
		? `product-demo-pause${ ready ? ' product-demo-ready' : '' }` : browsing ? 'product-demo-youtube' : 'product-demo-new-tab';
	const selectionProgress = reducedMotion ? 1 : progress;
	const cursorSite = progress < 0.32 ? 0 : progress < 0.6 ? 3 : 1;
	const cursorClicked = choosing ? Sites.some( ( site ) => Math.abs( progress - site.selectedAt ) < 0.04 )
		: progress > 0.8;

	return <div className={ className } data-demo-chapter={ chapter } aria-hidden={ ! active } inert={ ! active }
		aria-label={ ! choosing && ! paused ? browsing ? 'YouTube' : copy.newTab : undefined }>
		{ choosing ? <>
			<header className="product-demo-stage-header"><Brand size={ BrandSize.STANDARD } /></header>
			<div className="product-demo-onboarding-form">
				<h3>{ copy.chooseTitle }</h3>
				<section className="product-demo-suggestions" aria-label={ copy.popularChoices }>
					<h4>{ copy.popularChoices }</h4>
					<ul className="product-demo-site-options" aria-label={ copy.chooseTitle }>
						{ Sites.map( ( site, index ) => {
							const selected = selectionProgress >= site.selectedAt;
							return <li className="product-demo-site-option" key={ site.host } data-selected={ selected }>
								<span className="product-demo-site-icon"><img src={ site.icon } width="36" height="36" alt="" /></span>
								<strong>{ site.name }</strong>
								<span className="product-demo-site-check" aria-hidden="true">
									{ selected && <Icon name={ IconName.CIRCLE_CHECK } /> }
								</span>
								{ selected && <VisuallyHidden>{ copy.siteSelected }</VisuallyHidden> }
								{ active && ! reducedMotion && cursorSite === index &&
									<svg className="product-demo-cursor" data-clicking={ cursorClicked } aria-hidden="true" viewBox="0 0 24 30">
										<path d="M2 2v23l6-6 5 9 4-2-5-9h9Z" fill="#fff" stroke="#342920" strokeWidth="2" />
									</svg> }
							</li>;
						} ) }
					</ul>
				</section>
				<section className="product-demo-manual-site" aria-label={ copy.addAnotherSite }>
					<h4>{ copy.addAnotherSite }</h4>
					<div className="product-demo-manual-control" inert>
						<TextInput readOnly tabIndex={ -1 } radius="xl" aria-label={ copy.address } placeholder={ copy.addressPlaceholder } />
						<Button variant="outline" tabIndex={ -1 }
							classNames={ { label: 'product-demo-button-label' } }>{ copy.addSite }</Button>
					</div>
				</section>
				<div className="product-demo-setup-actions" inert>
					<Button className="tocus-action-raised" tabIndex={ -1 }
						classNames={ { label: 'product-demo-button-label' } }>{ copy.finishSetup }</Button>
				</div>
			</div>
		</> : paused ? <>
			<div className="product-demo-bloom" aria-hidden="true" />
			<header className="product-demo-stage-header">
				<Brand size={ BrandSize.STANDARD } />
				{ ! ready && <p className="product-demo-countdown">{
					copy.secondsRemaining.replace( '{seconds}', String( remaining ) ) }</p> }
			</header>
			{ ready ? <div className="product-demo-ready-action">
				<Button className="product-demo-continue tocus-action-soft" onClick={ onContinue }>{ copy.continueLabel }</Button>
				<p className="product-demo-shortcut-hint">{ shortcut[ 0 ] }<kbd>{ copy.spaceKey }</kbd>{ shortcut[ 1 ] }</p>
				{ active && ! reducedMotion && <svg className="product-demo-cursor" data-clicking={ cursorClicked }
					aria-hidden="true" viewBox="0 0 24 30"><path d="M2 2v23l6-6 5 9 4-2-5-9h9Z"
						fill="#fff" stroke="#342920" strokeWidth="2" /></svg> }
			</div> : <div className="product-demo-breathing-stage">
				<h3 className="product-demo-phase">
					{ phases.map( ( label ) => <span key={ label } aria-hidden={ label !== phase }>{ label }</span> ) }
				</h3>
				<div className="product-demo-sphere" data-still={ reducedMotion } role="img" aria-label={ copy.sphere }>
					<div className="product-demo-orb-rings" style={ { transform: `scale(${ String( 0.78 + breath * 0.22 ) })` } }>
						<div className="product-demo-orb" />
					</div>
				</div>
			</div> }
		</> : ! browsing ? <>
			<h3>{ copy.newTab }</h3>
			<div className="product-demo-shortcut" data-clicking={ cursorClicked }>
				<span><img src={ youtubeIcon } width="32" height="32" alt="" /></span><strong>YouTube</strong>
				{ active && ! reducedMotion && <svg className="product-demo-cursor" data-clicking={ cursorClicked }
					aria-hidden="true" viewBox="0 0 24 30"><path d="M2 2v23l6-6 5 9 4-2-5-9h9Z"
						fill="#fff" stroke="#342920" strokeWidth="2" /></svg> }
			</div>
		</> : <>
			<header className="product-demo-youtube-header">
				<span className="product-demo-youtube-brand"><span className="product-demo-menu" aria-hidden="true" />
					<img src={ youtubeIcon } alt="" width="30" height="30" />YouTube</span>
				<span className="product-demo-search" aria-hidden="true"><span /></span>
				<span className="product-demo-account" aria-hidden="true" />
			</header>
			<VisuallyHidden component="h3">{ copy.visitTitle }</VisuallyHidden>
			<div className="product-demo-watch-page">
				<div className="product-demo-video">
					<div className="product-demo-video-player">
						<img src="/images/capybara-mate.webp" alt="" width="700" height="800" loading="lazy" />
						<div className="product-demo-video-controls" aria-hidden="true"><span className="product-demo-play" />
							<span className="product-demo-video-progress" /><span>0:12 / 8:24</span></div>
					</div>
					<h4>{ copy.videoTitle }</h4>
					<p className="product-demo-video-channel"><span aria-hidden="true" />{ copy.videoChannel }</p>
				</div>
				<div className="product-demo-related" aria-hidden="true">
					{ [ 0, 1, 2 ].map( ( item ) => <div key={ item }><span /><i /><i /></div> ) }
				</div>
			</div>
		</> }
	</div>;
}

/**
 * Skips unchanged inactive illustrations while their contents reserve a stable browser height.
 * @since 0.1.0
 */
export const ProductDemoScene = memo( ProductDemoSceneContent );
