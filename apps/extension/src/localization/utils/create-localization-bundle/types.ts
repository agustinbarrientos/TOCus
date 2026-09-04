import type { Language } from '../../../domains/preferences/types';
import type {
	DurationUnitMessageCatalog,
	InterruptionMessageCatalog,
	LocalizationCatalog,
	ProtectedPageLayerMessageCatalog,
	ToolbarMessageCatalog,
	WellbeingMessageCatalog,
} from '../../catalogs/types';
import type { InterruptionScreenCopy } from '../../../features/interruption/components/screen/types';
import type { ProtectedPageLayerCopy } from '../../../features/interruption/components/protected-page-layer/types';
import type { PopupShellCopy } from '../../../features/popup/components/shell/types';
import type { ProtectedSiteItemCopy } from '../../../features/protected-sites/components/site-item/types';
import type { ProtectedSiteListCopy } from '../../../features/protected-sites/components/site-list/types';
import type { ProtectedSitesScreenCopy } from '../../../features/protected-sites/components/screen/types';
import type { ToolbarBadgeCopy } from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import type { AppearanceScreenCopy } from '../../../features/settings/components/appearance-screen/types';
import type { LanguageScreenCopy } from '../../../features/settings/components/language-screen/types';
import type { ScheduleScreenCopy } from '../../../features/settings/components/schedule-screen/types';
import type { SettingsShellCopy } from '../../../features/settings/components/shell/types';
import type { TimingScreenCopy } from '../../../features/settings/components/timing-screen/types';
import type { StatisticsSettingsScreenCopy } from '../../../features/statistics/components/settings-screen/types';
import type { WellbeingSummaryCopy } from '../../../features/statistics/utils/format-wellbeing-summary/types';

/**
 * Localized browser-document titles owned by extension entrypoints.
 * @since 0.1.0 Initial implementation.
 */
export interface DocumentCopy {
	interruptionTitle: string;
	popupTitle: string;
	settingsTitle: string;
}

/**
 * Complete typed copy bundle consumed by extension composition roots.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationBundle {
	language: Language;
	languageTag: string;
	document: Readonly<DocumentCopy>;
	popup: Readonly<PopupShellCopy>;
	settingsShell: Readonly<SettingsShellCopy>;
	languageScreen: Readonly<LanguageScreenCopy>;
	appearance: Readonly<AppearanceScreenCopy>;
	schedule: Readonly<ScheduleScreenCopy>;
	timing: Readonly<TimingScreenCopy>;
	protectedSites: Readonly<ProtectedSitesScreenCopy>;
	protectedSiteList: Readonly<ProtectedSiteListCopy>;
	protectedSiteItem: Readonly<ProtectedSiteItemCopy>;
	statistics: Readonly<StatisticsSettingsScreenCopy>;
	interruption: Readonly<InterruptionScreenCopy>;
	protectedPageLayer: Readonly<ProtectedPageLayerCopy>;
	wellbeing: Readonly<WellbeingSummaryCopy>;
	toolbar: Readonly<ToolbarBadgeCopy>;
}

/**
 * Asynchronous packaged-catalog boundary used by the localization bundle loader.
 * @since 0.1.0 Initial implementation.
 */
export type LocalizationCatalogLoader = (
	language: Language,
) => Promise<LocalizationCatalog>;

/**
 * Minimal translator catalog projection needed by toolbar badge formatting.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarLocalizationCatalog {
	toolbar: ToolbarMessageCatalog;
	units: DurationUnitMessageCatalog;
}

/**
 * Minimal translator catalog projection needed by an injected protected page.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLocalizationCatalog {
	interruption: InterruptionMessageCatalog;
	protectedPageLayer: ProtectedPageLayerMessageCatalog;
	wellbeing: WellbeingMessageCatalog;
	units: DurationUnitMessageCatalog;
}

/**
 * Named localized values substituted into one complete catalog template.
 * @since 0.1.0 Initial implementation.
 */
export interface TemplateVariables {
	readonly [ name: string ]: string;
}

/**
 * Reusable locale-sensitive ECMA-402 formatters for one bundle.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationFormatters {
	number: Intl.NumberFormat;
	plural: Intl.PluralRules;
	list: Intl.ListFormat;
	collator: Intl.Collator;
}
