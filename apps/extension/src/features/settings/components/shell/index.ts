import iconMarkup from '@tocus/theme/icon.svg?raw';
import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { type ProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import '../../../protected-sites/components/screen';
import styles from './web-component-style.scss?inline';
import { SettingsPlatform, type SettingsPlatform as SettingsPlatformValue } from './types';

/**
 * Renders the browser-native settings frame and its active Protected sites destination.
 * @element tocus-f-settings-shell
 * @summary Extension settings shell.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-settings-shell' )
export class ComponentSettingsShell extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Domain editor used by the active Protected sites screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor editor: ProtectionConfigurationEditor | null = null;

	/**
	 * Browser-capability-aware local favicon provider used by the active screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor faviconProvider: SiteFaviconProvider | null = null;

	/**
	 * Browser family whose native settings conventions the shell follows.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true } )
	accessor platform: SettingsPlatformValue = SettingsPlatform.CHROME;

	/**
	 * Renders the single-destination settings layout and forwards local dependencies to its screen.
	 * @return Settings shell template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		return html`
			<div class="settings-layout">
				<aside class="navigation">
					<div class="brand" aria-label="TOCus">
						<span class="brand__icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
						<span class="wordmark">TOCus</span>
					</div>
					<nav aria-label="Settings">
						<a href="#protected-sites" aria-current="page">Protected sites</a>
					</nav>
				</aside>
				<div class="content" id="protected-sites">
					<tocus-f-protected-sites-screen
						.editor=${ this.editor }
						.faviconProvider=${ this.faviconProvider }
					></tocus-f-protected-sites-screen>
				</div>
			</div>
		`;
	}
}

export * from './types';

declare global {
	/**
	 * Maps the settings-shell tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-settings-shell': ComponentSettingsShell;
	}
}
