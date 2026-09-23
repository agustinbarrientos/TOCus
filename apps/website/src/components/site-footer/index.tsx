import { Anchor, Brand } from '@tocus/ui';
import { ExternalLink, WebsiteLink } from '../site-links';
import type { SiteFooterProps } from './types';
import './style.scss';

/**
 * Keeps public-page branding, destinations and language fallback navigation consistent.
 * @param props - Localized website copy and progressive enhancement state.
 * @return Shared public-site footer.
 * @since 1.0.0
 */
export function SiteFooter( props: SiteFooterProps ) {
	const { localization, localizations, enhanced } = props;
	const { catalog } = localization;
	return (
		<footer className="site-footer">
			<div className="page-shell">
				<div className="footer-main">
					<Brand />
					<div className="footer-links">
						<ExternalLink href={ `${ localization.path }privacy/` }>{ catalog.privacyLink }</ExternalLink>
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
	);
}
