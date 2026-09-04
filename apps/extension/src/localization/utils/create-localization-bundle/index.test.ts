import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { CompletionAction } from '../../../domains/protection/types/completion-action';
import { Weekday } from '../../../domains/protection/types/protection-schedule';
import { ToolbarBadgeDurationUnit } from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import { loadLocalizationCatalog } from '../../catalogs';
import { createLocalizationBundle, loadLocalizationBundle } from '../../index';

describe( 'createLocalizationBundle', () => {
	it( 'loads one complete localization bundle through the packaged catalog boundary', async () => {
		const bundle = await loadLocalizationBundle( Language.FRENCH );

		expect( bundle.language ).toBe( Language.FRENCH );
		expect( bundle.document.settingsTitle ).toBe( 'Param\u00e8tres de TOCus' );
	} );

	it( 'falls back to packaged English when a requested locale chunk cannot load', async () => {
		const bundle = await loadLocalizationBundle(
			Language.FRENCH,
			() => Promise.reject( new Error( 'Packaged chunk unavailable.' ) ),
		);

		expect( bundle.language ).toBe( Language.ENGLISH );
		expect( bundle.languageTag ).toBe( 'en' );
		expect( bundle.document.settingsTitle ).toBe( 'TOCus settings' );
	} );

	it.each( [
		[ Language.ENGLISH, 'en' ],
		[ Language.SPANISH_TU, 'es' ],
		[ Language.SPANISH_VOS, 'es-AR' ],
		[ Language.PORTUGUESE_BRAZIL, 'pt-BR' ],
		[ Language.PORTUGUESE_PORTUGAL, 'pt-PT' ],
		[ Language.ITALIAN, 'it' ],
		[ Language.FRENCH, 'fr' ],
		[ Language.GERMAN, 'de' ],
		[ Language.JAPANESE, 'ja' ],
		[ Language.RUSSIAN, 'ru' ],
	] )( 'uses the valid document language tag for %s', async ( language, expectedLanguageTag ) => {
		const bundle = await loadLocalizationBundle( language );

		expect( bundle.language ).toBe( language );
		expect( bundle.languageTag ).toBe( expectedLanguageTag );
		expect( Intl.getCanonicalLocales( bundle.languageTag ) ).toEqual( [ expectedLanguageTag ] );
	} );

	it( 'provides every production copy slice and the pending local copy contracts', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.document.settingsTitle ).toBe( 'TOCus settings' );
		expect( bundle.popup.status ).toBe( 'Early development' );
		expect( bundle.settingsShell.navigationLabel ).toBe( 'Settings' );
		expect( bundle.languageScreen.languageLabel ).toBe( 'TOCus language' );
		expect( bundle.appearance.themeOptions.system.label ).toBe( 'System' );
		expect( bundle.schedule.sharedScope ).toBe( 'Shared protection' );
		expect( bundle.timing.initialWaitLabel ).toBe( 'Initial wait' );
		expect( bundle.protectedSites.emptyTitle ).toBe( 'No protected sites yet' );
		expect( bundle.protectedSiteList.sharedGroupTitle ).toBe( 'Shared protection' );
		expect( bundle.protectedSiteItem.accessRequired ).toBe( 'Access required' );
		expect( bundle.statistics.allTimeTitle ).toBe( 'All time' );
		expect( bundle.interruption.takeAMoment ).toBe( 'Take a moment' );
		expect( bundle.protectedPageLayer.dialogLabel ).toBe( 'TOCus pause' );
		expect( bundle.wellbeing.neutral ).toBe( 'This is a moment just for you.' );
		expect( bundle.toolbar.inactive ).toEqual( { text: '', title: 'TOCus' } );
	} );

	it( 'formats dynamic screen messages with complete localized templates', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.languageScreen.formatBrowserLanguageDescription( 'English' ) ).toBe(
			'Your browser currently selects English.',
		);
		expect( bundle.schedule.formatIndependentScopeLabel( 'Reddit', 'reddit.com' ) ).toBe( 'Reddit (reddit.com)' );
		expect( bundle.schedule.formatWeekday( Weekday.MONDAY ) ).toBe( 'Monday' );
		expect( bundle.schedule.formatWindowLabel( 2 ) ).toBe( 'Time window 2' );
		expect( bundle.schedule.formatRemoveWindowLabel( 2 ) ).toBe( 'Remove time window 2' );
		expect( bundle.protectedSites.formatAddedAnnouncement( 'Reddit' ) ).toBe(
			'Reddit was added to protected sites.',
		);
		expect( bundle.protectedSiteItem.formatBoundary( 'reddit.com', true ) ).toBe(
			'Protects reddit.com and its subdomains',
		);
		expect( bundle.protectedSiteItem.formatBoundary( 'reddit.com', false ) ).toBe( 'Protects only reddit.com' );
		expect( bundle.protectedSiteItem.formatRemoveQuestion( 'Reddit' ) ).toBe( 'Remove Reddit?' );
		expect( bundle.interruption.formatRemainingTime( 12 ) ).toBe( '12s remaining' );
		expect( bundle.protectedPageLayer.formatAllowanceWarning( 1 ) ).toBe(
			'Your visit window ends in 1 second.',
		);
		expect( bundle.protectedPageLayer.formatAllowanceWarning( 2 ) ).toBe( 'Your visit window ends in 2 seconds.' );
	} );

	it( 'rejects a translator template whose named value is unavailable', async () => {
		const catalog = await loadLocalizationCatalog( Language.ENGLISH );
		const bundle = createLocalizationBundle( Language.ENGLISH, {
			...catalog,
			languageScreen: {
				...catalog.languageScreen,
				browserLanguageDescription: '{missing}',
			},
		} );

		expect( () => bundle.languageScreen.formatBrowserLanguageDescription( 'English' ) ).toThrow(
			'No localized value was provided for {missing}.',
		);
	} );

	it( 'formats numbers and plural categories with the selected locale', async () => {
		const german = await loadLocalizationBundle( Language.GERMAN );
		const russian = await loadLocalizationBundle( Language.RUSSIAN );

		expect( german.statistics.formatCount( 1_234 ) ).toBe( '1.234' );
		expect( russian.timing.formatSecondsOption( 1 ) ).toBe( '\u0031 \u0441\u0435\u043a\u0443\u043d\u0434\u0430' );
		expect( russian.timing.formatSecondsOption( 2 ) ).toBe( '\u0032 \u0441\u0435\u043a\u0443\u043d\u0434\u044b' );
		expect( russian.timing.formatSecondsOption( 5 ) ).toBe( '\u0035 \u0441\u0435\u043a\u0443\u043d\u0434' );
		expect( russian.timing.formatSecondsOption( 21 ) ).toBe( '\u0032\u0031 \u0441\u0435\u043a\u0443\u043d\u0434\u0430' );
	} );

	it( 'compares translated names with one selected-locale collation policy', async () => {
		const bundle = await loadLocalizationBundle( Language.SPANISH_TU );

		expect( bundle.schedule.compareNames( '\u00f1', 'nz' ) ).toBeGreaterThan( 0 );
		expect( bundle.protectedSiteList.compareNames( '\u00f1', 'nz' ) ).toBeGreaterThan( 0 );
		expect( bundle.protectedSites.compareNames( '\u00f1', 'nz' ) ).toBeGreaterThan( 0 );
	} );

	it( 'formats durations according to each copy contract', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.statistics.formatDuration( 0 ) ).toBe( '0 minutes' );
		expect( bundle.statistics.formatDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
		expect( bundle.statistics.formatDuration( 3_900_000 ) ).toBe( '1 hour, 5 minutes' );
		expect( bundle.statistics.formatEstimatedDuration( 0 ) ).toBe( 'About 0 minutes' );
		expect( bundle.statistics.formatEstimatedDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
		expect( bundle.statistics.formatEstimatedDuration( 3_600_000 ) ).toBe( 'About 1 hour' );
		expect( bundle.wellbeing.formatDuration( 30_000 ) ).toBe( '30 seconds' );
		expect( bundle.wellbeing.formatDuration( 3_900_000 ) ).toBe( '1 hour, 5 minutes' );
	} );

	it( 'uses one complete timing-summary template for each completion action', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.timing.formatSummary( 5, 10, 60, 5, CompletionAction.SHOW_CONTINUE ) ).toBe(
			'Waits start at 5 seconds. Each completed wait adds 10 seconds to the next wait, up to 60 seconds. Completing a wait starts an allowance for 5 minutes and shows a Continue button.',
		);
		expect( bundle.timing.formatSummary( 5, 10, 60, 1, CompletionAction.OPEN_AUTOMATICALLY ) ).toBe(
			'Waits start at 5 seconds. Each completed wait adds 10 seconds to the next wait, up to 60 seconds. Completing a wait starts an allowance for 1 minute and opens the site automatically.',
		);
	} );

	it( 'uses complete wellbeing templates for every available-value combination', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.wellbeing.formatSummary( {
			estimatedReclaimedTime: null,
			focusedPauseTime: null,
		} ) ).toBe( bundle.wellbeing.neutral );
		expect( bundle.wellbeing.formatSummary( {
			estimatedReclaimedTime: null,
			focusedPauseTime: '4 minutes',
		} ) ).toBe( "Since you started, you've taken 4 minutes for yourself." );
		expect( bundle.wellbeing.formatSummary( {
			estimatedReclaimedTime: '9 minutes',
			focusedPauseTime: null,
		} ) ).toBe( "Since you started, you've given yourself about 9 minutes back." );
		expect( bundle.wellbeing.formatSummary( {
			estimatedReclaimedTime: '9 minutes',
			focusedPauseTime: '4 minutes',
		} ) ).toBe(
			"Since you started, you've given yourself about 9 minutes back and taken 4 minutes for yourself.",
		);
	} );

	it( 'formats every toolbar state with localized full title templates', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );
		const multipleIndicator = bundle.toolbar.formatMultipleIndicator( 120 );

		expect( bundle.toolbar.formatActiveTitle( 'Pause: complete' ) ).toBe( 'TOCus: Pause: complete' );
		expect( bundle.toolbar.formatMultipleIndicator( 2 ) ).toBe( '2×' );
		expect( multipleIndicator ).toBe( '99+' );

		expect( bundle.toolbar.formatWaiting( 0, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: 'P0s',
			title: 'Pause: complete',
		} );
		expect( bundle.toolbar.formatWaiting( 2, ToolbarBadgeDurationUnit.MINUTE ) ).toEqual( {
			text: 'P2m',
			title: 'Pause: 2 minutes remaining',
		} );
		expect( bundle.toolbar.formatAllowance( 1, ToolbarBadgeDurationUnit.LESS_THAN_MINUTE ) ).toEqual( {
			text: 'V<1m',
			title: 'Visit window: less than 1 minute remaining',
		} );
		expect( bundle.toolbar.formatAllowance( 0, ToolbarBadgeDurationUnit.LESS_THAN_MINUTE ) ).toEqual( {
			text: 'V0m',
			title: 'Visit window: complete',
		} );
		expect( bundle.toolbar.formatMultipleActive( 120, multipleIndicator ) ).toEqual( {
			text: '99+',
			title: '120 protected-site timers active',
		} );
	} );

	it( 'uses locale-specific punctuation and compact toolbar indicators', async () => {
		const japanese = await loadLocalizationBundle( Language.JAPANESE );
		const russian = await loadLocalizationBundle( Language.RUSSIAN );

		expect( japanese.toolbar.formatActiveTitle( '一時停止：完了' ) ).toBe( 'TOCus：一時停止：完了' );
		expect( japanese.toolbar.formatMultipleIndicator( 2 ) ).toBe( '2件' );
		expect( japanese.toolbar.formatMultipleIndicator( 120 ) ).toBe( '99件+' );
		expect( russian.toolbar.formatMultipleIndicator( 2 ) ).toBe( '2×' );
		expect( russian.toolbar.formatMultipleIndicator( 120 ) ).toBe( '99+' );
	} );

	it.each( [
		{ language: Language.SPANISH_TU, singular: 'Queda 1 s', plural: 'Quedan 2 s' },
		{ language: Language.SPANISH_VOS, singular: 'Queda 1 s', plural: 'Quedan 2 s' },
		{ language: Language.PORTUGUESE_BRAZIL, singular: 'Resta 1 s', plural: 'Restam 2 s' },
		{ language: Language.PORTUGUESE_PORTUGAL, singular: 'Falta 1 s', plural: 'Faltam 2 s' },
		{ language: Language.ITALIAN, singular: '1s rimanente', plural: '2s rimanenti' },
		{ language: Language.FRENCH, singular: '1s restante', plural: '2s restantes' },
	] )( 'uses singular and plural interruption countdown grammar for $language', async ( expectation ) => {
		const bundle = await loadLocalizationBundle( expectation.language );

		expect( bundle.interruption.formatRemainingTime( 1 ) ).toBe( expectation.singular );
		expect( bundle.interruption.formatRemainingTime( 2 ) ).toBe( expectation.plural );
	} );

	it( 'keeps regional language variants independently authored', async () => {
		const spanishTu = await loadLocalizationBundle( Language.SPANISH_TU );
		const spanishVos = await loadLocalizationBundle( Language.SPANISH_VOS );
		const portugueseBrazil = await loadLocalizationBundle( Language.PORTUGUESE_BRAZIL );
		const portuguesePortugal = await loadLocalizationBundle( Language.PORTUGUESE_PORTUGAL );

		expect( spanishTu.languageScreen.introduction ).not.toBe( spanishVos.languageScreen.introduction );
		expect( portugueseBrazil.languageScreen.introduction ).not.toBe(
			portuguesePortugal.languageScreen.introduction,
		);
	} );

	it.each( Object.values( Language ) )( 'creates nonempty dynamic messages for %s', async ( language ) => {
		const bundle = await loadLocalizationBundle( language );
		const messages = [
			bundle.languageScreen.formatBrowserLanguageDescription( 'English' ),
			bundle.schedule.formatIndependentScopeLabel( 'Reddit', 'reddit.com' ),
			bundle.schedule.formatWeekday( Weekday.SUNDAY ),
			bundle.schedule.formatWindowLabel( 3 ),
			bundle.schedule.formatRemoveWindowLabel( 3 ),
			bundle.timing.formatSecondsOption( 2 ),
			bundle.timing.formatMinutesOption( 2 ),
			bundle.timing.formatSummary( 5, 10, 60, 5, CompletionAction.SHOW_CONTINUE ),
			bundle.protectedSites.formatAddedAnnouncement( 'Reddit' ),
			bundle.protectedSites.formatUpdatedAnnouncement( 'Reddit' ),
			bundle.protectedSites.formatRemovedAnnouncement( 'Reddit' ),
			bundle.protectedSites.formatPermissionRetainedAnnouncement( 'Reddit' ),
			bundle.protectedSites.formatAccessRestoredAnnouncement( 'Reddit' ),
			bundle.protectedSiteItem.formatBoundary( 'reddit.com', true ),
			bundle.protectedSiteItem.formatRemoveQuestion( 'Reddit' ),
			bundle.statistics.formatEstimatedDuration( 90_000 ),
			bundle.statistics.formatDuration( 90_000 ),
			bundle.statistics.formatCount( 1_234 ),
			bundle.interruption.formatRemainingTime( 12 ),
			bundle.protectedPageLayer.formatAllowanceWarning( 12 ),
			bundle.wellbeing.formatDuration( 90_000 ),
			bundle.wellbeing.formatSummary( {
				estimatedReclaimedTime: '9 minutes',
				focusedPauseTime: '4 minutes',
			} ),
			bundle.toolbar.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
			bundle.toolbar.formatAllowance( 2, ToolbarBadgeDurationUnit.MINUTE ).title,
			bundle.toolbar.formatActiveTitle(
				bundle.toolbar.formatWaiting( 2, ToolbarBadgeDurationUnit.SECOND ).title,
			),
			bundle.toolbar.formatMultipleIndicator( 2 ),
			bundle.toolbar.formatMultipleActive( 2, bundle.toolbar.formatMultipleIndicator( 2 ) ).title,
		];

		for ( const message of messages ) {
			expect( message.trim() ).not.toBe( '' );
		}
	} );
} );
