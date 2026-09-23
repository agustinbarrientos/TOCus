import { useEffect, useState } from 'react';
import { Anchor, TocusAppearance, TocusProvider } from '@tocus/ui';
import { SiteHeader } from '../site-header';
import { SiteFooter } from '../site-footer';
import { ExternalLink, WebsiteLink } from '../site-links';
import {
	InformationExternalUrl,
	type LocalizedInformationPageProperties,
	type PrivacyContentProperties,
} from './types';

/**
 * Renders the canonical privacy statement for the current local-first extension behavior.
 * @param properties - Translated document copy.
 * @param properties.catalog - Complete selected-language privacy catalog.
 * @return Readable privacy sections with explicit product and website boundaries.
 * @since 1.0.0 Initial implementation.
 */
function PrivacyContent( { catalog }: PrivacyContentProperties ) {
	return <>
		<header className="information-page-introduction">
			<h1 id="page-title">{ catalog.title }</h1>
			<p className="information-page-reviewed">{ catalog.reviewed }</p>
		</header>
		<section className="privacy-group" id="the-extension" aria-labelledby="the-extension-title">
			<h2 id="the-extension-title">{ catalog.extensionTitle }</h2>
			<section id="extension-data" aria-labelledby="extension-data-title">
				<h3 id="extension-data-title">{ catalog.dataTitle }</h3>
				<p>{ catalog.everything }</p>
				<p>{ catalog.dataIncludes }</p>
				<p>{ catalog.statistics }</p>
				<p>{ catalog.offline }</p>
				<p>{ catalog.temporaryAddress }</p>
				<p>{ catalog.verify }{' '}<ExternalLink href={ WebsiteLink.SOURCE }>{ catalog.source }</ExternalLink></p>
			</section>
			<section id="permissions" aria-labelledby="permissions-title">
				<h3 id="permissions-title">{ catalog.permissionsTitle }</h3>
				<p>{ catalog.siteAccess }</p>
				<p>{ catalog.toolbarAccess }</p>
				<p>{ catalog.navigationAccess }</p>
				<p>{ catalog.localStorage }</p>
				<p>{ catalog.icons }</p>
				<p>{ catalog.missingAccess }</p>
			</section>
			<section id="deletion" aria-labelledby="deletion-title">
				<h3 id="deletion-title">{ catalog.deletionTitle }</h3>
				<p>{ catalog.deletion }</p>
				<p>{ catalog.resetMarker }</p>
			</section>
			<section id="limited-use" aria-labelledby="limited-use-title">
				<h3 id="limited-use-title">{ catalog.limitedUseTitle }</h3>
				<p>{ catalog.limitedUseBefore }{' '}
					<ExternalLink href={ InformationExternalUrl.CHROME_LIMITED_USE }>
						{ catalog.limitedUseLink }
					</ExternalLink>
					{ catalog.limitedUseAfter }
				</p>
			</section>
		</section>
		<section className="privacy-group" id="this-site" aria-labelledby="this-site-title">
			<h2 id="this-site-title">{ catalog.siteTitle }</h2>
			<section id="website-and-links" aria-labelledby="website-and-links-title">
				<h3 id="website-and-links-title">{ catalog.websiteTitle }</h3>
				<p>{ catalog.websiteRequests }</p>
				<p>{ catalog.externalLinks }</p>
			</section>
			<section id="website-analytics" aria-labelledby="website-analytics-title">
				<h3 id="website-analytics-title">{ catalog.analyticsTitle }</h3>
				<p>{ catalog.analyticsDescription }</p>
				<p>{ catalog.analyticsBoundary }</p>
				<p><ExternalLink href={ InformationExternalUrl.GOOGLE_DATA_USE }>
					{ catalog.analyticsLink }
				</ExternalLink></p>
			</section>
		</section>
	</>;
}

/**
 * Renders one canonical information document in the shared public-site shell.
 * @param properties - Translated document and navigation copy.
 * @return Server-rendered information page.
 * @since 1.0.0 Initial implementation.
 */
export default function InformationPage( properties: LocalizedInformationPageProperties ) {
	const [ enhanced, setEnhanced ] = useState( false );
	useEffect( () => {
		setEnhanced( true );
	}, [] );

	return (
		<TocusProvider appearance={ TocusAppearance.LIGHT }>
			<div className="website information-website" data-enhanced={ enhanced }>
				<Anchor className="skip-link" href="#main-content">{ properties.localization.catalog.skipLink }</Anchor>
				<SiteHeader { ...properties } enhanced={ enhanced } />
				<div className="page-shell information-shell">
					<main className="information-page" id="main-content" aria-labelledby="page-title" tabIndex={ -1 }>
						<PrivacyContent catalog={ properties.privacyCatalog } />
					</main>
				</div>
				<SiteFooter { ...properties } enhanced={ enhanced } />
			</div>
		</TocusProvider>
	);
}
