import { useEffect, useState } from 'react';
import { Anchor, Brand, TocusAppearance, TocusProvider } from '@tocus/ui';
import { DownloadLinks } from '../download-links';
import { ExternalLink, WebsiteLink } from '../site-links';
import { RiversideHero } from '../riverside-hero';
import { LanguageMenu } from '../language-menu';
import youtubeIcon from '@tocus/theme/site-icons/site-youtube.svg?url';
import type { LocalizedHomePageProperties } from '../../localization';
import './style.scss';

/**
 * Introduces TOCus through a riverside scene, illustrated steps and concise feature explanations.
 * @param props - Current locale, routes and packaged product messages.
 * @return Progressively enhanced website without visitor tracking.
 * @since 0.1.0
 */
export default function HomePage( props: LocalizedHomePageProperties ) {
	const { localization, localizations } = props;
	const { catalog } = localization;
	const [ enhanced, setEnhanced ] = useState( false );
	useEffect( () => {
		setEnhanced( true );
	}, [] );
	return <TocusProvider appearance={ TocusAppearance.LIGHT }>
		<div className="website homepage" data-enhanced={ enhanced }>
			<Anchor className="skip-link" href="#main-content">{ catalog.skipLink }</Anchor>
			<header className="site-header hero-header page-shell">
				<Brand />
				<div className="site-header-actions">
					{ enhanced && <LanguageMenu localization={ localization } localizations={ localizations } /> }
				</div>
			</header>
			<main id="main-content" tabIndex={ -1 }>
				<section className="hero" aria-labelledby="page-title">
					<RiversideHero />
					<div className="hero-copy">
						<h1 id="page-title">{ catalog.intro }</h1>
						<div className="hero-actions">
							<DownloadLinks label={ catalog.downloadFor } alsoAvailable={ catalog.alsoAvailable }
								comingSoon={ catalog.comingSoon } />
						</div>
					</div>
					<svg className="hero-shore-transition" viewBox="0 0 1440 100" preserveAspectRatio="none"
						aria-hidden="true" focusable="false">
						<path className="hero-shore-transition-back"
							d="M0 38C160 0 285 88 500 48S820 2 1030 39S1260 82 1440 33V100H0Z" />
						<path className="hero-shore-transition-front"
							d="M0 60C180 30 320 92 530 66S860 26 1090 62S1330 94 1440 61V100H0Z" />
					</svg>
				</section>
				<div className="homepage-content page-shell">
					<section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
						<h2 id="how-title">{ catalog.howTitle }</h2>
						<ol className="how-steps" role="list">
							<li><span className="how-symbol" aria-hidden="true">
								<img src={ youtubeIcon } width="64" height="64" alt="" loading="lazy" />
							</span><h3>{ catalog.stepOpen }</h3></li>
							<li><span className="how-symbol" aria-hidden="true"><span className="how-sphere" /></span>
								<h3>{ catalog.stepPause }</h3></li>
							<li><span className="how-symbol" aria-hidden="true">
								<svg className="how-check" viewBox="0 0 64 64" focusable="false">
									<circle cx="32" cy="32" r="26" />
									<path d="m21 32 8 8 15-18" />
								</svg>
							</span><h3>{ catalog.stepContinue }</h3></li>
							<li><span className="how-symbol" aria-hidden="true"><span className="how-progress" /></span>
								<h3>{ catalog.stepBrowse }</h3></li>
						</ol>
					</section>
					<section className="homepage-features" id="features" aria-labelledby="features-title">
						<h2 id="features-title">{ catalog.featuresTitle }</h2>
						<ul className="feature-grid" role="list">
							<li>
								<img className="feature-art" src="/images/homepage/icon-clock.webp"
									width="500" height="500" alt="" loading="lazy" />
								<h3>{ catalog.scheduleTitle }</h3><p>{ catalog.scheduleDescription }</p>
							</li>
							<li>
								<img className="feature-art" src="/images/homepage/icon-schedule.webp"
									width="500" height="500" alt="" loading="lazy" />
								<h3>{ catalog.sitesTitle }</h3><p>{ catalog.sitesDescription }</p>
							</li>
							<li>
								<img className="feature-art" src="/images/homepage/icon-video-pause.webp"
									width="500" height="500" alt="" loading="lazy" />
								<h3>{ catalog.mediaTitle }</h3><p>{ catalog.mediaDescription }</p>
								<p className="feature-detail">{ catalog.mediaServices }</p>
							</li>
							<li>
								<img className="feature-art" src="/images/homepage/icon-stats.webp"
									width="500" height="500" alt="" loading="lazy" />
								<h3>{ catalog.statisticsTitle }</h3><p>{ catalog.statisticsDescription }</p>
								<p className="feature-detail">{ catalog.statisticsExample }</p>
							</li>
							<li>
								<img className="feature-art" src="/images/homepage/icon-computer.webp"
									width="500" height="500" alt="" loading="lazy" />
								<h3>{ catalog.privacyLocal }</h3><p>{ catalog.privacy }</p>
								<Anchor className="feature-link" href="/privacy/" underline="always">{ catalog.readPrivacy }</Anchor>
							</li>
							<li>
								<img className="feature-art" src="/images/homepage/icon-open-source.webp"
									width="500" height="500" alt="" loading="lazy" />
								<h3>{ catalog.openSourceTitle }</h3><p>{ catalog.openSourceDescription }</p>
								<ExternalLink className="feature-link" href={ WebsiteLink.SOURCE }>{ catalog.sourceShort }</ExternalLink>
							</li>
						</ul>
					</section>
				</div>
				<section className="download-section" id="downloads" aria-labelledby="download-title">
					<svg className="download-landscape" viewBox="0 0 1440 400" preserveAspectRatio="none"
						aria-hidden="true" focusable="false">
						<path className="download-landscape-back"
							d="M0 25C185 80 255-5 430 25S740 40 930 25S1190 90 1440 20V400H0Z" />
						<path className="download-landscape-middle"
							d="M0 135C190 10 300 240 545 155S895 90 1070 135S1300 62 1440 108V400H0Z" />
						<path className="download-landscape-front"
							d="M0 250C180 195 275 330 550 250S900 298 1090 220S1300 228 1440 200V400H0Z" />
						<path className="download-landscape-bottom"
							d="M0 340C200 285 420 415 660 362S1080 380 1440 320V400H0Z" />
					</svg>
					<div className="download-decoration" aria-hidden="true">
						<img className="download-plant download-plant-left" src="/images/homepage/decoration-plant-1.webp"
							width="600" height="514" alt="" loading="lazy" />
						<img className="download-plant download-plant-right" src="/images/homepage/decoration-plant-2.webp"
							width="600" height="511" alt="" loading="lazy" />
						<img className="download-sun" src="/images/homepage/decoration-sun.webp"
							width="600" height="587" alt="" loading="lazy" />
					</div>
					<div className="download-panel">
						<h2 id="download-title">{ catalog.downloadTitle }</h2>
						<DownloadLinks label={ catalog.downloadFor } alsoAvailable={ catalog.alsoAvailable }
							comingSoon={ catalog.comingSoon } />
					</div>
				</section>
			</main>
			<footer className="site-footer">
				<div className="page-shell">
					<div className="footer-main">
						<Brand />
						<div className="footer-links">
							<Anchor href="/privacy/">{ catalog.privacyLink }</Anchor>
							<ExternalLink href={ WebsiteLink.SOURCE }>{ catalog.sourceLink }</ExternalLink>
							<div className="maker-credit">
								<span>{ catalog.madeBy }</span>
								<ExternalLink href={ WebsiteLink.AUTHOR }>
									<img src="/images/author-favicon.png" width="28" height="28" alt="" loading="lazy" />
									Agustin Barrientos
								</ExternalLink>
							</div>
						</div>
					</div>
					<div id="languages" hidden={ enhanced }>
						<nav aria-label={ catalog.languageMenuLabel }>
							<ul role="list">
								{ localizations.map( ( option ) => <li key={ option.language }>
									<Anchor href={ option.path } lang={ option.languageTag }
										aria-current={ option.language === localization.language ? 'page' : undefined }>
										{ catalog.languageLabels[ option.language ] }
									</Anchor>
								</li> ) }
							</ul>
						</nav>
					</div>
				</div>
			</footer>
		</div>
	</TocusProvider>;
}
