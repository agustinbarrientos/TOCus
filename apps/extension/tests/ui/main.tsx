import { PopupCurrentSiteStatus, PopupProjectionStatus } from '../../src/features/popup/types/popup-projection';
import { SitePermissionReleaseStatus } from '../../src/features/protected-sites/services/site-permission-manager/types';
import { ProtectedSiteEnrollmentStatus } from '../../src/features/protected-sites/services/protected-site-enrollment/types';
import { ProtectedSiteCanonicalizationStatus } from '../../src/domains/protection/utils/protected-site-canonicalizer/types';
import { PresentationFixtureEvent, PresentationSurface, SiteBatchScenario, SiteRemovalScenario, PreferenceSaveScenario } from './types';
import '@tocus/ui/styles.scss';
import { DefaultPreferencesDocument, PreferencesDocumentSchema, type Language } from '../../src/domains/preferences/types';
import { PreferencesUpdateSchema } from '../../src/domains/preferences/services/preferences-editor/types';
import { createEnglishLocalizationBundle, loadLocalizationBundle, type LocalizationBundle } from '../../src/localization';
import { mountOnboarding } from '../../src/features/onboarding/services/onboarding-presentation';
import { createOnboardingLocalizationCoordinator } from '../../src/features/onboarding/services/localization-coordinator';
import { mountPopup } from '../../src/features/popup/services/popup-presentation';
import { OnboardingLanguageSelectEventName } from '../../src/features/onboarding/components/language-step/types';
import { PopupAddSiteRequestEventName } from '../../src/features/popup/components/shell/types';
import { OnboardingSiteSuggestions } from '../../src/features/onboarding/utils/site-suggestion-catalog';
import { TestEmptyProtectionConfiguration } from '../../src/domains/protection/types/__fixtures__';
import { canonicalizeProtectedSite } from '../../src/domains/protection/utils/protected-site-canonicalizer';
import { DefaultProtectionScopeId } from '../../src/domains/protection/types/protection-value';
import type { ProtectedSiteConfiguration } from '../../src/domains/protection/types/protected-site-configuration';

/**
 * Creates a domain-valid fixture site through the same canonicalizer used in production.
 * @param input - Site address supplied by a test scenario.
 * @return A configuration safe for the real rendering and draft validation paths.
 */
function siteFromInput( input: string ): ProtectedSiteConfiguration {
	const result = canonicalizeProtectedSite( input, DefaultProtectionScopeId );
	if ( result.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
		throw new Error( `Invalid browser fixture site: ${ input }` );
	}
	return { identityHost: result.identityHost, rule: result.rule };
}

/**
 * Holds a browser boundary until the test explicitly settles it, without arbitrary sleep durations.
 * @param name - Fixture-only document event that releases the pending operation.
 * @return Completion after the scenario emits the expected signal.
 */
function awaitFixtureSignal( name: PresentationFixtureEvent ): Promise<void> {
	return new Promise( ( resolve ) => {
		document.addEventListener( name, () => {
			resolve();
		}, { once: true } );
	} );
}

/**
 * Fails a fixture if presentation unexpectedly calls an unrelated enrollment operation.
 * @return Rejected operation that the production recovery UI can report.
 */
function unexpectedEnrollment(): Promise<never> {
	return Promise.reject( new Error( 'Unexpected enrollment operation in this browser fixture.' ) );
}

/**
 * Mounts onboarding with typed local persistence and a counted denial-only permission boundary.
 * @param container - Dedicated fixture React root.
 * @param counter - Observable browser-consent request count for regression assertions.
 */
function setupOnboarding( container: HTMLElement, counter: HTMLOutputElement ): void {
	const query = new URLSearchParams( location.search );
	const port = mountOnboarding( container );
	const bundle = createEnglishLocalizationBundle();
	let preferences = { ...DefaultPreferencesDocument };
	let requests = 0;
	port.copy = bundle.onboarding;
	port.interruptionCopy = bundle.interruption;
	port.suggestions = OnboardingSiteSuggestions;
	if ( query.has( 'persisted' ) ) {
		port.protectedSites = [ siteFromInput( 'github.com' ), siteFromInput( 'example.org' ) ];
	}
	port.startupUnavailable = query.has( 'unavailable' );
	port.editor = {
		/**
		 * Reads this fixture's stored preferences.
		 * @return The current in-memory preference document.
		 */
		load() {
			return Promise.resolve( preferences );
		},
		/**
		 * Applies the same preference validation used at the production boundary.
		 * @param input - Unknown partial preference update from the view.
		 * @return The newly authoritative fixture document.
		 */
		async update( input: unknown ) {
			if ( query.get( 'save' ) === PreferenceSaveScenario.PENDING ) {
				await awaitFixtureSignal( PresentationFixtureEvent.SETTLE_SAVE );
			}
			if ( query.get( 'save' ) === PreferenceSaveScenario.REJECT ) {
				throw new Error( 'Fixture storage failure.' );
			}
			if ( query.get( 'save' ) === PreferenceSaveScenario.NULL ) {
				return null;
			}
			if ( query.get( 'save' ) === PreferenceSaveScenario.MISSING_LANGUAGE ) {
				return { ...preferences, language: null };
			}
			preferences = PreferencesDocumentSchema.parse( {
				...preferences,
				...PreferencesUpdateSchema.parse( input ),
			} );
			return preferences;
		},
		/**
		 * Restores a fresh local default without touching a real extension profile.
		 * @return The default preference document.
		 */
		restoreDefaults() {
			preferences = { ...DefaultPreferencesDocument };
			return Promise.resolve( preferences );
		},
	};
	if ( query.get( 'save' ) === PreferenceSaveScenario.MISSING_EDITOR ) {
		port.editor = null;
	}
	port.enrollment = {
		add: unexpectedEnrollment,
		/**
		 * Models early storage notifications while the browser permission release is still pending.
		 * @param site - Exact persisted rule selected for removal.
		 * @return Existing enrollment result after the test releases the asynchronous boundary.
		 */
		async remove( site ) {
			const remaining = port.protectedSites.filter(
				( candidate ) => candidate.identityHost !== site.identityHost,
			);
			if ( query.get( 'remove' ) === SiteRemovalScenario.PENDING ) {
				port.protectedSites = remaining;
				await awaitFixtureSignal( PresentationFixtureEvent.SETTLE_REMOVE );
			}
			if ( query.get( 'remove' ) === SiteRemovalScenario.REJECT ) {
				throw new Error( 'Fixture removal failure.' );
			}
			return {
				status: ProtectedSiteEnrollmentStatus.REMOVED,
				configuration: { ...TestEmptyProtectionConfiguration, sites: remaining }, site,
				permissionReleaseStatus: query.get( 'remove' ) === SiteRemovalScenario.RETAINED ? SitePermissionReleaseStatus.RETAINED : SitePermissionReleaseStatus.RELEASED,
			};
		},
		saveDraft: unexpectedEnrollment,
		/**
		 * Counts an actual Finish call and models a user denying browser consent.
		 * @param inputs - Canonical draft addresses collected before the consent gesture.
		 * @return Denial, requiring the UI to retain its unsaved sites.
		 */
		async addMany( inputs ) {
			counter.textContent = String( ++requests );
			counter.dataset.activation = String( navigator.userActivation.isActive );
			if ( query.get( 'batch' ) === SiteBatchScenario.PENDING ) {
				await awaitFixtureSignal( PresentationFixtureEvent.SETTLE_BATCH );
			}
			if ( query.get( 'batch' ) === SiteBatchScenario.SUCCESS ) {
				const sites = inputs.map( siteFromInput );
				return {
					status: ProtectedSiteEnrollmentStatus.ADDED,
					configuration: { ...TestEmptyProtectionConfiguration, sites }, sites,
				};
			}
			if ( query.get( 'batch' ) === SiteBatchScenario.REJECT ) {
				throw new Error( 'Fixture browser permission failure.' );
			}
			return { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED };
		},
	};

	/**
	 * Projects one complete onboarding localization snapshot into the fixture port.
	 * @param localization - Validated packaged localization bundle.
	 */
	function applyLocalizationSnapshot( localization: Readonly<LocalizationBundle> ): void {
		port.copy = localization.onboarding;
		port.interruptionCopy = localization.interruption;
	}

	const localizationCoordinator = createOnboardingLocalizationCoordinator( {
		load: loadLocalizationBundle,
		apply: applyLocalizationSnapshot,
	} );
	port.synchronizeLanguage = ( language: Language ) => localizationCoordinator.synchronize( language );
	port.addEventListener( OnboardingLanguageSelectEventName, () => {
		void localizationCoordinator.request( port.language );
	} );
}

/**
 * Mounts an unlisted-site popup with a counted, pending background enrollment request.
 * @param container - Dedicated fixture React root.
 * @param counter - Synchronous request counter observed by keyboard tests.
 */
function setupPopup( container: HTMLElement, counter: HTMLOutputElement ): void {
	const port = mountPopup( container );
	let requests = 0;
	port.copy = createEnglishLocalizationBundle().popup;
	port.settingsPageUrl = '/options.html#protected-sites';
	port.statisticsPageUrl = '/options.html#statistics';
	port.projection = {
		status: PopupProjectionStatus.AVAILABLE,
		capturedAtEpochMilliseconds: 1000,
		currentSite: { status: PopupCurrentSiteStatus.UNPROTECTED, identityHost: 'github.com' },
		activeScopes: [],
	};
	port.addEventListener( PopupAddSiteRequestEventName, () => {
		port.adding = true;
		counter.textContent = String( ++requests );
	} );
}

const container = document.getElementById( 'app' );
if ( ! container ) {
	throw new Error( 'Missing browser fixture mount point.' );
}
const counter = document.createElement( 'output' );
counter.dataset.testid = 'requests';
counter.textContent = '0';
document.body.append( counter );
if ( new URLSearchParams( location.search ).get( 'surface' ) === PresentationSurface.ONBOARDING ) {
	await import( '../../src/entrypoints/onboarding/styles.scss' );
	setupOnboarding( container, counter );
} else {
	await import( '../../src/entrypoints/popup/styles.scss' );
	setupPopup( container, counter );
}
