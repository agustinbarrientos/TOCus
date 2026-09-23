import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { CompletionAction } from '../../../domains/protection/types/completion-action';
import { Weekday } from '../../../domains/protection/types/protection-schedule';
import { ToolbarBadgeDurationUnit } from '../../../features/protection-runtime/utils/toolbar-badge-projection/types';
import { createLocalizationBundle, loadLocalizationBundle } from '../../index';

describe( 'createLocalizationBundle', () => {
	it.each( [
		[ Language.ENGLISH, 'Your browser tries to use website icons from its own cache whenever it can. Sometimes this doesn\'t work. I set it up this way to keep TOCus completely private and avoid connecting to any icon service.' ],
		[ Language.SPANISH_TU, 'Tu navegador intenta usar los iconos de los sitios web de su propia cach\u00e9 siempre que puede. A veces esto no funciona. Lo configur\u00e9 as\u00ed para que TOCus sea completamente privado y no se conecte a ning\u00fan servicio de iconos.' ],
		[ Language.SPANISH_VOS, 'Tu navegador intenta usar los \u00edconos de los sitios web de su propia cach\u00e9 siempre que puede. A veces esto no funciona. Lo configur\u00e9 as\u00ed para que TOCus sea completamente privado y no se conecte a ning\u00fan servicio de \u00edconos.' ],
		[ Language.PORTUGUESE_BRAZIL, 'Seu navegador tenta usar os \u00edcones dos sites do pr\u00f3prio cache sempre que pode. \u00c0s vezes isso n\u00e3o funciona. Configurei dessa forma para manter o TOCus completamente privado e evitar conex\u00f5es com qualquer servi\u00e7o de \u00edcones.' ],
		[ Language.PORTUGUESE_PORTUGAL, 'O seu navegador tenta usar os \u00edcones dos sites da sua pr\u00f3pria cache sempre que pode. Por vezes isto n\u00e3o funciona. Configurei-o assim para manter o TOCus completamente privado e evitar liga\u00e7\u00f5es a qualquer servi\u00e7o de \u00edcones.' ],
		[ Language.ITALIAN, 'Il browser cerca di usare le icone dei siti web dalla propria cache quando pu\u00f2. A volte non funziona. Ho scelto questa soluzione per tutelare completamente la tua privacy con TOCus ed evitare collegamenti a servizi di icone.' ],
		[ Language.FRENCH, 'Votre navigateur essaie d\'utiliser les ic\u00f4nes des sites web de son propre cache quand c\'est possible. Parfois, cela ne fonctionne pas. J\'ai choisi ce fonctionnement pour pr\u00e9server enti\u00e8rement votre confidentialit\u00e9 avec TOCus et \u00e9viter toute connexion \u00e0 un service d\'ic\u00f4nes.' ],
		[ Language.GERMAN, 'Dein Browser versucht, Website-Symbole aus seinem eigenen Cache zu verwenden, wann immer das m\u00f6glich ist. Manchmal funktioniert das nicht. Ich habe es so eingerichtet, damit TOCus deine Privatsph\u00e4re vollst\u00e4ndig sch\u00fctzt und keine Verbindung zu einem Symboldienst herstellt.' ],
		[ Language.JAPANESE, '\u30d6\u30e9\u30a6\u30b6\u30fc\u306f\u3067\u304d\u308b\u9650\u308a\u3001\u81ea\u5206\u306e\u30ad\u30e3\u30c3\u30b7\u30e5\u304b\u3089\u30a6\u30a7\u30d6\u30b5\u30a4\u30c8\u306e\u30a2\u30a4\u30b3\u30f3\u3092\u8868\u793a\u3057\u3088\u3046\u3068\u3057\u307e\u3059\u3002\u3046\u307e\u304f\u3044\u304b\u306a\u3044\u3053\u3068\u3082\u3042\u308a\u307e\u3059\u3002TOCus\u306e\u30d7\u30e9\u30a4\u30d0\u30b7\u30fc\u3092\u5fb9\u5e95\u3057\u3066\u5b88\u308a\u3001\u30a2\u30a4\u30b3\u30f3\u63d0\u4f9b\u30b5\u30fc\u30d3\u30b9\u306b\u63a5\u7d9a\u3057\u306a\u3044\u3088\u3046\u3001\u3053\u306e\u4ed5\u7d44\u307f\u306b\u3057\u3066\u3044\u307e\u3059\u3002' ],
		[ Language.RUSSIAN, '\u0411\u0440\u0430\u0443\u0437\u0435\u0440 \u043f\u043e \u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442\u0438 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u0437\u043d\u0430\u0447\u043a\u0438 \u0441\u0430\u0439\u0442\u043e\u0432 \u0438\u0437 \u0441\u043e\u0431\u0441\u0442\u0432\u0435\u043d\u043d\u043e\u0433\u043e \u043a\u0435\u0448\u0430. \u0418\u043d\u043e\u0433\u0434\u0430 \u044d\u0442\u043e \u043d\u0435 \u043f\u043e\u043b\u0443\u0447\u0430\u0435\u0442\u0441\u044f. \u042f \u0432\u044b\u0431\u0440\u0430\u043b \u0442\u0430\u043a\u043e\u0439 \u043f\u043e\u0434\u0445\u043e\u0434, \u0447\u0442\u043e\u0431\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u043e\u043b\u043d\u0443\u044e \u043a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c TOCus \u0438 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0430\u0442\u044c\u0441\u044f \u043a \u0441\u0435\u0440\u0432\u0438\u0441\u0430\u043c \u0437\u043d\u0430\u0447\u043a\u043e\u0432.' ],
	] )( 'describes browser-local favicons without Chrome branding in %s', async ( language, expected ) => {
		const bundle = await loadLocalizationBundle( language );
		expect( bundle.privacyCopy.faviconPermission ).toBe( expected );
	} );

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
		expect( bundle.document.onboardingTitle ).toBe( 'Welcome to TOCus' );
		expect( bundle.onboarding.language.title ).toBe( 'Choose your language' );
		expect( bundle.onboarding.appearance.themeOptions.system.label ).toBe( 'System' );
		expect( bundle.onboarding.appearance.paletteLabels.brown ).toBe( 'Brown' );
		expect( bundle.onboarding.sites.suggestionsLegend ).toBe( 'Popular choices' );
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

	it.each( [
		[ Language.ENGLISH, 'Current website', 'TOCus is active' ],
		[ Language.SPANISH_TU, 'Sitio web actual', 'TOCus está activo' ],
		[ Language.SPANISH_VOS, 'Sitio web actual', 'TOCus está activo' ],
		[ Language.PORTUGUESE_BRAZIL, 'Site atual', 'O TOCus está ativo' ],
		[ Language.PORTUGUESE_PORTUGAL, 'Site atual', 'O TOCus está ativo' ],
		[ Language.ITALIAN, 'Sito web attuale', 'TOCus è attivo' ],
		[ Language.FRENCH, 'Site actuel', 'TOCus est actif' ],
		[ Language.GERMAN, 'Aktuelle Website', 'TOCus ist aktiv' ],
		[ Language.JAPANESE, '現在のウェブサイト', 'TOCus は有効です' ],
		[ Language.RUSSIAN, 'Текущий сайт', 'TOCus активен' ],
	] )( 'loads translated popup copy for %s', async ( language, currentWebsite, activeStatus ) => {
		const bundle = await loadLocalizationBundle( language );

		expect( bundle.popup.currentWebsite ).toBe( currentWebsite );
		expect( bundle.popup.tocusActive ).toBe( activeStatus );
	} );

	it.each( [
		[ Language.SPANISH_TU, 'Tiempo de pausas', 'Usar horario personalizado', 'Pausar sitio', 'Tiempo restante' ],
		[ Language.SPANISH_VOS, 'Tiempo de pausas', 'Usar horario personalizado', 'Pausar sitio', 'Tiempo restante' ],
		[ Language.PORTUGUESE_BRAZIL, 'Tempo das pausas', 'Usar horário personalizado', 'Pausar site', 'Tempo restante' ],
		[ Language.PORTUGUESE_PORTUGAL, 'Duração das pausas', 'Usar horário personalizado', 'Pausar site', 'Tempo restante' ],
		[ Language.ITALIAN, 'Tempi di pausa', 'Usa orari personalizzati', 'Metti in pausa il sito', 'Tempo rimanente' ],
		[ Language.FRENCH, 'Temps de pause', 'Utiliser des horaires personnalisés', 'Mettre le site en pause', 'Temps restant' ],
		[ Language.GERMAN, 'Pausenzeiten', 'Eigenen Zeitplan verwenden', 'Website pausieren', 'Verbleibende Zeit' ],
		[ Language.JAPANESE, '一時停止の時間設定', '個別のスケジュールを使う', 'サイトを一時停止', '残り時間' ],
		[ Language.RUSSIAN, 'Время пауз', 'Использовать своё расписание', 'Приостановить сайт', 'Оставшееся время' ],
	] )( 'loads the revised timing and popup labels for %s', async (
		language,
		pauseTiming,
		customSchedule,
		pauseSite,
		timeLeft,
	) => {
		const bundle = await loadLocalizationBundle( language );

		expect( bundle.settingsShell.timing ).toBe( pauseTiming );
		expect( bundle.timing.title ).toBe( pauseTiming );
		expect( bundle.protectedSites.customScheduleLabel ).toBe( customSchedule );
		expect( bundle.protectedSiteItem.customScheduleLabel ).toBe( customSchedule );
		expect( bundle.popup.pauseSite ).toBe( pauseSite );
		expect( bundle.popup.timeLeft ).toBe( timeLeft );
	} );

	it( 'provides every production copy slice and the pending local copy contracts', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.document.settingsTitle ).toBe( 'TOCus settings' );
		expect( bundle.popup.currentWebsite ).toBe( 'Current website' );
		expect( bundle.popup.pauseSite ).toBe( 'Pause site' );
		expect( bundle.settingsShell.navigationLabel ).toBe( 'Settings' );
		expect( bundle.aboutCopy.formatVersion( '2.3.4' ) ).toBe( 'Version 2.3.4' );
		expect( bundle.privacyCopy.title ).toBe( 'Privacy and local data' );
		expect( bundle.languageScreen.languageLabel ).toBe( 'TOCus language' );
		expect( bundle.appearance.themeOptions.system.label ).toBe( 'System' );
		expect( bundle.settingsShell.timing ).toBe( 'Pause timing' );
		expect( bundle.timing.title ).toBe( 'Pause timing' );
		expect( bundle.timing.initialWaitLabel ).toBe( 'Initial wait' );
		expect( bundle.protectedSites.emptyTitle ).toBe( 'No websites yet' );
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
		expect( bundle.schedule.formatWeekday( Weekday.MONDAY ) ).toBe( 'Monday' );
		expect( bundle.schedule.formatWindowLabel( 2 ) ).toBe( 'Time window 2' );
		expect( bundle.schedule.formatRemoveWindowLabel( 2 ) ).toBe( 'Remove time window 2' );
		expect( bundle.protectedSites.formatAddedAnnouncement( 'Reddit' ) ).toBe(
			'Reddit was added to your list.',
		);
		expect( bundle.protectedSiteItem.formatRemoveQuestion( 'Reddit' ) ).toBe( 'Remove Reddit?' );
		expect( bundle.interruption.formatRemainingTime( 12 ) ).toBe( '12s' );
		expect( bundle.protectedPageLayer.formatAllowanceWarning( 1 ) ).toBe(
			'Your visit window ends in 1 second.',
		);
		expect( bundle.protectedPageLayer.formatAllowanceWarning( 2 ) ).toBe( 'Your visit window ends in 2 seconds.' );
		expect( bundle.onboarding.formatStepProgress( 2, 3, 'Appearance' ) ).toBe( 'Step 2 of 3: Appearance' );
		expect( bundle.onboarding.sites.formatAddSuggestionLabel( 'Instagram' ) ).toBe( 'Add Instagram' );
	} );

	it( 'falls back to source English when one compiled translation is missing', () => {
		const bundle = createLocalizationBundle( Language.FRENCH, {} );

		expect( bundle.document.settingsTitle ).toBe( 'TOCus settings' );
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

		expect( bundle.protectedSiteList.compareNames( '\u00f1', 'nz' ) ).toBeGreaterThan( 0 );
		expect( bundle.protectedSites.compareNames( '\u00f1', 'nz' ) ).toBeGreaterThan( 0 );
	} );

	it( 'formats durations according to each copy contract', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.statistics.formatDuration( 0 ) ).toBe( '0 minutes' );
		expect( bundle.statistics.formatDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
		expect( bundle.statistics.formatDuration( 3_900_000 ) ).toBe( '1 hour, 5 minutes' );
		expect( bundle.statistics.formatEstimatedDuration( 0 ) ).toBe( 'Not enough data yet' );
		expect( bundle.statistics.formatEstimatedDuration( 30_000 ) ).toBe( 'Less than 1 minute' );
		expect( bundle.statistics.formatEstimatedDuration( 3_600_000 ) ).toBe( 'Approximately 1 hour' );
		expect( bundle.wellbeing.formatDuration( 30_000 ) ).toBe( '30 seconds' );
		expect( bundle.wellbeing.formatDuration( 3_900_000 ) ).toBe( '1 hour, 5 minutes' );
	} );

	it.each( [
		[ Language.ENGLISH, 'Not enough data yet' ],
		[ Language.SPANISH_TU, 'Todav\u00eda no hay suficientes datos' ],
		[ Language.SPANISH_VOS, 'Todav\u00eda no hay suficientes datos' ],
		[ Language.PORTUGUESE_BRAZIL, 'Ainda n\u00e3o h\u00e1 dados suficientes' ],
		[ Language.PORTUGUESE_PORTUGAL, 'Ainda n\u00e3o h\u00e1 dados suficientes' ],
		[ Language.ITALIAN, 'Non ci sono ancora dati sufficienti' ],
		[ Language.FRENCH, 'Pas encore assez de donn\u00e9es' ],
		[ Language.GERMAN, 'Noch nicht gen\u00fcgend Daten' ],
		[ Language.JAPANESE, '\u307e\u3060\u5341\u5206\u306a\u30c7\u30fc\u30bf\u304c\u3042\u308a\u307e\u305b\u3093' ],
		[ Language.RUSSIAN, '\u041f\u043e\u043a\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0434\u0430\u043d\u043d\u044b\u0445' ],
	] )( 'shows the zero estimate fallback through the %s catalog', async ( language, expected ) => {
		const bundle = await loadLocalizationBundle( language );

		expect( bundle.statistics.formatEstimatedDuration( 0 ) ).toBe( expected );
	} );

	it.each( [
		[ Language.ENGLISH, 'Approximately 2 minutes' ],
		[ Language.SPANISH_TU, 'Aproximadamente 2 minutos' ],
		[ Language.SPANISH_VOS, 'Aproximadamente 2 minutos' ],
		[ Language.PORTUGUESE_BRAZIL, 'Aproximadamente 2 minutos' ],
		[ Language.PORTUGUESE_PORTUGAL, 'Aproximadamente 2 minutos' ],
		[ Language.ITALIAN, 'Circa 2 minuti' ],
		[ Language.FRENCH, 'Environ 2 minutes' ],
		[ Language.GERMAN, 'Ungefähr 2 Minuten' ],
		[ Language.JAPANESE, '約2 分' ],
		[ Language.RUSSIAN, 'Примерно 2 минуты' ],
	] )( 'formats the approximate reclaimed duration through the %s catalog', async ( language, expected ) => {
		const bundle = await loadLocalizationBundle( language );

		expect( bundle.statistics.formatEstimatedDuration( 100_000 ) ).toBe( expected );
	} );

	it( 'uses one complete timing-summary template for each completion action', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );

		expect( bundle.timing.formatSummary( 5, 10, 60, 5, CompletionAction.SHOW_CONTINUE ) ).toBe(
			'Waits start at 5 seconds. Each completed wait adds 10 seconds to the next wait, up to 60 seconds. After the wait, choosing Continue starts an allowance for 5 minutes.',
		);
		expect( bundle.timing.formatSummary( 5, 10, 60, 1, CompletionAction.OPEN_AUTOMATICALLY ) ).toBe(
			'Waits start at 5 seconds. Each completed wait adds 10 seconds to the next wait, up to 60 seconds. When the site opens automatically after the wait, an allowance starts for 1 minute.',
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
			"Since you started, you've given yourself about 9 minutes back, including 4 minutes spent pausing.",
		);
	} );

	it( 'formats every toolbar state with localized full title templates', async () => {
		const bundle = await loadLocalizationBundle( Language.ENGLISH );
		const multipleIndicator = bundle.toolbar.formatMultipleIndicator( 120 );

		expect( bundle.toolbar.formatActiveTitle( 'Pause: complete' ) ).toBe( 'TOCus: Pause: complete' );
		expect( bundle.toolbar.formatMultipleIndicator( 2 ) ).toBe( '2\u00d7' );
		expect( multipleIndicator ).toBe( '99+' );

		expect( bundle.toolbar.formatWaiting( 0, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: '0s',
			title: 'Pause: complete',
		} );
		expect( bundle.toolbar.formatWaiting( 2, ToolbarBadgeDurationUnit.MINUTE ) ).toEqual( {
			text: '2m',
			title: 'Pause: 2 minutes remaining',
		} );
		expect( bundle.toolbar.formatAllowance( 30, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: '30s',
			title: 'Visit window: 30 seconds remaining',
		} );
		expect( bundle.toolbar.formatAllowance( 0, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: '0s',
			title: 'Visit window: complete',
		} );
		expect( bundle.toolbar.formatMultipleActive( 120, multipleIndicator ) ).toEqual( {
			text: '99+',
			title: '120 timers active',
		} );
	} );

	it( 'uses locale-specific punctuation and compact toolbar indicators', async () => {
		const japanese = await loadLocalizationBundle( Language.JAPANESE );
		const russian = await loadLocalizationBundle( Language.RUSSIAN );

		expect( japanese.toolbar.formatActiveTitle( '\u4e00\u6642\u505c\u6b62\uff1a\u5b8c\u4e86' ) ).toBe( 'TOCus\uff1a\u4e00\u6642\u505c\u6b62\uff1a\u5b8c\u4e86' );
		expect( japanese.toolbar.formatMultipleIndicator( 2 ) ).toBe( '2\u4ef6' );
		expect( japanese.toolbar.formatMultipleIndicator( 120 ) ).toBe( '99\u4ef6+' );
		expect( russian.toolbar.formatMultipleIndicator( 2 ) ).toBe( '2\u00d7' );
		expect( russian.toolbar.formatMultipleIndicator( 120 ) ).toBe( '99+' );
		expect( russian.toolbar.formatAllowance( 1, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: '1s',
			title: 'Период доступа: осталась 1 секунда',
		} );
		expect( russian.toolbar.formatAllowance( 2, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: '2s',
			title: 'Период доступа: осталось 2 секунды',
		} );
		expect( russian.toolbar.formatAllowance( 5, ToolbarBadgeDurationUnit.SECOND ) ).toEqual( {
			text: '5s',
			title: 'Период доступа: осталось 5 секунд',
		} );
	} );

	it.each( [
		{ language: Language.ENGLISH, singular: '1s', plural: '2s' },
		{ language: Language.GERMAN, singular: '1s', plural: '2s' },
		{ language: Language.SPANISH_TU, singular: '1s', plural: '2s' },
		{ language: Language.SPANISH_VOS, singular: '1s', plural: '2s' },
		{ language: Language.PORTUGUESE_BRAZIL, singular: '1s', plural: '2s' },
		{ language: Language.PORTUGUESE_PORTUGAL, singular: '1s', plural: '2s' },
		{ language: Language.ITALIAN, singular: '1s', plural: '2s' },
		{ language: Language.FRENCH, singular: '1s', plural: '2s' },
		{ language: Language.JAPANESE, singular: '1秒', plural: '2秒' },
		{ language: Language.RUSSIAN, singular: '1с', plural: '2с' },
	] )( 'uses compact localized interruption countdowns for $language', async ( expectation ) => {
		const bundle = await loadLocalizationBundle( expectation.language );

		expect( bundle.interruption.formatRemainingTime( 1 ) ).toBe( expectation.singular );
		expect( bundle.interruption.formatRemainingTime( 2 ) ).toBe( expectation.plural );
	} );

	it.each( Object.values( Language ).filter( ( language ) => language !== Language.ENGLISH ) )(
		'loads translated schedule quick actions through the %s catalog',
		async ( language ) => {
			const bundle = await loadLocalizationBundle( language );
			const english = await loadLocalizationBundle( Language.ENGLISH );
			const messageKeys = [
				'presetWeekdaysWorkingHours',
				'presetWeekdaysAllDay',
				'presetWeekendsAllDay',
				'clearWindows',
				'clearWindowsTitle',
				'clearWindowsDescription',
				'cancelClearWindows',
				'emptyWindowsMessage',
				'allDayLabel',
			] as const;

			for ( const key of messageKeys ) {
				expect( bundle.schedule[ key ].trim(), key ).not.toBe( '' );
				expect( bundle.schedule[ key ], key ).not.toBe( english.schedule[ key ] );
			}

			expect( new Set( [
				bundle.schedule.presetWeekdaysWorkingHours,
				bundle.schedule.presetWeekdaysAllDay,
				bundle.schedule.presetWeekendsAllDay,
			] ).size ).toBe( 3 );
		},
	);

	it( 'keeps regional language variants independently authored', async () => {
		const spanishTu = await loadLocalizationBundle( Language.SPANISH_TU );
		const spanishVos = await loadLocalizationBundle( Language.SPANISH_VOS );
		const portugueseBrazil = await loadLocalizationBundle( Language.PORTUGUESE_BRAZIL );
		const portuguesePortugal = await loadLocalizationBundle( Language.PORTUGUESE_PORTUGAL );

		for ( const bundle of [ spanishTu, spanishVos ] ) {
			expect( bundle.onboarding.stepNames.sites ).toBe( 'Sitios web' );
			expect( bundle.settingsShell.protectedSites ).toBe( 'Sitios web' );
			expect( bundle.protectedSites.title ).toBe( 'Sitios web' );
			expect( bundle.settingsShell.schedule ).toBe( 'Horario' );
			expect( bundle.schedule.title ).toBe( 'Horario' );
		}

		expect( spanishTu.settingsShell.unsavedChangesDescription )
			.not.toBe( spanishVos.settingsShell.unsavedChangesDescription );
		expect( spanishTu.schedule.presetWeekdaysWorkingHours ).toBe( spanishVos.schedule.presetWeekdaysWorkingHours );
		expect( spanishTu.schedule.presetWeekdaysAllDay ).toBe( spanishVos.schedule.presetWeekdaysAllDay );
		expect( spanishTu.schedule.presetWeekendsAllDay ).toBe( spanishVos.schedule.presetWeekendsAllDay );
		expect( spanishTu.schedule.clearWindowsTitle ).toBe( spanishVos.schedule.clearWindowsTitle );
		expect( spanishTu.schedule.clearWindowsDescription ).not.toBe( spanishVos.schedule.clearWindowsDescription );
		expect( spanishTu.schedule.emptyWindowsMessage ).not.toBe( spanishVos.schedule.emptyWindowsMessage );
		expect( portugueseBrazil.settingsShell.unsavedChangesTitle )
			.not.toBe( portuguesePortugal.settingsShell.unsavedChangesTitle );
	} );

	it.each( Object.values( Language ) )( 'creates nonempty dynamic messages for %s', async ( language ) => {
		const bundle = await loadLocalizationBundle( language );
		const messages = [
			bundle.languageScreen.formatBrowserLanguageDescription( 'English' ),
			bundle.onboarding.formatStepProgress( 2, 3, bundle.onboarding.stepNames.appearance ),
			bundle.onboarding.appearance.previewTitle,
			bundle.onboarding.sites.formatAddSuggestionLabel( 'Instagram' ),
			bundle.onboarding.sites.formatAddingSuggestionLabel( 'Instagram' ),
			bundle.onboarding.sites.formatAddedSuggestionLabel( 'Instagram' ),
			bundle.onboarding.sites.formatAddedAnnouncement( 'Instagram' ),
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
