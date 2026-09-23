import { Anchor, Brand } from '@tocus/ui';
import { LanguageMenu } from '../language-menu';
import type { SiteHeaderProps } from './types';

/**
 * Shares the logo and language selector across landing and information pages.
 * @param props - Localized navigation and optional hero overlay placement.
 * @return Consistent site header with a home link on information pages.
 * @since 1.0.0
 */
export function SiteHeader( props: SiteHeaderProps ) {
	return <header className={ `site-header page-shell${ props.overlayHero ? ' hero-header' : '' }` }>
		{ props.overlayHero ? <Brand /> : <Anchor className="site-brand-link" aria-label="TOCus home" href="/">
			<Brand />
		</Anchor> }
		<div className="site-header-actions">
			{ props.enhanced && <LanguageMenu localization={ props.localization }
				localizations={ props.localizations } /> }
		</div>
	</header>;
}
