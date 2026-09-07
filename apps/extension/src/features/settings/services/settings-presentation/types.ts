import { Language } from '../../../../domains/preferences/types';
import { SettingsPlatform } from '../../components/shell/types';
import type { SettingsPageShell } from '../settings-page/types';

/**
 * Declares the page service's two-phase initialization without fabricating localized copy.
 * The controller assigns every copy field before the readiness check permits a React render.
 * Class fields remain enumerable so the shared presentation port can observe their later assignments.
 * @since 0.1.0
 */
export class SettingsPresentationState implements SettingsPageShell {
	/** About copy supplied by the controller's first complete localization snapshot. */
	aboutCopy!: SettingsPageShell['aboutCopy'];

	/** Installed version supplied during page bootstrap. */
	aboutVersion = '';

	/** Appearance copy supplied before first render. */
	appearanceCopy!: SettingsPageShell['appearanceCopy'];

	/** Browser-derived language, replaced by bootstrap before Settings becomes visible. */
	browserLanguage: SettingsPageShell['browserLanguage'] = Language.ENGLISH;

	/** Navigation copy supplied before first render. */
	copy!: SettingsPageShell['copy'];

	/** Background-safe protection editor attached by bootstrap. */
	editor: SettingsPageShell['editor'] = null;

	/** Browser-local favicon provider attached by bootstrap. */
	faviconProvider: SettingsPageShell['faviconProvider'] = null;

	/** Language copy supplied before first render. */
	languageCopy!: SettingsPageShell['languageCopy'];

	/** Browser host-access service attached by bootstrap. */
	permissionManager: SettingsPageShell['permissionManager'] = null;

	/** Browser platform selected by the entrypoint service. */
	platform: SettingsPageShell['platform'] = SettingsPlatform.CHROME;

	/** Persistent preferences editor attached by bootstrap. */
	preferencesEditor: SettingsPageShell['preferencesEditor'] = null;

	/** Reversible draft-appearance preview supplied by bootstrap. */
	preferencesPreview: SettingsPageShell['preferencesPreview'] = null;

	/** Authoritative preferences reader supplied by bootstrap. */
	preferencesSource: SettingsPageShell['preferencesSource'] = null;

	/** Explicit background data-reset operations supplied by bootstrap. */
	privacyActions: SettingsPageShell['privacyActions'] = null;

	/** Privacy copy supplied before first render. */
	privacyCopy!: SettingsPageShell['privacyCopy'];

	/** Protected-site row copy supplied before first render. */
	protectedSiteItemCopy!: SettingsPageShell['protectedSiteItemCopy'];

	/** Protected-sites page copy supplied before first render. */
	protectedSitesCopy!: SettingsPageShell['protectedSitesCopy'];

	/** Schedule copy supplied before first render. */
	scheduleCopy!: SettingsPageShell['scheduleCopy'];

	/** Statistics copy supplied before first render. */
	statisticsCopy!: SettingsPageShell['statisticsCopy'];

	/** Authoritative statistics reader supplied by bootstrap. */
	statisticsSource: SettingsPageShell['statisticsSource'] = null;

	/** Whether the current browser provides local favicon-cache access. */
	supportsCachedFavicons = false;

	/** Timing copy supplied before first render. */
	timingCopy!: SettingsPageShell['timingCopy'];

	/** Enumerable operation forwarded to the currently mounted Protected Sites destination. */
	refreshAccessState: SettingsPageShell['refreshAccessState'];

	/**
	 * Retains a live access bridge while the controller fills the declared copy and service fields.
	 * @param refreshAccessState - Operation forwarding access refresh to the active destination.
	 * @since 0.1.0
	 */
	constructor( refreshAccessState: SettingsPageShell['refreshAccessState'] ) {
		this.refreshAccessState = refreshAccessState;
	}
}
