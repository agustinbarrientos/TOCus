import iconMarkup from '@tocus/theme/icon.svg?raw';
import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import { type AboutScreenCopy } from './types';
import styles from './web-component-style.scss?inline';

/**
 * Displays the installed version, project license, and contribution resources.
 * @element tocus-f-about-screen
 * @summary About settings screen.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-about-screen' )
export class ComponentAboutScreen extends LitElement {
	/**
	 * Shadow-root styles for the About settings screen.
	 * @since 0.1.0 Initial implementation.
	 */
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Complete localized messages rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<AboutScreenCopy>;

	/**
	 * Installed extension version supplied by the browser manifest.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor version = '';

	/**
	 * Renders local project information and user-initiated external links.
	 * @return About settings template or an empty template until localization is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}

		return html`
			<main aria-labelledby="about-title">
				<header>
					<p class="eyebrow">${ this.copy.eyebrow }</p>
					<div class="identity">
						<span class="brand-icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
						<h1 id="about-title">TOCus</h1>
					</div>
					${ this.version === '' ? null : html`<p class="version">${ this.copy.formatVersion( this.version ) }</p>` }
				</header>
				<section aria-labelledby="story-title">
					<h2 id="story-title">${ this.copy.storyTitle }</h2>
					<a class="creator" href="https://agustinbarrientos.com/about/?utm_source=tocus&amp;utm_medium=extension&amp;utm_campaign=about" target="_blank" rel="noopener noreferrer" aria-describedby="external-links-hint">${ this.copy.creator }</a>
					<p class="summary">${ this.copy.summary }</p>
				</section>
				<section aria-labelledby="privacy-title">
					<h2 id="privacy-title">${ this.copy.privacyTitle }</h2>
					<p class="description">${ this.copy.privacyDescription }</p>
				</section>
				<section aria-labelledby="links-title">
					<h2 id="links-title">${ this.copy.linksTitle }</h2>
					<p class="description">${ this.copy.linksDescription }</p>
					<p class="description">${ this.copy.forkDescription }</p>
					<ul class="links" aria-describedby="external-links-hint">
						<li>
							<a href="https://github.com/agustinbarrientos/TOCus" target="_blank" rel="noopener noreferrer">${ this.copy.sourceCode }</a>
						</li>
						<li>
							<a href="https://github.com/agustinbarrientos/TOCus/issues/new?template=feature_request.yml" target="_blank" rel="noopener noreferrer">${ this.copy.suggestChanges }</a>
						</li>
						<li>
							<a href="https://github.com/agustinbarrientos/TOCus/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">${ this.copy.contribute }</a>
						</li>
						<li>
							<a href="https://github.com/agustinbarrientos/TOCus/fork" target="_blank" rel="noopener noreferrer">${ this.copy.fork }</a>
						</li>
						<li>
							<a href="https://github.com/agustinbarrientos/TOCus/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">${ this.copy.license }</a>
						</li>
					</ul>
					<p class="external-hint" id="external-links-hint">${ this.copy.externalLinksHint }</p>
				</section>
			</main>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the About-screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-about-screen': ComponentAboutScreen;
	}
}
