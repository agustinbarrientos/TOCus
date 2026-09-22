import { useEffect, useRef, useState } from 'react';
import { Anchor, Brand, TocusAppearance, TocusProvider } from '@tocus/ui';
import { DownloadLink, DownloadLinks } from '../download-links';
import { ExternalLink, WebsiteLink } from '../site-links';
import { ProductStory } from '../product-story';
import { TimingIllustration } from '../timing-illustration';
import { StatisticsPreview } from '../statistics-preview';
import { Mascot } from '../mascot';
import { LanguageMenu } from '../language-menu';
import { SupportedServices } from '../supported-services';
import type { HomePageProps } from './types';

/**
 * Introduces TOCus through an interactive illustration and independently playable demonstration.
 * @param props - Current locale, routes and packaged product messages.
 * @return Progressively enhanced website without visitor tracking.
 * @since 0.1.0
 */
export default function HomePage( props: HomePageProps ) {
	const { localization, localizations, statisticsFormatting } = props;
	const { catalog } = localization;
	const scene = useRef<HTMLDivElement>( null );
	const [ enhanced, setEnhanced ] = useState( false );
	useEffect( () => {
		setEnhanced( true );
	}, [] );
	return <TocusProvider appearance={ TocusAppearance.LIGHT }>
		<div className="website homepage" ref={ scene } data-enhanced={ enhanced }>
			<Anchor className="skip-link" href="#main-content">{ catalog.skipLink }</Anchor>
			<div className="page-shell">
				<header className="site-header">
					<Brand />
					<div className="site-header-actions">
						<DownloadLink label={ catalog.getExtension } comingSoon={ catalog.comingSoon } />
						{ enhanced && <LanguageMenu localization={ localization } localizations={ localizations } /> }
					</div>
				</header>
				<main id="main-content" tabIndex={ -1 }>
					<section className="hero" aria-labelledby="page-title">
						<div className="hero-copy">
							<h1 id="page-title">{ catalog.intro }</h1>
							<p className="description">{ catalog.description }</p>
							<div className="hero-actions">
								<DownloadLinks label={ catalog.downloadFor } alsoAvailable={ catalog.alsoAvailable }
									comingSoon={ catalog.comingSoon } />
							</div>
						</div>
						<div className="hero-art"><Mascot alt={ catalog.mascotAlt }
							interactionLabel={ catalog.mascotInteractionLabel } /></div>
					</section>
					<ProductStory catalog={ catalog } enhanced={ enhanced } />
					<section className="settings-overview website-section" id="settings" aria-labelledby="settings-title">
						<div className="section-heading" data-story-reveal>
							<h2 id="settings-title">{ catalog.settingsTitle }</h2>
							<p>{ catalog.timingDescription }</p>
						</div>
						<TimingIllustration catalog={ catalog } />
						<ul className="feature-strip" role="list">
							<li><h3>{ catalog.scheduleTitle }</h3><p>{ catalog.scheduleDescription }</p></li>
							<li><h3>{ catalog.sitesTitle }</h3><p>{ catalog.sitesDescription }</p></li>
							<li><h3>{ catalog.mediaTitle }</h3><p>{ catalog.mediaDescription }</p>
								<SupportedServices />
							</li>
						</ul>
					</section>
					<section className="statistics-section website-section" id="statistics" aria-labelledby="statistics-title">
						<div className="section-heading" data-story-reveal>
							<h2 id="statistics-title">{ catalog.statisticsTitle }</h2>
							<p>{ catalog.statisticsDescription }</p>
						</div>
						<StatisticsPreview languageTag={ localization.languageTag } catalog={ catalog }
							formatting={ statisticsFormatting } />
					</section>
					<section className="privacy-section website-section" id="privacy" aria-labelledby="privacy-title">
						<div className="section-heading">
							<h2 id="privacy-title">{ catalog.privacyTitle }</h2>
						</div>
						<div className="privacy-statement">
							<div className="privacy-copy">
								<h3>{ catalog.privacyLocal }</h3>
								<div className="privacy-body">
									<p>{ catalog.privacy }</p>
									<p>{ catalog.privacyAccounts } { catalog.privacyTracking }{ ' ' }
										{ catalog.privacyCalls }</p>
								</div>
								<Anchor href="/privacy/" underline="always">{ catalog.readPrivacy }</Anchor>
							</div>
							<div className="privacy-copy">
								<h3 id="open-title">{ catalog.openSourceTitle }</h3>
								<div className="privacy-body">
									<p>{ catalog.openSourceDescription }</p>
									<p>{ catalog.privacyAdvertising }</p>
								</div>
								<ExternalLink href={ WebsiteLink.SOURCE }>{ catalog.sourceShort }</ExternalLink>
								<div className="maker-credit">
									<span>{ catalog.madeBy }</span>
									<ExternalLink href={ WebsiteLink.AUTHOR }>
										<img src="/images/author-favicon.png" width="28" height="28" alt="" />Agustin Barrientos
									</ExternalLink>
								</div>
							</div>
						</div>
					</section>
					<section className="download-section" id="downloads" aria-labelledby="download-title">
						<h2 id="download-title">{ catalog.downloadTitle }</h2>
						<DownloadLinks label={ catalog.downloadFor } alsoAvailable={ catalog.alsoAvailable }
							comingSoon={ catalog.comingSoon } />
						<div className="footer-mascot"><img data-mascot src="/images/mascot-peek.webp"
							width="1144" height="1145" alt="" loading="lazy" /></div>
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
				</footer>
			</div>
		</div>
	</TocusProvider>;
}
