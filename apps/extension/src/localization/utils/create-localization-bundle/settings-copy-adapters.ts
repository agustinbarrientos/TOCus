import {
	Palette,
	PauseMode,
	ThemeMode,
} from '../../../domains/preferences/types';
import {
	CompletionAction,
	type CompletionAction as CompletionActionValue,
} from '../../../domains/protection/types/completion-action';
import { type Weekday } from '../../../domains/protection/types/protection-schedule';
import { type LocalizationCatalog } from '../../catalogs/types';
import {
	formatDurationUnit,
	formatMessage,
	formatMinuteDuration,
	MILLISECONDS_PER_MINUTE,
} from './formatters';
import {
	type LocalizationBundle,
	type LocalizationFormatters,
} from './types';

/**
 * Creates the Language-screen copy adapter.
 * @param catalog - Selected translator catalog.
 * @return Typed Language-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createLanguageScreenCopy( catalog: LocalizationCatalog ): LocalizationBundle[ 'languageScreen' ] {
	const {
		browserLanguageDescription,
		...messages
	} = catalog.languageScreen;

	/**
	 * Formats the current browser-derived language explanation.
	 * @param name - Autonym for the resolved browser language.
	 * @return Complete localized helper sentence.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatBrowserLanguageDescription( name: string ): string {
		return formatMessage( browserLanguageDescription, { name } );
	}

	return Object.freeze( {
		...messages,
		formatBrowserLanguageDescription,
	} ) satisfies LocalizationBundle[ 'languageScreen' ];
}

/**
 * Creates the Appearance-screen copy adapter.
 * @param catalog - Selected translator catalog.
 * @return Typed Appearance-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createAppearanceCopy( catalog: LocalizationCatalog ): LocalizationBundle[ 'appearance' ] {
	const { options, palettes, ...messages } = catalog.appearance;

	return Object.freeze( {
		...messages,
		themeOptions: Object.freeze( {
			[ ThemeMode.SYSTEM ]: Object.freeze( options.system ),
			[ ThemeMode.LIGHT ]: Object.freeze( options.light ),
			[ ThemeMode.DARK ]: Object.freeze( options.dark ),
		} ),
		paletteLabels: Object.freeze( {
			[ Palette.BROWN ]: palettes.brown,
			[ Palette.GREEN ]: palettes.green,
			[ Palette.BLUE ]: palettes.blue,
			[ Palette.PURPLE ]: palettes.purple,
			[ Palette.PINK ]: palettes.pink,
			[ Palette.ORANGE ]: palettes.orange,
		} ),
		pauseModeOptions: Object.freeze( {
			[ PauseMode.BREATHING ]: Object.freeze( options.breathing ),
			[ PauseMode.QUIET ]: Object.freeze( options.quiet ),
		} ),
	} ) satisfies LocalizationBundle[ 'appearance' ];
}

/**
 * Creates the Schedule-screen copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed Schedule-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createScheduleCopy(
	catalog: LocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'schedule' ] {
	const {
		independentScopeLabel,
		weekdays,
		windowLabel,
		removeWindowLabel,
		...messages
	} = catalog.schedule;

	/**
	 * Formats one independent protection scope.
	 * @param name - Resolved local site name.
	 * @param domain - Exact configured domain.
	 * @return Complete localized scope label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatIndependentScopeLabel( name: string, domain: string ): string {
		return formatMessage( independentScopeLabel, { name, domain } );
	}

	/**
	 * Resolves one stable domain weekday to its localized label.
	 * @param weekday - Stable weekday domain value.
	 * @return Localized weekday label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatWeekday( weekday: Weekday ): string {
		return weekdays[ weekday ];
	}

	/**
	 * Formats one accessible time-window group label.
	 * @param position - One-based visual position.
	 * @return Complete localized group label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatWindowLabel( position: number ): string {
		return formatMessage( windowLabel, {
			position: formatters.number.format( position ),
		} );
	}

	/**
	 * Formats one contextual remove-window action.
	 * @param position - One-based visual position.
	 * @return Complete localized action label.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemoveWindowLabel( position: number ): string {
		return formatMessage( removeWindowLabel, {
			position: formatters.number.format( position ),
		} );
	}

	/**
	 * Compares two scope names using the selected language.
	 * @param firstName - First scope name.
	 * @param secondName - Second scope name.
	 * @return Locale-sensitive collation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function compareNames( firstName: string, secondName: string ): number {
		return formatters.collator.compare( firstName, secondName );
	}

	return Object.freeze( {
		...messages,
		formatIndependentScopeLabel,
		formatWeekday,
		formatWindowLabel,
		formatRemoveWindowLabel,
		compareNames,
	} ) satisfies LocalizationBundle[ 'schedule' ];
}

/**
 * Creates the Timing-screen copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed Timing-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createTimingCopy(
	catalog: LocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'timing' ] {
	const {
		summaryShowContinue,
		summaryOpenAutomatically,
		...messages
	} = catalog.timing;

	/**
	 * Formats one whole-second option.
	 * @param seconds - Allowed whole seconds.
	 * @return Localized duration option.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatSecondsOption( seconds: number ): string {
		return formatDurationUnit( seconds, catalog.units.second, formatters );
	}

	/**
	 * Formats one whole-minute option.
	 * @param minutes - Allowed whole minutes.
	 * @return Localized duration option.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatMinutesOption( minutes: number ): string {
		return formatDurationUnit( minutes, catalog.units.minute, formatters );
	}

	/**
	 * Formats the complete timing summary for one draft.
	 * @param initialWaitSeconds - Draft initial wait.
	 * @param waitIncreaseSeconds - Draft daily increase.
	 * @param maximumWaitSeconds - Draft maximum wait.
	 * @param allowanceMinutes - Draft allowance.
	 * @param completionAction - Draft post-wait action.
	 * @return Complete localized timing summary.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatSummary(
		initialWaitSeconds: number,
		waitIncreaseSeconds: number,
		maximumWaitSeconds: number,
		allowanceMinutes: number,
		completionAction: CompletionActionValue,
	): string {
		const template = completionAction === CompletionAction.OPEN_AUTOMATICALLY
			? summaryOpenAutomatically
			: summaryShowContinue;

		return formatMessage( template, {
			initialWait: formatSecondsOption( initialWaitSeconds ),
			waitIncrease: formatSecondsOption( waitIncreaseSeconds ),
			maximumWait: formatSecondsOption( maximumWaitSeconds ),
			allowance: formatMinutesOption( allowanceMinutes ),
		} );
	}

	return Object.freeze( {
		...messages,
		formatSecondsOption,
		formatMinutesOption,
		formatSummary,
	} ) satisfies LocalizationBundle[ 'timing' ];
}

/**
 * Creates the Protected-sites screen and list copy adapters.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed Protected-sites copy slices.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedSitesCopy(
	catalog: LocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'protectedSites' ] {
	const {
		addedAnnouncement,
		updatedAnnouncement,
		removedAnnouncement,
		permissionRetainedAnnouncement,
		accessRestoredAnnouncement,
		...messages
	} = catalog.protectedSites;

	/**
	 * Formats one addition announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAddedAnnouncement( name: string ): string {
		return formatMessage( addedAnnouncement, { name } );
	}

	/**
	 * Formats one update announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatUpdatedAnnouncement( name: string ): string {
		return formatMessage( updatedAnnouncement, { name } );
	}

	/**
	 * Formats one removal announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemovedAnnouncement( name: string ): string {
		return formatMessage( removedAnnouncement, { name } );
	}

	/**
	 * Formats one retained-permission announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatPermissionRetainedAnnouncement( name: string ): string {
		return formatMessage( permissionRetainedAnnouncement, { name } );
	}

	/**
	 * Formats one restored-access announcement.
	 * @param name - Resolved local site name.
	 * @return Complete localized announcement.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatAccessRestoredAnnouncement( name: string ): string {
		return formatMessage( accessRestoredAnnouncement, { name } );
	}

	/**
	 * Compares two protected-site names using the selected language.
	 * @param firstName - First protected-site name.
	 * @param secondName - Second protected-site name.
	 * @return Locale-sensitive collation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function compareNames( firstName: string, secondName: string ): number {
		return formatters.collator.compare( firstName, secondName );
	}

	return Object.freeze( {
		...catalog.protectedSiteList,
		...messages,
		formatAddedAnnouncement,
		formatUpdatedAnnouncement,
		formatRemovedAnnouncement,
		formatPermissionRetainedAnnouncement,
		formatAccessRestoredAnnouncement,
		compareNames,
	} ) satisfies LocalizationBundle[ 'protectedSites' ];
}

/**
 * Creates the protected-site list copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed protected-site list copy.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedSiteListCopy(
	catalog: LocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'protectedSiteList' ] {
	/**
	 * Compares two protected-site names using the selected language.
	 * @param firstName - First protected-site name.
	 * @param secondName - Second protected-site name.
	 * @return Locale-sensitive collation result.
	 * @since 0.1.0 Initial implementation.
	 */
	function compareNames( firstName: string, secondName: string ): number {
		return formatters.collator.compare( firstName, secondName );
	}

	return Object.freeze( {
		...catalog.protectedSiteList,
		compareNames,
	} ) satisfies LocalizationBundle[ 'protectedSiteList' ];
}

/**
 * Creates the protected-site item copy adapter.
 * @param catalog - Selected translator catalog.
 * @return Typed protected-site item copy.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectedSiteItemCopy( catalog: LocalizationCatalog ): LocalizationBundle[ 'protectedSiteItem' ] {
	const {
		boundaryWithSubdomains,
		boundaryExact,
		removeQuestion,
		...messages
	} = catalog.protectedSiteItem;

	/**
	 * Formats one protection boundary.
	 * @param host - Canonical protection host.
	 * @param includesSubdomains - Whether descendant hosts are protected.
	 * @return Complete localized boundary explanation.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatBoundary( host: string, includesSubdomains: boolean ): string {
		const template = includesSubdomains
			? boundaryWithSubdomains
			: boundaryExact;

		return formatMessage( template, { host } );
	}

	/**
	 * Formats one removal question.
	 * @param name - Current resolved display name.
	 * @return Complete localized question.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatRemoveQuestion( name: string ): string {
		return formatMessage( removeQuestion, { name } );
	}

	return Object.freeze( {
		...messages,
		formatBoundary,
		formatRemoveQuestion,
	} ) satisfies LocalizationBundle[ 'protectedSiteItem' ];
}

/**
 * Creates the Statistics-screen copy adapter.
 * @param catalog - Selected translator catalog.
 * @param formatters - Locale-sensitive formatters for the bundle.
 * @return Typed Statistics-screen copy.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsCopy(
	catalog: LocalizationCatalog,
	formatters: LocalizationFormatters,
): LocalizationBundle[ 'statistics' ] {
	const {
		lessThanOneMinute,
		estimatedDuration,
		...messages
	} = catalog.statistics;

	/**
	 * Formats one rounded focused-pause duration.
	 * @param milliseconds - Nonnegative duration in milliseconds.
	 * @return Localized duration.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatDuration( milliseconds: number ): string {
		if ( milliseconds > 0 && milliseconds < MILLISECONDS_PER_MINUTE ) {
			return lessThanOneMinute;
		}

		return formatMinuteDuration(
			Math.round( milliseconds / MILLISECONDS_PER_MINUTE ),
			catalog.units,
			formatters,
		);
	}

	/**
	 * Formats one approximate reclaimed-time duration.
	 * @param milliseconds - Nonnegative estimated duration in milliseconds.
	 * @return Localized approximate duration.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatEstimatedDuration( milliseconds: number ): string {
		const duration = formatDuration( milliseconds );

		return milliseconds > 0 && milliseconds < MILLISECONDS_PER_MINUTE
			? duration
			: formatMessage( estimatedDuration, { duration } );
	}

	/**
	 * Formats one metric count.
	 * @param count - Nonnegative metric count.
	 * @return Locale-sensitive decimal count.
	 * @since 0.1.0 Initial implementation.
	 */
	function formatCount( count: number ): string {
		return formatters.number.format( count );
	}

	return Object.freeze( {
		...messages,
		formatEstimatedDuration,
		formatDuration,
		formatCount,
	} ) satisfies LocalizationBundle[ 'statistics' ];
}
