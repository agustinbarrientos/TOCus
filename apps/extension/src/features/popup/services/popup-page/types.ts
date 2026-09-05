import { type Language } from '../../../../domains/preferences/types';
import { type LocalizationBundle } from '../../../../localization';
import {
	type PreferencesAppearanceTarget,
	type PreferencesLanguageChangeListener,
} from '../../../preferences/services/preferences-controller';
import { type ProtectedSiteEnrollmentResult } from '../../../protected-sites/services/protected-site-enrollment';
import {
	type SiteFaviconProvider,
	type SiteFaviconSource,
} from '../../../protected-sites/services/site-favicon-provider';
import { type PopupShellCopy, type PopupOperationError } from '../../components/shell/types';
import { type PopupCurrentTabContext } from '../../types/current-tab-context';
import { type PopupProjection } from '../../types/popup-projection';

/**
 * Reads the current popup invocation's minimal active-tab context.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageCurrentTabReader {
	/**
	 * Reads current top-level tab identity without retaining it beyond the popup lifetime.
	 * @return Current tab metadata or null when unavailable.
	 * @since 0.1.0 Initial implementation.
	 */
	read(): Promise<PopupCurrentTabContext | null>;
}

/**
 * Enrolls the current website from a direct popup user gesture.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageEnrollmentService {
	/**
	 * Adds one current website to the default shared timing scope.
	 * @param input - Current tab URL supplied directly by the page coordinator.
	 * @param independent - Whether the website receives independent timing.
	 * @return Exact protected-site enrollment outcome.
	 * @since 0.1.0 Initial implementation.
	 */
	add( input: unknown, independent: boolean ): Promise<ProtectedSiteEnrollmentResult>;
}

/**
 * Loads packaged popup copy for one supported language.
 * @since 0.1.0 Initial implementation.
 */
export type PopupPageLocalizationLoader = (
	language: Language,
) => Promise<Readonly<LocalizationBundle>>;

/**
 * Live preference lifecycle required by the popup page.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPagePreferencesController {
	/** Current browser-derived or explicitly selected language. */
	readonly language: Language;

	/**
	 * Begins delivering effective language changes.
	 * @param listener - Listener receiving each new effective language.
	 * @since 0.1.0 Initial implementation.
	 */
	addLanguageChangeListener( listener: PreferencesLanguageChangeListener ): void;

	/**
	 * Stops delivering effective language changes.
	 * @param listener - Previously registered language listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeLanguageChangeListener( listener: PreferencesLanguageChangeListener ): void;

	/**
	 * Loads preferences and begins observing local changes.
	 * @return Promise resolved after initial preferences settle.
	 * @since 0.1.0 Initial implementation.
	 */
	start(): Promise<void>;

	/**
	 * Stops every preference observer owned by the popup.
	 * @since 0.1.0 Initial implementation.
	 */
	stop(): void;
}

/**
 * Authoritative popup status operations.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageStatusClient {
	/**
	 * Reads the current semantic popup projection.
	 * @param currentTab - Ephemeral current-tab metadata.
	 * @return Current authoritative popup projection.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatus( currentTab: PopupCurrentTabContext | null ): Promise<PopupProjection>;

	/**
	 * Reconciles protection before reading a fresh popup projection.
	 * @param currentTab - Ephemeral current-tab metadata.
	 * @return Refreshed authoritative popup projection.
	 * @since 0.1.0 Initial implementation.
	 */
	refreshStatus( currentTab: PopupCurrentTabContext | null ): Promise<PopupProjection>;
}

/**
 * Popup shell state and events coordinated by the page service.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageShell extends EventTarget {
	/** Whether current-site enrollment is pending. */
	adding: boolean;
	/** Complete localized popup copy. */
	copy: Readonly<PopupShellCopy> | null;
	/** Local cached favicon source for the current website. */
	faviconSource: SiteFaviconSource;
	/** Wall-clock instant used to display allowance countdowns. */
	nowEpochMilliseconds: number;
	/** Recoverable current-site enrollment error. */
	operationError: PopupOperationError | null;
	/** Current semantic popup projection. */
	projection: PopupProjection | null;
	/** Whether a user-requested status recovery is pending. */
	retrying: boolean;
	/** Packaged Settings destination. */
	settingsPageUrl: string;
	/** Packaged Statistics destination. */
	statisticsPageUrl: string;

	/**
	 * Focuses current-site management after successful enrollment.
	 * @return Promise resolved after the action receives focus when rendered.
	 * @since 0.1.0 Initial implementation.
	 */
	focusManageAction(): Promise<void>;

	/**
	 * Restores focus after a recovery result replaces or re-enables its trigger.
	 * @return Promise resolved after the best available target receives focus.
	 * @since 0.1.0 Initial implementation.
	 */
	focusAfterRetry(): Promise<void>;
}

/**
 * Popup document root hidden until initial state is coherent.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageDocumentElement extends PreferencesAppearanceTarget {
	/** Inline startup properties removed when the popup is ready. */
	style: Pick<CSSStyleDeclaration, 'removeProperty'>;
}

/**
 * Browser document surface owned by the popup.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageDocument {
	/** Root receiving appearance, language, and visibility state. */
	documentElement: PopupPageDocumentElement;
	/** Localized popup browser-document title. */
	title: string;
}

/**
 * Popup lifecycle and interval boundary.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageWindow {
	/**
	 * Registers popup lifecycle cleanup.
	 * @param type - Popup dismissal event name.
	 * @param listener - Cleanup listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addEventListener( type: 'pagehide', listener: EventListener ): void;

	/**
	 * Cancels one popup-owned interval.
	 * @param intervalId - Browser interval identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	clearInterval( intervalId: number ): void;

	/**
	 * Removes popup lifecycle cleanup.
	 * @param type - Popup dismissal event name.
	 * @param listener - Previously registered cleanup listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeEventListener( type: 'pagehide', listener: EventListener ): void;

	/**
	 * Starts one local allowance display interval.
	 * @param handler - Callback invoked for each visible countdown update.
	 * @param timeout - Interval duration in milliseconds.
	 * @return Browser interval identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	setInterval( handler: () => void, timeout: number ): number;
}

/**
 * Dependencies required by the popup page coordinator.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupPageOptions {
	/** Minimal active-tab reader backed only by activeTab. */
	currentTabReader: PopupPageCurrentTabReader;
	/** Popup document receiving appearance and localization. */
	document: PopupPageDocument;
	/** Permission-aware current-site enrollment. */
	enrollment: PopupPageEnrollmentService;
	/** Packaged English fallback used only after terminal startup failure. */
	fallbackLocalization: Readonly<LocalizationBundle>;
	/** Browser-capability-aware local favicon provider. */
	faviconProvider: SiteFaviconProvider;
	/** Packaged localization loader. */
	loadLocalization: PopupPageLocalizationLoader;
	/** Returns current wall-clock epoch time. */
	now: () => number;
	/** Popup lifecycle and countdown boundary. */
	pageWindow: PopupPageWindow;
	/** Live local preferences projection. */
	preferencesController: PopupPagePreferencesController;
	/** Packaged current-website Settings destination. */
	settingsPageUrl: string;
	/** Popup shell receiving status and operations. */
	shell: PopupPageShell;
	/** Packaged Statistics destination. */
	statisticsPageUrl: string;
	/** Authenticated local background status client. */
	statusClient: PopupPageStatusClient;
}
