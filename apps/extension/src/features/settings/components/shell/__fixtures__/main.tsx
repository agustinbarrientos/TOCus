import { StatisticsProjectionStatus } from '../../../../../domains/statistics/types/statistics-projection';
import type { AvailableStatisticsProjection, StatisticsProjection } from '../../../../../domains/statistics/types/statistics-projection';
import { SitePermissionReleaseStatus, SitePermissionGrantProvenance, SitePermissionRequestStatus } from '../../../../protected-sites/services/site-permission-manager/types';
import '@tocus/ui/styles.scss';
import '../../../../../entrypoints/options/styles.scss';
import {
	mountSettings,
} from '../../../services/settings-presentation';
import {
	createEnglishLocalizationBundle,
	loadLocalizationBundle,
} from '../../../../../localization';
import {
	createProtectionConfigurationEditor,
} from '../../../../../domains/protection/services/protection-configuration-editor';
import {
	ProtectionConfigurationDocumentSchema,
} from '../../../../../domains/protection/types/protected-site-configuration';
import {
	TestEmptyProtectionConfiguration,
} from '../../../../../domains/protection/types/__fixtures__';
import { Language, LanguageSchema, Palette, PauseMode, ThemeMode,
	DefaultPreferencesDocument,
	PreferencesDocumentSchema,
} from '../../../../../domains/preferences/types';
import {
	createPreferencesEditor,
} from '../../../../../domains/preferences/services/preferences-editor';
import type {
	AppearancePreferencesChangeListener,
} from '../../appearance-screen/types';


import type { SettingsFixtureControls, SettingsFixtureBridge } from './types';
import { originalConfiguration } from './original-settings';
import { originalLanguageCopy } from './original-language';
import { stageOriginalScheduleChange } from './original-schedule';
import { stageOriginalStatisticsReset } from './original-statistics';
import './original-settings.scss';

const params = new URLSearchParams( location.search );
const original = params.get( 'original' ) ?? '';
if ( original && params.has( 'isolated' ) ) {
	document.body.classList.add( 'original-settings-document' );
}
const language = LanguageSchema.parse( params.get( 'language' )
	?? ( original.includes( 'about-screen-german' ) ? Language.GERMAN : Language.ENGLISH ) );
const copy = language === Language.ENGLISH
	? createEnglishLocalizationBundle() : await loadLocalizationBundle( language );
document.documentElement.lang = copy.languageTag;
let configuration = { ...TestEmptyProtectionConfiguration };
let preferences = { ...DefaultPreferencesDocument };
const listeners = new Set<AppearancePreferencesChangeListener>();
const statisticsListeners = new Set<() => void>();
const pendingPreferenceWrites = new Set<() => void>();
const pendingConfigurationWrites = new Set<() => void>();
let sequence = 0;
const controls: SettingsFixtureControls = {
	rejectSaves: false, denyAccess: false, requests: 0, userActivation: false, writes: 0, resetCount: 0,
	rejectResets: false,
	unavailableStatistics: false,
	holdPreferenceWrites: false,
	holdConfigurationWrites: false,
	malformedPreferences: false,
};
const grants = new Set<string>();
const root = document.getElementById( 'settings-root' );
if ( root === null ) {
	throw new TypeError( 'The Settings fixture requires its mount container.' );
}
stageOriginalScheduleChange( root, original );
stageOriginalStatisticsReset( root, original );
const shell = mountSettings( root );
if ( original ) {
	configuration = originalConfiguration( original );
	configuration.sites.forEach( ( site ) => grants.add( site.identityHost ) );
	if ( original.includes( 'access-required' ) ) {
		grants.clear();
	}
	if ( params.has( 'isolated' ) ) {
		root.classList.add( 'original-settings-isolated' );
		root.style.width = `${ params.get( 'width' ) ?? '768' }px`;
		if ( original.startsWith( 'privacy-' ) ) {
			root.classList.add( 'original-settings-privacy' );
		}
	}
}
preferences.theme = params.get( 'theme' ) === ThemeMode.DARK ? ThemeMode.DARK : ThemeMode.LIGHT;
document.documentElement.style.colorScheme = preferences.theme;
document.documentElement.setAttribute( 'data-tocus-theme', preferences.theme );
preferences.palette = Object.values( Palette ).find( ( palette ) => palette === params.get( 'palette' ) ) ?? Palette.BROWN;
document.documentElement.setAttribute( 'data-tocus-palette', preferences.palette );
if ( original ) {
	preferences.theme = DefaultPreferencesDocument.theme;
	if ( original.includes( 'appearance-screen-purple-dark' ) ) {
		preferences = { ...preferences, theme: ThemeMode.DARK, palette: Palette.PURPLE,
			pauseMode: PauseMode.QUIET, reducedMotion: true };
	}
	if ( original.includes( 'appearance-screen-green' ) ) {
		preferences = { ...preferences, theme: ThemeMode.LIGHT, palette: Palette.GREEN };
	}
	if ( original.includes( 'language-screen-purple' ) ) {
		preferences.language = Language.JAPANESE;
	}
	if ( original.includes( 'language-screen-german' ) ) {
		preferences.language = Language.GERMAN;
	}
}
Object.assign( shell, {
	copy: copy.settingsShell,
	aboutCopy: copy.aboutCopy,
	privacyCopy: copy.privacyCopy,
	appearanceCopy: copy.appearance,
	languageCopy: original.includes( 'language-screen-german' ) ? originalLanguageCopy( copy.languageScreen ) : copy.languageScreen,
	browserLanguage: original.includes( 'language-screen-german' ) ? Language.GERMAN : Language.ENGLISH,
	protectedSitesCopy: copy.protectedSites,
	protectedSiteItemCopy: copy.protectedSiteItem,
	timingCopy: copy.timing,
	scheduleCopy: copy.schedule,
	statisticsCopy: copy.statistics,
	aboutVersion: '0.1.0',
	supportsCachedFavicons: true,
} );

/**
 * Publishes persisted or external preferences through the production subscription port.
 * @since 0.1.0
 */
function notifyPreferences(): void {
	listeners.forEach( ( listener ) => {
		listener( preferences );
	} );
}

/**
 * Runs fixture mutations immediately, preserving the editor's async contract.
 * @template Result - Value produced by the coordinated mutation.
 * @param mutation - Mutation requested by the production editor.
 * @return Settled mutation result.
 * @since 0.1.0
 */
function coordinateMutation<Result>( mutation: () => Promise<Result> ): Promise<Result> {
	return mutation();
}

/**
 * Counts accepted writes without changing state when rejection is enabled.
 * @since 0.1.0
 */
function recordWrite(): void {
	if ( controls.rejectSaves ) {
		throw new Error( 'Rejected save' );
	}
	controls.writes++;
}

/**
 * Records whether simulated browser access was requested within user activation.
 * @since 0.1.0
 */
function recordAccessRequest(): void {
	controls.requests++;
	controls.userActivation = navigator.userActivation.isActive;
}

shell.editor = createProtectionConfigurationEditor( {
	storage: {
		/**
		 * Reads the current isolated configuration.
		 * @return Persisted fixture configuration.
		 * @since 0.1.0
		 */
		load: () => Promise.resolve( configuration ),
		/**
		 * Validates and persists an accepted editor write.
		 * @param value - Submitted configuration.
		 * @return Completion of the accepted fixture write.
		 * @since 0.1.0
		 */
		save: async ( value ) => {
			if ( controls.holdConfigurationWrites ) {
				await new Promise<void>( ( resolve ) => {
					pendingConfigurationWrites.add( resolve );
				} );
			}
			recordWrite();
			configuration = ProtectionConfigurationDocumentSchema.parse( value );
		},
	},
	/**
	 * Creates independent fixture scopes.
	 * @return Distinct fixture scope identifier.
	 * @since 0.1.0
	 */
	createIndependentScopeId: () => `scope_${ String( ++sequence ) }`,
	/**
	 * Marks each configuration revision.
	 * @return Distinct fixture revision identifier.
	 * @since 0.1.0
	 */
	createMeasurementRevision: () => `revision_${ String( ++sequence ) }`,
	coordinateMutation,
} );

shell.preferencesEditor = createPreferencesEditor( {
	storage: {
		/**
		 * Reads preferences shared with the external-update bridge.
		 * @return Persisted fixture preferences.
		 * @since 0.1.0
		 */
		load: () => Promise.resolve( controls.malformedPreferences ? null : preferences ),
		/**
		 * Validates and publishes an accepted preferences write.
		 * @param value - Submitted preferences.
		 * @return Completion of the accepted fixture write.
		 * @since 0.1.0
		 */
		save: async ( value ) => {
			if ( controls.holdPreferenceWrites ) {
				await new Promise<void>( ( resolve ) => {
					pendingPreferenceWrites.add( resolve );
				} );
			}
			recordWrite();
			preferences = PreferencesDocumentSchema.parse( value );
			controls.malformedPreferences = false;
			notifyPreferences();
		},
	},
	coordinateMutation,
} );

shell.preferencesSource = {
	/**
	 * Registers a mounted screen subscription.
	 * @param listener - Preferences change observer.
	 * @since 0.1.0
	 */
	addPreferencesChangeListener: ( listener ) => {
		listeners.add( listener );
	},
	/**
	 * Releases a screen subscription.
	 * @param listener - Previously registered observer.
	 * @since 0.1.0
	 */
	removePreferencesChangeListener: ( listener ) => {
		listeners.delete( listener );
	},
};

shell.preferencesPreview = {
	/**
	 * Mirrors document attributes used to inspect unsaved previews.
	 * @param value - Draft appearance preferences.
	 * @since 0.1.0
	 */
	apply: ( value ) => {
		document.documentElement.setAttribute( 'data-tocus-theme', value.theme );
		document.documentElement.setAttribute( 'data-tocus-palette', value.palette );
		document.documentElement.setAttribute( 'data-tocus-reduced-motion', String( value.reducedMotion ) );
	},
};

shell.permissionManager = {
	/**
	 * Excludes websites with revoked browser grants.
	 * @param value - Persisted configuration.
	 * @return Configuration filtered by current grants.
	 * @since 0.1.0
	 */
	filterConfiguration: ( value ) => Promise.resolve( {
		...value,
		sites: value.sites.filter( ( site ) => grants.has( site.identityHost ) ),
	} ),
	/**
	 * Reads the separate simulated browser grant store.
	 * @param rule - Website matching rule.
	 * @return Whether browser access is granted.
	 * @since 0.1.0
	 */
	hasAccess: ( rule ) => Promise.resolve( grants.has( rule.host ) ),
	/**
	 * Simulates the browser decision inside a user-initiated save.
	 * @param rule - Requested website rule.
	 * @return Granted or denied access outcome.
	 * @since 0.1.0
	 */
	request: ( rule ) => {
		recordAccessRequest();
		if ( controls.denyAccess ) {
			return Promise.resolve( { status: SitePermissionRequestStatus.DENIED } );
		}
		grants.add( rule.host );
		return Promise.resolve( {
			status: SitePermissionRequestStatus.GRANTED, provenance: SitePermissionGrantProvenance.NEW,
		} );
	},
	/**
	 * Simulates a batch browser decision.
	 * @param rules - Requested website rules.
	 * @return Batch access outcome without prior grants.
	 * @since 0.1.0
	 */
	requestMany: ( rules ) => {
		recordAccessRequest();
		if ( controls.denyAccess ) {
			return Promise.resolve( { status: SitePermissionRequestStatus.DENIED } );
		}
		rules.forEach( ( rule ) => grants.add( rule.host ) );
		return Promise.resolve( { status: SitePermissionRequestStatus.GRANTED, previousGrant: null } );
	},
	/**
	 * Acknowledges rollback cleanup in this isolated fixture.
	 * @return Successful release acknowledgement.
	 * @since 0.1.0
	 */
	releaseNewAccess: () => Promise.resolve( SitePermissionReleaseStatus.RELEASED ),
	/**
	 * Acknowledges explicit release in scenarios without cleanup assertions.
	 * @return Successful release acknowledgement.
	 * @since 0.1.0
	 */
	release: () => Promise.resolve( SitePermissionReleaseStatus.RELEASED ),
};

let statistics: AvailableStatisticsProjection = {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: ( 2 * 5 + 1 ) * 60_000,
	focusedPauseMilliseconds: 60_000,
	reconsideredVisitCount: 2,
	completedWaitCount: 3,
	allowanceGrantedCount: 4,
};
if ( original ) {
	statistics = { ...statistics, estimatedReclaimedMilliseconds: ( 18 * 5 + 27 ) * 60_000,
		focusedPauseMilliseconds: 1620000, reconsideredVisitCount: 18,
		completedWaitCount: 24, allowanceGrantedCount: 11 };
	if ( original.includes( 'empty' ) ) {
		statistics = { ...statistics, estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0 };
	}
	controls.unavailableStatistics = original.includes( 'statistics' ) && original.includes( 'unavailable' );
	controls.rejectResets = original.includes( 'failed' ) || original.includes( 'failure' );
}
shell.statisticsSource = {
	/**
	 * Supplies deterministic local counters.
	 * @return Available fixture statistics.
	 * @since 0.1.0
	 */
	readStatistics: () => original.includes( 'statistics-settings-screen-loading' )
		? Promise.withResolvers<StatisticsProjection>().promise : Promise.resolve( controls.unavailableStatistics
			? { status: StatisticsProjectionStatus.UNAVAILABLE } : statistics ),
	/**
	 * Records a reset and returns cleared local counters.
	 * @return Cleared fixture statistics.
	 * @since 0.1.0
	 */
	resetStatistics: () => {
		if ( original.includes( 'resetting' ) ) {
			return Promise.withResolvers<StatisticsProjection>().promise;
		}
		controls.resetCount++;
		if ( controls.rejectResets ) {
			return Promise.reject( new Error( 'Rejected reset' ) );
		}
		statistics = {
			...statistics,
			estimatedReclaimedMilliseconds: 0,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		};
		return Promise.resolve( statistics );
	},
	/**
	 * Retains production subscriptions for lifecycle cleanup.
	 * @param listener - Statistics invalidation observer.
	 * @since 0.1.0
	 */
	addStatisticsChangeListener: ( listener ) => {
		statisticsListeners.add( listener );
	},
	/**
	 * Removes a screen's statistics subscription.
	 * @param listener - Previously registered observer.
	 * @since 0.1.0
	 */
	removeStatisticsChangeListener: ( listener ) => {
		statisticsListeners.delete( listener );
	},
};

/**
 * Acknowledges privacy resets without touching real storage.
 * @return Successful local reset acknowledgement.
 * @since 0.1.0
 */
function resetFixtureData(): Promise<boolean> {
	controls.resetCount++;
	if ( original.includes( 'pending' ) ) {
		return Promise.withResolvers<boolean>().promise;
	}
	return Promise.resolve( ! controls.rejectResets );
}
shell.privacyActions = {
	resetStatistics: resetFixtureData,
	resetAllData: resetFixtureData,
};
if ( original.includes( 'privacy-screen-unavailable' ) ) {
	shell.privacyActions = null;
}

const bridge: SettingsFixtureBridge = {
	themes: ThemeMode, palettes: Palette, languages: Language,
	controls,
	/** Completes held configuration writes through the production editor's pending state. */
	releaseConfigurationWrites: () => {
		controls.holdConfigurationWrites = false;
		pendingConfigurationWrites.forEach( ( resolve ) => {
			resolve();
		} );
		pendingConfigurationWrites.clear();
	},
	/** Publishes malformed data without repairing it implicitly. */
	malformPreferences: () => {
		controls.malformedPreferences = true;
		listeners.forEach( ( listener ) => {
			listener( null );
		} );
	},
	/** Completes held writes so tests can observe the full recovery lifecycle. */
	releasePreferenceWrites: () => {
		controls.holdPreferenceWrites = false;
		pendingPreferenceWrites.forEach( ( resolve ) => {
			resolve();
		} );
		pendingPreferenceWrites.clear();
	},
	/**
	 * Publishes replacement statistics through production subscriptions.
	 * @param update - New counter values for this browser scenario.
	 * @since 0.1.0
	 */
	externalStatistics: ( update ) => {
		statistics = { ...statistics, ...update };
		statisticsListeners.forEach( ( listener ) => {
			listener();
		} );
	},
	/**
	 * Reads persisted configuration separately from React drafts.
	 * @return Current fixture configuration.
	 * @since 0.1.0
	 */
	getConfiguration: () => configuration,
	/**
	 * Reads persisted preferences separately from previews.
	 * @return Current fixture preferences.
	 * @since 0.1.0
	 */
	getPreferences: () => preferences,
	/**
	 * Simulates browser revocation then refreshes production access state.
	 * @return Access refresh completion.
	 * @since 0.1.0
	 */
	revoke: async () => {
		grants.clear();
		await shell.refreshAccessState();
	},
	/**
	 * Publishes a validated change from another extension context.
	 * @param update - Externally updated preference fields.
	 * @since 0.1.0
	 */
	externalPreferences: ( update ) => {
		preferences = PreferencesDocumentSchema.parse( { ...preferences, ...update } );
		notifyPreferences();
	},
};
window.settingsTest = bridge;
