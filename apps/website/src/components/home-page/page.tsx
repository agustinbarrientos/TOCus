import { useEffect, useRef, useState } from 'react';
import { Anchor, Brand, TocusAppearance, TocusProvider } from '@tocus/ui';
import { DownloadLink, DownloadLinks } from '../download-links';
import { ExternalLink, WebsiteLink } from '../site-links';
import { ProductStory } from '../product-story';
import { DemoChapter } from '../product-demo/types';
import { StatisticsPreview } from '../statistics-preview';
import { TimingIllustration } from '../timing-illustration';
import { Mascot } from '../mascot';
import { LanguageMenu } from '../language-menu';
import { SupportedServices } from '../supported-services';
import { createStoryMotion } from '../../services/story-motion';
import { createHomepageMotion } from '../../services/homepage-motion';
import type { HomePageProps } from './types';

/**
 * Introduces TOCus through one scroll-driven browser and factual product sections.
 * @param props - Current locale, routes and packaged product messages.
 * @return Progressively enhanced website without visitor tracking.
 * @since 0.1.0
 */
export default function HomePage( props: HomePageProps ) {
	const { localization, localizations, demoMessages } = props;
	const { catalog } = localization;
	const scene = useRef<HTMLDivElement>( null );
	const [ chapter, setChapter ] = useState<DemoChapter>( DemoChapter.CHOOSE );
	const [ progress, setProgress ] = useState( 0 );
	const [ enhanced, setEnhanced ] = useState( false );
	useEffect( () => {
		setEnhanced( true );
		if ( scene.current !== null ) {
			const stopStory = createStoryMotion( scene.current, setChapter, setProgress );
			const stopMotion = createHomepageMotion( scene.current );
			return () => {
				stopStory();
				stopMotion();
			};
		}
	}, [] );
	return <TocusProvider appearance={ TocusAppearance.LIGHT }>
		<div className="website homepage" ref={ scene } data-enhanced={ enhanced }>
			<Anchor className="skip-link" href="#main-content">{ catalog.skipLink }</Anchor>
			<div className="page-shell">
				<header className="site-header">
					<Brand />
					<DownloadLink label={ catalog.getExtension } />
				</header>
				<main id="main-content" tabIndex={ -1 }>
					<section className="hero" aria-labelledby="page-title">
						<div className="hero-copy">
							<h1 id="page-title">{ catalog.intro }</h1>
							<p className="description">{ catalog.description }</p>
							<div className="hero-actions">
								<DownloadLinks label={ catalog.downloadFor } alsoAvailable={ catalog.alsoAvailable } />
							</div>
						</div>
						<div className="hero-art"><Mascot alt={ catalog.mascotAlt } /></div>
					</section>
					<ProductStory catalog={ catalog } languageTag={ localization.languageTag }
						messages={ demoMessages } chapter={ chapter } progress={ progress } enhanced={ enhanced } />
					<section className="settings-overview website-section" id="settings" aria-labelledby="settings-title">
						<div className="section-heading" data-story-reveal>
							<h2 id="settings-title">{ catalog.settingsTitle }</h2>
							<p>{ catalog.timingDescription }</p>
						</div>
						<TimingIllustration catalog={ catalog } />
						<div className="feature-strip">
							<div><h3>{ catalog.scheduleTitle }</h3><p>{ catalog.scheduleDescription }</p></div>
							<div><h3>{ catalog.sitesTitle }</h3><p>{ catalog.sitesDescription }</p></div>
						</div>
						<div className="media-feature">
							<div><h3>{ catalog.mediaTitle }</h3><p>{ catalog.mediaDescription }</p></div>
							<SupportedServices />
						</div>
					</section>
					<section className="statistics-section website-section" id="statistics" aria-labelledby="statistics-title">
						<div className="section-heading" data-story-reveal>
							<h2 id="statistics-title">{ catalog.statisticsTitle }</h2>
							<p>{ catalog.statisticsDescription }</p>
						</div>
						<StatisticsPreview languageTag={ localization.languageTag }
							messages={ demoMessages } label={ catalog.exampleData } />
					</section>
					<section className="privacy-section website-section" id="privacy" aria-labelledby="privacy-title">
						<div className="privacy-statement" data-story-reveal>
							<h2 id="privacy-title">{ catalog.privacyTitle }</h2>
							<ul role="list" className="privacy-facts">
								<li>{ catalog.privacyAccounts }</li>
								<li>{ catalog.privacyTracking }</li>
								<li>{ catalog.privacyCalls }</li>
							</ul>
						</div>
						<div className="privacy-copy">
							<h3>{ catalog.privacyLocal }</h3>
							<p>{ catalog.privacy }</p>
							<Anchor href="/privacy/" underline="always">{ catalog.readPrivacy }</Anchor>
						</div>
					</section>
					<section className="open-source website-section" aria-labelledby="open-title" data-story-reveal>
						<div>
							<h2 id="open-title">{ catalog.openSourceTitle }</h2>
							<p>{ catalog.openSourceDescription }</p>
							<ExternalLink href={ WebsiteLink.SOURCE }>{ catalog.sourceShort }</ExternalLink>
						</div>
						<div className="maker-story">
							<p>{ catalog.creatorStory }</p>
							<div className="maker-credit">
								<span>{ catalog.madeBy }</span>
								<ExternalLink href={ WebsiteLink.AUTHOR }>
									<img src="/images/author-favicon.png" width="28" height="28" alt="" />Agustin Barrientos
								</ExternalLink>
							</div>
						</div>
					</section>
					<section className="download-section" id="downloads" aria-labelledby="download-title">
						<h2 id="download-title">{ catalog.downloadTitle }</h2>
						<DownloadLinks label={ catalog.downloadFor } alsoAvailable={ catalog.alsoAvailable } />
						<div className="footer-mascot"><Mascot alt="" loading="lazy" /></div>
					</section>
				</main>
				<footer className="site-footer">
					<div className="footer-main">
						<Brand />
						<div className="footer-links">
							<Anchor href="/privacy/" underline="always">{ catalog.privacyLink }</Anchor>
							<Anchor href="/support/" underline="always">{ catalog.supportLink }</Anchor>
							<ExternalLink href={ WebsiteLink.SOURCE }>{ catalog.sourceShort }</ExternalLink>
						</div>
					</div>
					<div id="languages">
						{ enhanced && <LanguageMenu localization={ localization } localizations={ localizations } /> }
						<nav aria-label={ catalog.languageMenuLabel } hidden={ enhanced }>
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
				</footer>
			</div>
		</div>
	</TocusProvider>;
}
