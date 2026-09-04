import iconMarkup from '@tocus/theme/icon.svg?raw';
import { LitElement, css, html, unsafeCSS, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import { type ProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import { type PreferencesEditor } from '../../../../domains/preferences/services/preferences-editor';
import {
	Language,
	type Language as LanguageValue,
} from '../../../../domains/preferences/types';
import { type SiteFaviconProvider } from '../../../protected-sites/services/site-favicon-provider';
import { type SitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import '../../../statistics/components/settings-screen';
import {
	type StatisticsSettingsScreenCopy,
	type StatisticsSource,
} from '../../../statistics/components/settings-screen/types';
import '../../../protected-sites/components/screen';
import {
	type ProtectedSitesScreenCopy,
} from '../../../protected-sites/components/screen/types';
import {
	type ProtectedSiteItemCopy,
} from '../../../protected-sites/components/site-item/types';
import '../appearance-screen';
import {
	type AppearanceScreenCopy,
	type PreferencesPreview,
	type PreferencesSource,
} from '../appearance-screen/types';
import '../language-screen';
import {
	type LanguageScreenCopy,
} from '../language-screen/types';
import '../schedule-screen';
import {
	type ScheduleScreenCopy,
} from '../schedule-screen/types';
import '../timing-screen';
import {
	type TimingScreenCopy,
} from '../timing-screen/types';
import styles from './web-component-style.scss?inline';
import {
	SettingsDestination,
	SettingsPlatform,
	type SettingsDestination as SettingsDestinationValue,
	type SettingsPlatform as SettingsPlatformValue,
	type SettingsShellCopy,
} from './types';

/**
 * Resolves one settings URL hash to a supported destination.
 * @param hash - Current window location hash.
 * @return Matching settings destination or Protected sites as the safe default.
 * @since 0.1.0 Initial implementation.
 */
function resolveSettingsDestination( hash: string ): SettingsDestinationValue {
	switch ( hash ) {
		case `#${ SettingsDestination.APPEARANCE }`:
			return SettingsDestination.APPEARANCE;
		case `#${ SettingsDestination.LANGUAGE }`:
			return SettingsDestination.LANGUAGE;
		case `#${ SettingsDestination.SCHEDULE }`:
			return SettingsDestination.SCHEDULE;
		case `#${ SettingsDestination.STATISTICS }`:
			return SettingsDestination.STATISTICS;
		case `#${ SettingsDestination.TIMING }`:
			return SettingsDestination.TIMING;
		default:
			return SettingsDestination.PROTECTED_SITES;
	}
}

/**
 * Renders the browser-native settings frame and active local-settings destination.
 * @element tocus-f-settings-shell
 * @summary Extension settings shell.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-settings-shell' )
export class ComponentSettingsShell extends LitElement {
	/**
	 * Shadow-root styles for the settings shell.
	 * @since 0.1.0 Initial implementation.
	 */
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
	 * Browser permission manager used by the active Protected sites screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor permissionManager: SitePermissionManager | null = null;

	/**
	 * Coordinated local preferences editor used by the active Appearance screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor preferencesEditor: PreferencesEditor | null = null;

	/**
	 * Live preference projection used by the active Appearance screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor preferencesPreview: PreferencesPreview | null = null;

	/**
	 * Validated local preference projections used by the active Appearance screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor preferencesSource: PreferencesSource | null = null;

	/**
	 * Supported language currently derived from the browser UI locale.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor browserLanguage: LanguageValue = Language.ENGLISH;

	/**
	 * Authoritative all-time statistics source used by the Statistics screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor statisticsSource: StatisticsSource | null = null;

	/**
	 * Browser family whose native settings conventions the shell follows.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true } )
	accessor platform: SettingsPlatformValue = SettingsPlatform.CHROME;

	/**
	 * Complete localizable messages rendered by the settings shell.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<SettingsShellCopy>;

	/**
	 * Complete localized messages rendered by the Appearance destination.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor appearanceCopy!: Readonly<AppearanceScreenCopy>;

	/**
	 * Complete localized messages rendered by the Language destination.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor languageCopy!: Readonly<LanguageScreenCopy>;

	/**
	 * Complete localized messages rendered by the Protected Sites destination.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor protectedSitesCopy!: Readonly<ProtectedSitesScreenCopy>;

	/**
	 * Complete localized messages rendered by each protected-site item.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor protectedSiteItemCopy!: Readonly<ProtectedSiteItemCopy>;

	/**
	 * Complete localized messages rendered by the Schedule destination.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor scheduleCopy!: Readonly<ScheduleScreenCopy>;

	/**
	 * Complete localized messages rendered by the Statistics destination.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor statisticsCopy!: Readonly<StatisticsSettingsScreenCopy>;

	/**
	 * Complete localized messages rendered by the Timing destination.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor timingCopy!: Readonly<TimingScreenCopy>;

	/**
	 * Settings destination selected by the current URL hash.
	 * @since 0.1.0 Initial implementation.
	 */
	@state()
	private accessor destination: SettingsDestinationValue = resolveSettingsDestination( window.location.hash );

	/**
	 * Begins observing hash navigation while the shell is connected.
	 * @since 0.1.0 Initial implementation.
	 */
	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener( 'hashchange', this.handleHashChange );
		this.destination = resolveSettingsDestination( window.location.hash );
	}

	/**
	 * Stops observing hash navigation after the shell disconnects.
	 * @since 0.1.0 Initial implementation.
	 */
	override disconnectedCallback(): void {
		window.removeEventListener( 'hashchange', this.handleHashChange );
		super.disconnectedCallback();
	}

	/**
	 * Adopts the destination represented by the current URL hash.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleHashChange = (): void => {
		this.destination = resolveSettingsDestination( window.location.hash );
	};

	/**
	 * Renders the active destination with its local dependencies.
	 * @return Active settings screen.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderDestination(): TemplateResult {
		switch ( this.destination ) {
			case SettingsDestination.APPEARANCE:
				return html`
					<tocus-f-appearance-screen
						.copy=${ this.appearanceCopy }
						.editor=${ this.preferencesEditor }
						.preview=${ this.preferencesPreview }
						.source=${ this.preferencesSource }
					></tocus-f-appearance-screen>
				`;
			case SettingsDestination.LANGUAGE:
				return html`
					<tocus-f-language-screen
						.browserLanguage=${ this.browserLanguage }
						.copy=${ this.languageCopy }
						.editor=${ this.preferencesEditor }
						.preview=${ this.preferencesPreview }
						.source=${ this.preferencesSource }
					></tocus-f-language-screen>
				`;
			case SettingsDestination.SCHEDULE:
				return html`
					<tocus-f-schedule-screen
						.copy=${ this.scheduleCopy }
						.editor=${ this.editor }
					></tocus-f-schedule-screen>
				`;
			case SettingsDestination.STATISTICS:
				return html`
					<tocus-f-statistics-settings-screen
						.copy=${ this.statisticsCopy }
						.source=${ this.statisticsSource }
					></tocus-f-statistics-settings-screen>
				`;
			case SettingsDestination.TIMING:
				return html`
					<tocus-f-timing-screen
						.copy=${ this.timingCopy }
						.editor=${ this.editor }
					></tocus-f-timing-screen>
				`;
			default:
				return html`
					<tocus-f-protected-sites-screen
						.copy=${ this.protectedSitesCopy }
						.editor=${ this.editor }
						.faviconProvider=${ this.faviconProvider }
						.permissionManager=${ this.permissionManager }
						.siteItemCopy=${ this.protectedSiteItemCopy }
					></tocus-f-protected-sites-screen>
				`;
		}
	}

	/**
	 * Renders settings navigation and forwards local dependencies to the active screen.
	 * @return Settings shell template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady(
			this.copy,
			this.appearanceCopy,
			this.languageCopy,
			this.protectedSitesCopy,
			this.protectedSiteItemCopy,
			this.scheduleCopy,
			this.statisticsCopy,
			this.timingCopy,
		) ) {
			return html``;
		}
		return html`
			<div class="settings-layout">
				<aside class="navigation">
					<div class="brand" aria-label="TOCus">
						<span class="brand__icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
						<span class="wordmark">TOCus</span>
					</div>
					<nav aria-label=${ this.copy.navigationLabel }>
						<a
							href="#protected-sites"
							aria-current=${ ifDefined(
								this.destination === SettingsDestination.PROTECTED_SITES ? 'page' : undefined,
							) }
						>${ this.copy.protectedSites }</a>
						<a
							href="#schedule"
							aria-current=${ ifDefined(
								this.destination === SettingsDestination.SCHEDULE ? 'page' : undefined,
							) }
						>${ this.copy.schedule }</a>
						<a
							href="#timing"
							aria-current=${ ifDefined(
								this.destination === SettingsDestination.TIMING ? 'page' : undefined,
							) }
						>${ this.copy.timing }</a>
						<a
							href="#appearance"
							aria-current=${ ifDefined(
								this.destination === SettingsDestination.APPEARANCE ? 'page' : undefined,
							) }
							>${ this.copy.appearance }</a>
						<a
							href="#language"
							aria-current=${ ifDefined(
								this.destination === SettingsDestination.LANGUAGE ? 'page' : undefined,
							) }
						>${ this.copy.language }</a>
						<a
							href="#statistics"
							aria-current=${ ifDefined(
								this.destination === SettingsDestination.STATISTICS ? 'page' : undefined,
							) }
						>${ this.copy.statistics }</a>
					</nav>
				</aside>
				<div class="content" id=${ this.destination }>
					${ this.renderDestination() }
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
