/**
 * Complete cardinal-plural message variants supported by ECMA-402 plural rules.
 * @since 0.1.0 Initial implementation.
 */
export interface PluralMessageCatalog {
	zero: string;
	one: string;
	two: string;
	few: string;
	many: string;
	other: string;
}

/**
 * Localized label and supporting text for one selectable option.
 * @since 0.1.0 Initial implementation.
 */
export interface OptionMessageCatalog {
	label: string;
	description: string;
}

/**
 * Localized browser-document metadata.
 * @since 0.1.0 Initial implementation.
 */
export interface DocumentMessageCatalog {
	interruptionTitle: string;
	popupTitle: string;
	settingsTitle: string;
}

/**
 * Localized browser-managed extension metadata and message descriptions.
 * @since 0.1.0 Initial implementation.
 */
export interface ExtensionMessageCatalog {
	name: string;
	nameDescription: string;
	description: string;
	descriptionDescription: string;
}

/**
 * One browser-managed message in Chrome's localization-file format.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserLocaleMessage {
	message: string;
	description: string;
}

/**
 * Browser-managed extension metadata messages for one locale.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserLocaleMessages {
	extensionName: BrowserLocaleMessage;
	extensionDescription: BrowserLocaleMessage;
}

/**
 * Localized popup-shell messages.
 * @since 0.1.0 Initial implementation.
 */
export interface PopupMessageCatalog {
	status: string;
	summary: string;
	foundationNote: string;
}

/**
 * Localized settings-shell navigation messages.
 * @since 0.1.0 Initial implementation.
 */
export interface SettingsShellMessageCatalog {
	navigationLabel: string;
	appearance: string;
	protectedSites: string;
	schedule: string;
	timing: string;
	language: string;
	statistics: string;
}

/**
 * Localized language-settings messages and templates.
 * @since 0.1.0 Initial implementation.
 */
export interface LanguageScreenMessageCatalog {
	eyebrow: string;
	title: string;
	introduction: string;
	formLabel: string;
	languageLabel: string;
	browserLanguageOption: string;
	browserLanguageDescription: string;
	explicitLanguageDescription: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	restoreDefaults: string;
	restoreDefaultsError: string;
	saveError: string;
	savedAnnouncement: string;
	restoredAnnouncement: string;
}

/**
 * Localized appearance option groups.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceOptionsMessageCatalog {
	system: OptionMessageCatalog;
	light: OptionMessageCatalog;
	dark: OptionMessageCatalog;
	breathing: OptionMessageCatalog;
	quiet: OptionMessageCatalog;
}

/**
 * Localized appearance palette labels.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearancePaletteMessageCatalog {
	brown: string;
	green: string;
	blue: string;
	purple: string;
	pink: string;
	orange: string;
}

/**
 * Localized Appearance-screen messages.
 * @since 0.1.0 Initial implementation.
 */
export interface AppearanceMessageCatalog {
	eyebrow: string;
	title: string;
	introduction: string;
	formLabel: string;
	themeLegend: string;
	options: AppearanceOptionsMessageCatalog;
	paletteLegend: string;
	paletteHelp: string;
	palettes: AppearancePaletteMessageCatalog;
	pauseModeLegend: string;
	accessibilityLegend: string;
	reducedMotionLabel: string;
	reducedMotionDescription: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	restoreDefaults: string;
	restoreDefaultsError: string;
	retry: string;
	saveError: string;
	savedAnnouncement: string;
	restoredAnnouncement: string;
}

/**
 * Localized weekday names keyed by stable domain values.
 * @since 0.1.0 Initial implementation.
 */
export interface WeekdayMessageCatalog {
	Monday: string;
	Tuesday: string;
	Wednesday: string;
	Thursday: string;
	Friday: string;
	Saturday: string;
	Sunday: string;
}

/**
 * Localized Schedule-screen messages and templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ScheduleMessageCatalog {
	eyebrow: string;
	title: string;
	introduction: string;
	appliesToLabel: string;
	sharedScope: string;
	independentScopeLabel: string;
	weekdays: WeekdayMessageCatalog;
	windowLabel: string;
	removeWindowLabel: string;
	scheduleLegend: string;
	alwaysLabel: string;
	alwaysDescription: string;
	customLabel: string;
	customDescription: string;
	windowsLegend: string;
	windowsHelp: string;
	weekdayLabel: string;
	startTimeLabel: string;
	endTimeLabel: string;
	removeWindow: string;
	addWindow: string;
	startTimeRequiredError: string;
	endTimeRequiredError: string;
	equalTimeError: string;
	dirtyScopeNotice: string;
	discard: string;
	save: string;
	saving: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	saveError: string;
	invalidConfigurationError: string;
	invalidScheduleError: string;
	scopeNotFoundError: string;
	savedAnnouncement: string;
}

/**
 * Localized Timing-screen messages and full summary templates.
 * @since 0.1.0 Initial implementation.
 */
export interface TimingMessageCatalog {
	eyebrow: string;
	title: string;
	introduction: string;
	formLabel: string;
	initialWaitLabel: string;
	initialWaitHelp: string;
	waitIncreaseLabel: string;
	waitIncreaseHelp: string;
	maximumWaitLabel: string;
	maximumWaitHelp: string;
	maximumWaitError: string;
	allowanceLabel: string;
	allowanceHelp: string;
	completionActionLegend: string;
	showContinueLabel: string;
	showContinueDescription: string;
	openAutomaticallyLabel: string;
	openAutomaticallyDescription: string;
	summaryTitle: string;
	loading: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	saveTiming: string;
	savingTiming: string;
	saveError: string;
	invalidConfigurationError: string;
	invalidTimingConfigurationError: string;
	savedAnnouncement: string;
	summaryShowContinue: string;
	summaryOpenAutomatically: string;
}

/**
 * Localized grouped protected-site list messages.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteListMessageCatalog {
	emptyTitle: string;
	emptyDescription: string;
	sharedGroupTitle: string;
	sharedGroupDescription: string;
	independentGroupTitle: string;
	independentGroupDescription: string;
}

/**
 * Localized Protected-sites screen messages and announcement templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSitesMessageCatalog {
	eyebrow: string;
	title: string;
	introduction: string;
	addressLabel: string;
	addressPlaceholder: string;
	addSite: string;
	addingSite: string;
	addressHelp: string;
	behaviorLegend: string;
	sharedBehavior: string;
	sharedBehaviorDescription: string;
	independentBehavior: string;
	independentBehaviorDescription: string;
	loading: string;
	invalidSiteError: string;
	alreadyProtectedError: string;
	invalidConfigurationError: string;
	invalidScopeError: string;
	invalidDisplayNameError: string;
	siteNotFoundError: string;
	saveError: string;
	permissionDeniedError: string;
	permissionRequestError: string;
	permissionRetainedError: string;
	malformedDataTitle: string;
	malformedDataDescription: string;
	loadErrorTitle: string;
	loadErrorDescription: string;
	retry: string;
	addedAnnouncement: string;
	updatedAnnouncement: string;
	removedAnnouncement: string;
	permissionRetainedAnnouncement: string;
	accessRestoredAnnouncement: string;
}

/**
 * Localized protected-site item messages and templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedSiteItemMessageCatalog {
	accessRequired: string;
	allowAccess: string;
	allowingAccess: string;
	accessRequestError: string;
	edit: string;
	displayNameLabel: string;
	useAutomaticName: string;
	behaviorLegend: string;
	sharedBehavior: string;
	sharedBehaviorDescription: string;
	independentBehavior: string;
	independentBehaviorDescription: string;
	saveChanges: string;
	saving: string;
	cancel: string;
	removeSite: string;
	keepSite: string;
	confirmRemove: string;
	operationError: string;
	configurationChangedError: string;
	sharedLabel: string;
	independentLabel: string;
	boundaryWithSubdomains: string;
	boundaryExact: string;
	removeQuestion: string;
}

/**
 * Localized Statistics-screen messages and duration templates.
 * @since 0.1.0 Initial implementation.
 */
export interface StatisticsMessageCatalog {
	eyebrow: string;
	title: string;
	introduction: string;
	allTimeTitle: string;
	estimatedReclaimedLabel: string;
	focusedPauseLabel: string;
	reconsideredVisitsLabel: string;
	completedWaitsLabel: string;
	allowancesGrantedLabel: string;
	estimationDescription: string;
	notEnoughHistory: string;
	emptyMessage: string;
	loading: string;
	unavailableTitle: string;
	unavailableDescription: string;
	retry: string;
	localDataTitle: string;
	localDataDescription: string;
	resetAction: string;
	resetConfirmationTitle: string;
	resetConfirmationDescription: string;
	cancelReset: string;
	confirmReset: string;
	resetting: string;
	resetSuccess: string;
	resetErrorTitle: string;
	resetErrorDescription: string;
	lessThanOneMinute: string;
	estimatedDuration: string;
}

/**
 * Localized interruption-screen messages and countdown template.
 * @since 0.1.0 Initial implementation.
 */
export interface InterruptionMessageCatalog {
	breatheIn: string;
	breatheOut: string;
	continueLabel: string;
	continueShortcut: string;
	remainingTime: PluralMessageCatalog;
	pausedAnnouncement: string;
	readyAnnouncement: string;
	readyExpiredMessage: string;
	recoveryFailedAnnouncement: string;
	recoveryStartedAnnouncement: string;
	retryLabel: string;
	retryingLabel: string;
	resumedAnnouncement: string;
	spaceKeyLabel: string;
	sphereAlternative: string;
	stillSphereAlternative: string;
	takeAMoment: string;
	unavailableMessage: string;
	unavailableTitle: string;
	waitingStartedAnnouncement: string;
}

/**
 * Localized protected-page layer messages and plural warning templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectedPageLayerMessageCatalog {
	allowanceWarningAnnouncement: string;
	dialogLabel: string;
	allowanceWarning: PluralMessageCatalog;
}

/**
 * Localized interruption-footer messages and complete availability templates.
 * @since 0.1.0 Initial implementation.
 */
export interface WellbeingMessageCatalog {
	neutral: string;
	focusedOnly: string;
	estimatedOnly: string;
	both: string;
}

/**
 * Localized toolbar waiting-state templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarWaitingMessageCatalog {
	secondText: string;
	minuteText: string;
	completeTitle: string;
	secondTitle: PluralMessageCatalog;
	minuteTitle: PluralMessageCatalog;
}

/**
 * Localized toolbar allowance-state templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarAllowanceMessageCatalog {
	lessThanMinuteText: string;
	minuteText: string;
	completeText: string;
	lessThanMinuteTitle: string;
	completeTitle: string;
	minuteTitle: PluralMessageCatalog;
}

/**
 * Localized toolbar badge messages and templates.
 * @since 0.1.0 Initial implementation.
 */
export interface ToolbarMessageCatalog {
	inactiveTitle: string;
	activeTitle: string;
	waiting: ToolbarWaitingMessageCatalog;
	allowance: ToolbarAllowanceMessageCatalog;
	multipleIndicator: string;
	overflowIndicator: string;
	multipleText: string;
	multipleTitle: PluralMessageCatalog;
}

/**
 * Shared localized duration-unit forms.
 * @since 0.1.0 Initial implementation.
 */
export interface DurationUnitMessageCatalog {
	second: PluralMessageCatalog;
	minute: PluralMessageCatalog;
	hour: PluralMessageCatalog;
}

/**
 * Complete translator-authored message catalog for one supported language.
 * @since 0.1.0 Initial implementation.
 */
export interface LocalizationCatalog {
	extension: ExtensionMessageCatalog;
	document: DocumentMessageCatalog;
	popup: PopupMessageCatalog;
	settingsShell: SettingsShellMessageCatalog;
	languageScreen: LanguageScreenMessageCatalog;
	appearance: AppearanceMessageCatalog;
	schedule: ScheduleMessageCatalog;
	timing: TimingMessageCatalog;
	protectedSiteList: ProtectedSiteListMessageCatalog;
	protectedSites: ProtectedSitesMessageCatalog;
	protectedSiteItem: ProtectedSiteItemMessageCatalog;
	statistics: StatisticsMessageCatalog;
	interruption: InterruptionMessageCatalog;
	protectedPageLayer: ProtectedPageLayerMessageCatalog;
	wellbeing: WellbeingMessageCatalog;
	toolbar: ToolbarMessageCatalog;
	units: DurationUnitMessageCatalog;
}
