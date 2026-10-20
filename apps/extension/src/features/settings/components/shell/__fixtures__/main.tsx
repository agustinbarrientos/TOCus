import { createBackupDataActions } from '../../../services/backup-data-actions';
import { createBackupFixture } from '../../../../../domains/local-data/services/local-data-backup/__fixtures__';
import { createBackupSource } from '../../../../../domains/local-data/utils/backup-document/__fixtures__';
import { PreferencesStorageKey } from '../../../../../domains/preferences/services/preferences-storage';
import { ProtectionConfigurationStorageKey } from '../../../../../domains/protection/services/protection-configuration-storage';
import { LocalDataGenerationStorageKey } from '../../../../../domains/local-data/services/local-data-generation';
import { AvailableStatisticsProjectionSchema, StatisticsProjectionStatus } from '../../../../../domains/statistics/types/statistics-projection';
import type { AvailableStatisticsProjection, StatisticsProjection } from '../../../../../domains/statistics/types/statistics-projection';
import { SitePermissionReleaseStatus, SitePermissionGrantProvenance, SitePermissionRequestStatus } from '../../../../protected-sites/services/site-permission-manager/types';
import { createSitePermissionOrigins, isSitePermissionOriginCovered } from '../../../../protected-sites/utils/site-permission-origins';
import type { ProtectedSiteRule } from '../../../../../domains/protection/types/protected-site-rule';
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
import { createStatisticsComparisonFixture } from '../../../../statistics/components/settings-screen/__fixtures__/comparison';
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
const pendingBackupExports = new Set<() => void>();
let sequence = 0;
const controls: SettingsFixtureControls = {
	rejectSaves: false, denyAccess: false, requests: 0, userActivation: false, writes: 0, resetCount: 0,
	rejectResets: false,
	unavailableStatistics: false,
	holdPreferenceWrites: false,
	holdConfigurationWrites: false,
	holdBackupExports: false,
	malformedPreferences: false,
};
const grants = new Set<string>();
/**
 * Models browser wildcard grants without requiring a redundant exact child permission.
 * @param rule - Complete target whose HTTP and HTTPS access is being checked.
 * @return Whether the simulated browser origins cover the target.
 */
function hasSiteAccess( rule: ProtectedSiteRule ): boolean {
	return createSitePermissionOrigins( rule ).every( ( origin ) =>
		isSitePermissionOriginCovered( origin, [ ...grants ] ) );
}
const root = document.getElementById( 'settings-root' );
if ( root === null ) {
	throw new TypeError( 'The Settings fixture requires its mount container.' );
}
stageOriginalScheduleChange( root, original );
stageOriginalStatisticsReset( root, original );
const shell = mountSettings( root );
if ( original ) {
	configuration = originalConfiguration( original );
	configuration.sites.flatMap( ( site ) => createSitePermissionOrigins( site.rule ) )
		.forEach( ( origin ) => grants.add( origin ) );
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
			pauseMode: PauseMode.QUIET };
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
	backupResetCopy: copy.backupResetCopy,
	appearanceCopy: copy.appearance,
	focusLinksCopy: copy.focusLinksCopy,
	pausePreviewCopy: {
		title: copy.onboarding.appearance.previewTitle,
		screen: copy.interruption,
	},
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
 * @since 1.0.0
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
 * @since 1.0.0
 */
function coordinateMutation<Result>( mutation: () => Promise<Result> ): Promise<Result> {
	return mutation();
}

/**
 * Counts accepted writes without changing state when rejection is enabled.
 * @since 1.0.0
 */
function recordWrite(): void {
	if ( controls.rejectSaves ) {
		throw new Error( 'Rejected save' );
	}
	controls.writes++;
}

/**
 * Records whether simulated browser access was requested within user activation.
 * @since 1.0.0
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
		 * @since 1.0.0
		 */
		load: () => Promise.resolve( configuration ),
		/**
		 * Validates and persists an accepted editor write.
		 * @param value - Submitted configuration.
		 * @return Completion of the accepted fixture write.
		 * @since 1.0.0
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
	 * Marks each configuration revision.
	 * @return Distinct fixture revision identifier.
	 * @since 1.0.0
	 */
	createMeasurementRevision: () => `revision_${ String( ++sequence ) }`,
	coordinateMutation,
} );

shell.preferencesEditor = createPreferencesEditor( {
	storage: {
		/**
		 * Reads preferences shared with the external-update bridge.
		 * @return Persisted fixture preferences.
		 * @since 1.0.0
		 */
		load: () => Promise.resolve( controls.malformedPreferences ? null : preferences ),
		/**
		 * Validates and publishes an accepted preferences write.
		 * @param value - Submitted preferences.
		 * @return Completion of the accepted fixture write.
		 * @since 1.0.0
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
	 * @since 1.0.0
	 */
	addPreferencesChangeListener: ( listener ) => {
		listeners.add( listener );
	},
	/**
	 * Releases a screen subscription.
	 * @param listener - Previously registered observer.
	 * @since 1.0.0
	 */
	removePreferencesChangeListener: ( listener ) => {
		listeners.delete( listener );
	},
};

shell.preferencesPreview = {
	/**
	 * Mirrors document attributes used to inspect unsaved previews.
	 * @param value - Draft appearance preferences.
	 * @since 1.0.0
	 */
	apply: ( value ) => {
		document.documentElement.setAttribute( 'data-tocus-theme', value.theme );
		document.documentElement.setAttribute( 'data-tocus-palette', value.palette );
		document.documentElement.setAttribute( 'data-tocus-reduced-motion',
			String( matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) );
	},
};

shell.permissionManager = {
	/**
	 * Excludes websites with revoked browser grants.
	 * @param value - Persisted configuration.
	 * @return Configuration filtered by current grants.
	 * @since 1.0.0
	 */
	filterConfiguration: ( value ) => Promise.resolve( {
		...value,
		sites: value.sites.filter( ( site ) => hasSiteAccess( site.rule ) ),
	} ),
	/**
	 * Reads the separate simulated browser grant store.
	 * @param rule - Website matching rule.
	 * @return Whether browser access is granted.
	 * @since 1.0.0
	 */
	hasAccess: ( rule ) => Promise.resolve( hasSiteAccess( rule ) ),
	/**
	 * Simulates the browser decision inside a user-initiated save.
	 * @param rule - Requested website rule.
	 * @return Granted or denied access outcome.
	 * @since 1.0.0
	 */
	request: ( rule ) => {
		recordAccessRequest();
		if ( controls.denyAccess ) {
			return Promise.resolve( { status: SitePermissionRequestStatus.DENIED } );
		}
		createSitePermissionOrigins( rule ).forEach( ( origin ) => grants.add( origin ) );
		return Promise.resolve( {
			status: SitePermissionRequestStatus.GRANTED, provenance: SitePermissionGrantProvenance.NEW,
		} );
	},
	/**
	 * Simulates a batch browser decision.
	 * @param rules - Requested website rules.
	 * @return Batch access outcome without prior grants.
	 * @since 1.0.0
	 */
	requestMany: ( rules ) => {
		recordAccessRequest();
		if ( controls.denyAccess ) {
			return Promise.resolve( { status: SitePermissionRequestStatus.DENIED } );
		}
		rules.flatMap( createSitePermissionOrigins ).forEach( ( origin ) => grants.add( origin ) );
		return Promise.resolve( { status: SitePermissionRequestStatus.GRANTED, previousGrant: null } );
	},
	/**
	 * Acknowledges rollback cleanup in this isolated fixture.
	 * @return Successful release acknowledgement.
	 * @since 1.0.0
	 */
	releaseNewAccess: () => Promise.resolve( SitePermissionReleaseStatus.RELEASED ),
	/**
	 * Acknowledges explicit release in scenarios without cleanup assertions.
	 * @return Successful release acknowledgement.
	 * @since 1.0.0
	 */
	release: () => Promise.resolve( SitePermissionReleaseStatus.RELEASED ),
};

let statistics: AvailableStatisticsProjection = AvailableStatisticsProjectionSchema.parse( {
	status: StatisticsProjectionStatus.AVAILABLE,
	currentDate: '2026-09-14',
	estimatedReclaimedMilliseconds: ( 2 * 5 + 1 ) * 60_000,
	focusedPauseMilliseconds: 60_000,
	reconsideredVisitCount: 2,
	completedWaitCount: 3,
	allowanceGrantedCount: 4,
	dailyTotals: [ {
		date: '2026-09-14', estimatedReclaimedMilliseconds: 11 * 60_000,
		focusedPauseMilliseconds: 60_000, reconsideredVisitCount: 2,
		completedWaitCount: 3, allowanceGrantedCount: 4,
	} ],
} );
if ( ! original ) {
	statistics = AvailableStatisticsProjectionSchema.parse( { ...statistics,
		firstRecordedDate: '2026-09-14',
		visitOutcomes: {
			recordedFromDate: '2026-09-14',
			dailySites: [
				{ date: '2026-09-14', siteHost: 'reddit.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 1 },
				{ date: '2026-09-14', siteHost: 'youtube.com', reconsideredVisitCount: 1, visitedAfterPauseCount: 3 },
			],
			dailyHours: [
				{ date: '2026-09-14', hour: 9, reconsideredVisitCount: 1 },
				{ date: '2026-09-14', hour: 18, reconsideredVisitCount: 1 },
			],
		},
	} );
}
if ( original ) {
	const totals = { estimatedReclaimedMilliseconds: ( 18 * 5 + 27 ) * 60_000,
		focusedPauseMilliseconds: 1620000, reconsideredVisitCount: 18,
		completedWaitCount: 24, allowanceGrantedCount: 11 };
	statistics = { ...statistics, ...totals, dailyTotals: [ { date: statistics.currentDate, ...totals } ] };
	if ( original.includes( 'empty' ) ) {
		statistics = { ...statistics, estimatedReclaimedMilliseconds: 0, focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0, completedWaitCount: 0, allowanceGrantedCount: 0, dailyTotals: [] };
	}
	controls.unavailableStatistics = original.includes( 'statistics' ) && original.includes( 'unavailable' );
	controls.rejectResets = original.includes( 'failed' ) || original.includes( 'failure' );
}
if ( params.has( 'trends' ) && ! original ) {
	statistics = createStatisticsComparisonFixture();
}
shell.statisticsSource = {
	/**
	 * Supplies deterministic local counters.
	 * @return Available fixture statistics.
	 * @since 1.0.0
	 */
	readStatistics: () => original.includes( 'statistics-settings-screen-loading' )
		? Promise.withResolvers<StatisticsProjection>().promise : Promise.resolve( controls.unavailableStatistics
			? { status: StatisticsProjectionStatus.UNAVAILABLE } : statistics ),
	/**
	 * Records a reset and returns cleared local counters.
	 * @return Cleared fixture statistics.
	 * @since 1.0.0
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
			dailyTotals: [],
			...( original ? {} : { firstRecordedDate: null, visitOutcomes: {
				recordedFromDate: statistics.currentDate, dailySites: [], dailyHours: [],
			} } ),
		};
		return Promise.resolve( statistics );
	},
	/**
	 * Retains production subscriptions for lifecycle cleanup.
	 * @param listener - Statistics invalidation observer.
	 * @since 1.0.0
	 */
	addStatisticsChangeListener: ( listener ) => {
		statisticsListeners.add( listener );
	},
	/**
	 * Removes a screen's statistics subscription.
	 * @param listener - Previously registered observer.
	 * @since 1.0.0
	 */
	removeStatisticsChangeListener: ( listener ) => {
		statisticsListeners.delete( listener );
	},
};

/**
 * Acknowledges privacy resets without touching real storage.
 * @return Successful local reset acknowledgement.
 * @since 1.0.0
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

const backupFixture = createBackupFixture();
/**
 * Exports the current fixture settings without changing the live view.
 * @return Complete source documents for the production authority.
 * @since 1.1.0
 */
backupFixture.options.snapshot = () => Promise.resolve( { ...createBackupSource(), configuration, preferences } );
shell.backupActions = createBackupDataActions( {
	runtime: {
		/**
		 * Dispatches production client requests to the map-backed authority.
		 * @param request - Validated backup message.
		 * @return Authority completion or current generation.
		 * @since 1.1.0
		 */
		sendMessage( request ) {
			if ( request.type === 'export-local-backup' ) {
				if ( controls.holdBackupExports ) {
					return new Promise<void>( ( resolve ) => {
						pendingBackupExports.add( resolve );
					} ).then( () => backupFixture.backup.export() );
				}
				return backupFixture.backup.export();
			}
			if ( request.type === 'read-local-backup-state' ) {
				const marker = backupFixture.values[ LocalDataGenerationStorageKey ];
				return Promise.resolve( { status: 'ready', generation: typeof marker === 'object' && marker &&
					'generation' in marker ? marker.generation : null } );
			}
			backupFixture.setFailure( controls.rejectSaves ? 'target' : '' );
			if ( controls.holdConfigurationWrites ) {
				return new Promise<void>( ( resolve ) => {
					pendingConfigurationWrites.add( resolve );
				} )
					.then( () => backupFixture.backup.import( request ) );
			}
			return backupFixture.backup.import( request );
		},
	},
	permissions: {
		/**
		 * Records consent inside the actual click's browser activation.
		 * @return Current deterministic permission decision.
		 * @since 1.1.0
		 */
		requestMany() {
			controls.userActivation = navigator.userActivation.isActive;
			controls.requests++;
			return Promise.resolve( controls.denyAccess ? { status: SitePermissionRequestStatus.DENIED }
				: { status: SitePermissionRequestStatus.GRANTED, previousGrant: {} } );
		},
		/**
		 * Reflects actual access denial after successful rule replacement.
		 * @return Whether browser access is available.
		 * @since 1.1.0
		 */
		hasAccess: () => Promise.resolve( ! controls.denyAccess ),
	},
	/**
	 * Allocates a distinct confirmed intent for each new file preview.
	 * @return Fresh browser-local request identifier.
	 * @since 1.1.0
	 */
	createId: () => crypto.randomUUID(),
	/**
	 * Publishes complete restored documents through the fixture's production view boundaries.
	 * @return Completion of visible fixture refresh.
	 * @since 1.1.0
	 */
	onImported() {
		configuration = ProtectionConfigurationDocumentSchema.parse(
			backupFixture.values[ ProtectionConfigurationStorageKey.CONFIGURATION ],
		);
		preferences = PreferencesDocumentSchema.parse( backupFixture.values[ PreferencesStorageKey.PREFERENCES ] );
		notifyPreferences();
		return Promise.resolve();
	},
} );

const bridge: SettingsFixtureBridge = {
	themes: ThemeMode, palettes: Palette, languages: Language,
	controls,
	/**
	 * Supplies deterministic cached icons without contacting a favicon service.
	 * @param provider - Browser-only icon source for this scenario.
	 * @since 1.0.0
	 */
	setFaviconProvider: ( provider ) => {
		shell.faviconProvider = provider;
	},
	/** Completes held export requests through the actual backup authority. */
	releaseBackupExports: () => {
		controls.holdBackupExports = false;
		pendingBackupExports.forEach( ( resolve ) => {
			resolve();
		} );
		pendingBackupExports.clear();
	},
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
	 * @since 1.0.0
	 */
	externalStatistics: ( update ) => {
		statistics = AvailableStatisticsProjectionSchema.parse( { ...statistics, ...update } );
		statisticsListeners.forEach( ( listener ) => {
			listener();
		} );
	},
	/**
	 * Reads persisted configuration separately from React drafts.
	 * @return Current fixture configuration.
	 * @since 1.0.0
	 */
	getConfiguration: () => configuration,
	/**
	 * Reads persisted preferences separately from previews.
	 * @return Current fixture preferences.
	 * @since 1.0.0
	 */
	getPreferences: () => preferences,
	/**
	 * Reads authoritative fixture aggregates separately from rendered charts.
	 * @return Current local counters and recorded breakdowns.
	 */
	getStatistics: () => statistics,
	/**
	 * Simulates browser revocation then refreshes production access state.
	 * @return Access refresh completion.
	 * @since 1.0.0
	 */
	revoke: async () => {
		grants.clear();
		await shell.refreshAccessState();
	},
	/**
	 * Publishes a validated change from another extension context.
	 * @param update - Externally updated preference fields.
	 * @since 1.0.0
	 */
	externalPreferences: ( update ) => {
		preferences = PreferencesDocumentSchema.parse( { ...preferences, ...update } );
		notifyPreferences();
	},
};
window.settingsTest = bridge;
