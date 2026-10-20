import { createBackupFixture } from '../../src/domains/local-data/services/local-data-backup/__fixtures__';
import { readLocalDataGeneration } from '../../src/domains/local-data/services/local-data-generation';
import { PreferencesStorageKey } from '../../src/domains/preferences/services/preferences-storage';
import { DefaultPreferencesDocument, PreferencesDocumentSchema } from '../../src/domains/preferences/types';
import { ProtectionConfigurationStorageKey } from '../../src/domains/protection/services/protection-configuration-storage';
import { ProtectionConfigurationDocumentSchema } from '../../src/domains/protection/types/protected-site-configuration';
import { TestEmptyProtectionConfiguration } from '../../src/domains/protection/types/__fixtures__';
import { SitePermissionRequestStatus } from '../../src/features/protected-sites/services/site-permission-manager';
import { createBackupDataActions } from '../../src/features/settings/services/backup-data-actions';
import type { PrivacyDataRuntime } from '../../src/features/settings/services/privacy-data-actions/types';
import type { OnboardingPageShell } from '../../src/features/onboarding/services/onboarding-page/types';
import { OnboardingOpenSettingsEventName } from '../../src/features/onboarding/components/shell/types';
import { loadLocalizationBundle } from '../../src/localization';

/**
 * Test-only observations around the real in-memory backup authority.
 * @since 1.1.0
 */
export interface OnboardingPresentationTest {
	port: OnboardingPageShell;
	backupWrites(): number;
	importRequests(): string[];
	consentRequests(): number;
	consentActivation(): boolean;
	openSettingsRequests(): number;
}

declare global {
	/**
	 * Browser fixture controls that never ship in extension entrypoints.
	 * @since 1.1.0
	 */
	interface Window {
		/** Explicit boundary controls owned only by the standalone browser fixture. */
		presentationTest: OnboardingPresentationTest;
	}
}

/**
 * Connects the production backup client to disposable storage without extension permissions.
 * @param port - The real onboarding presentation's service boundary.
 * @since 1.1.0
 */
export function setupOnboardingBackupFixture( port: OnboardingPageShell ): void {
	const fixture = createBackupFixture();
	fixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] = TestEmptyProtectionConfiguration;
	fixture.values[ PreferencesStorageKey.PREFERENCES ] = DefaultPreferencesDocument;
	const scenario = new URLSearchParams( location.search ).get( 'backup' );
	const requestIds: string[] = [];
	let consentCount = 0;
	let activation = false;
	let settingsCount = 0;
	let identifier = 0;
	let firstResponse = true;
	let granted = scenario !== 'missing' && scenario !== 'denied';

	/**
	 * Observes consent in the original click rather than after a background round trip.
	 * @return Simulated permission outcome without calling browser APIs.
	 */
	function requestMany() {
		consentCount++;
		activation = navigator.userActivation.isActive;
		if ( scenario === 'permission-error' ) {
			return Promise.resolve( { status: SitePermissionRequestStatus.ERROR } );
		}
		return Promise.resolve( granted
			? { status: SitePermissionRequestStatus.GRANTED, previousGrant: null }
			: { status: SitePermissionRequestStatus.DENIED } );
	}
	const permissions = {
		requestMany,
		/**
		 * Reports the current fixture grant without prompting again.
		 * @return Whether simulated site access is granted.
		 */
		hasAccess: () => Promise.resolve( granted ),
	};
	const runtime: PrivacyDataRuntime = {
		/**
		 * Routes backup requests through the same durable map-backed authority as unit tests.
		 * @param request - Validated operation from the real backup action client.
		 * @return Complete authority response, or an injected response failure.
		 */
		async sendMessage( request ) {
			if ( request.type === 'read-local-backup-state' ) {
				const marker = await readLocalDataGeneration( fixture.area );
				return { status: 'ready', generation: marker?.generation ?? null };
			}
			if ( request.type !== 'import-local-backup' ) {
				throw new Error( 'Unexpected operation in the onboarding backup fixture.' );
			}
			requestIds.push( request.requestId );
			if ( scenario === 'stale' && firstResponse ) {
				firstResponse = false;
				return { status: 'stale' };
			}
			if ( scenario === 'pending' ) {
				await new Promise<void>( resolve => {
					document.addEventListener( 'fixture-settle-import', () => {
						resolve();
					}, { once: true } );
				} );
			}
			const result = await fixture.backup.import( request );
			if ( scenario === 'recovery' && firstResponse ) {
				firstResponse = false;
				throw new Error( 'Simulated lost import response.' );
			}
			return result;
		},
	};
	const actions = createBackupDataActions( {
		runtime, permissions,
		/**
		 * Allocates a new preview identity while preserving one identity across retries.
		 * @return Stable fixture operation identity.
		 */
		createId: () => `ui_import_${ String( ++identifier ) }`,
		/**
		 * Projects only complete documents after the authority finishes replacement.
		 * @return Completion after imported preferences, rules and copy are applied.
		 */
		async onImported() {
			const preferences = PreferencesDocumentSchema.parse(
				( await fixture.area.get( PreferencesStorageKey.PREFERENCES ) )[ PreferencesStorageKey.PREFERENCES ],
			);
			const configurationRecords = await fixture.area.get( ProtectionConfigurationStorageKey.CONFIGURATION );
			const configuration = ProtectionConfigurationDocumentSchema.parse(
				configurationRecords[ ProtectionConfigurationStorageKey.CONFIGURATION ],
			);
			port.protectedSites = configuration.sites;
			port.theme = preferences.theme;
			port.palette = preferences.palette;
			if ( preferences.language !== null ) {
				const bundle = await loadLocalizationBundle( preferences.language );
				port.copy = bundle.onboarding;
				port.interruptionCopy = bundle.interruption;
				port.language = preferences.language;
			}
		},
	} );
	port.backupActions = {
		preview: actions.preview.bind( actions ),
		confirmImport: actions.confirmImport.bind( actions ),
		/**
		 * Models another deliberate consent gesture after a denied import request.
		 * @return Whether the new permission decision leaves access granted.
		 */
		async requestAccess() {
			granted = scenario !== 'denied' && scenario !== 'permission-error';
			await permissions.requestMany();
			return permissions.hasAccess();
		},
	};
	port.addEventListener( OnboardingOpenSettingsEventName, () => {
		settingsCount++;
	} );
	window.presentationTest = {
		port, backupWrites: fixture.writeCount,
		/**
		 * Reads detached identities received by the authority.
		 * @return Received request identities in order.
		 */
		importRequests: () => [ ...requestIds ],
		/**
		 * Reports how often the UI invoked the permission boundary.
		 * @return Number of consent gestures.
		 */
		consentRequests: () => consentCount,
		/**
		 * Reports browser activation at the most recent permission request.
		 * @return Whether consent ran within a deliberate gesture.
		 */
		consentActivation: () => activation,
		/**
		 * Reports deliberate navigation out of the restored outcome.
		 * @return Number of Settings requests.
		 */
		openSettingsRequests: () => settingsCount,
	};
}
