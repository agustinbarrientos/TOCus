/**
 * Browser-reported mute state and the owner of its latest change.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioMutedInfo {
	/**
	 * Whether the tab is muted.
	 * @since 0.1.0 Initial implementation.
	 */
	muted: boolean;
	/**
	 * Cause of the latest mute change, when supported.
	 * @since 0.1.0 Initial implementation.
	 */
	reason?: string | undefined;
	/**
	 * Extension that last changed the mute state, when supported.
	 * @since 0.1.0 Initial implementation.
	 */
	extensionId?: string | undefined;
}

/**
 * Browser tab details required for audio ownership.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioTab {
	/**
	 * Browser-assigned live tab identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	id?: number | undefined;
	/**
	 * Whether the tab belongs to a private browser context.
	 * @since 0.1.0 Initial implementation.
	 */
	incognito?: boolean | undefined;
	/**
	 * Current audio state, when exposed by the browser.
	 * @since 0.1.0 Initial implementation.
	 */
	mutedInfo?: TabAudioMutedInfo | undefined;
}

/**
 * Browser-native audio update.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioUpdate {
	/**
	 * Whether to prevent the tab from playing sound.
	 * @since 0.1.0 Initial implementation.
	 */
	muted: boolean;
}

/**
 * Narrow browser operations required for tab audio control.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioTabsApi {
	/**
	 * Reads one live browser tab.
	 * @param tabId - Browser-assigned tab identifier.
	 * @return Current tab details.
	 * @since 0.1.0 Initial implementation.
	 */
	get: ( tabId: number ) => Promise<TabAudioTab>;
	/**
	 * Lists accessible browser tabs.
	 * @param query - Empty filter selecting all accessible tabs.
	 * @return Current browser tabs.
	 * @since 0.1.0 Initial implementation.
	 */
	query: ( query: Record<string, never> ) => Promise<ReadonlyArray<TabAudioTab>>;
	/**
	 * Changes one tab's native audio state.
	 * @param tabId - Browser-assigned tab identifier.
	 * @param update - Requested mute state.
	 * @return Browser completion result.
	 * @since 0.1.0 Initial implementation.
	 */
	update: ( tabId: number, update: TabAudioUpdate ) => Promise<unknown>;
}

/**
 * Browser identity and operations required for audio ownership.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioControllerOptions {
	/**
	 * Current extension identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	runtimeId: string;
	/**
	 * Browser-native tab operations.
	 * @since 0.1.0 Initial implementation.
	 */
	tabs: TabAudioTabsApi;
	/**
	 * Session storage containing only mute receipt tab identifiers.
	 * @since 0.1.0 Initial implementation.
	 */
	storage: TabAudioStorageApi;
}

/**
 * Session storage operations for mute receipts.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioStorageApi {
	/**
	 * Reads one session value.
	 * @param key - Mute receipt storage key.
	 * @return Stored session values.
	 * @since 0.1.0 Initial implementation.
	 */
	get: ( key: string ) => Promise<Record<string, unknown>>;
	/**
	 * Replaces the mute receipt session value.
	 * @param values - Session values to write.
	 * @return Promise resolved after persistence.
	 * @since 0.1.0 Initial implementation.
	 */
	set: ( values: Record<string, unknown> ) => Promise<void>;
}

/**
 * Serialized tab audio control with best-effort ordinary operations and reportable cleanup failures.
 * @since 0.1.0 Initial implementation.
 */
export interface TabAudioController {
	/**
	 * Releases a mute receipt after an observed unmute or another native mute owner.
	 * @param tabId - Browser tab whose mute state changed.
	 * @param mutedInfo - Latest browser-reported mute state.
	 * @return Promise resolved after receipt reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	observeMuteChange: ( tabId: number, mutedInfo: TabAudioMutedInfo ) => Promise<void>;
	/**
	 * Mutes an unmuted non-private tab with observable audio state.
	 * @param tabId - Browser tab displaying an interruption.
	 * @return Promise resolved after the mute attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	mute: ( tabId: number ) => Promise<void>;
	/**
	 * Unmutes a non-private tab owned by native metadata or a session receipt when metadata is unavailable.
	 * @param tabId - Browser tab whose interruption has ended.
	 * @return Promise resolved after the restoration attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	restore: ( tabId: number ) => Promise<void>;
	/**
	 * Restores extension-owned mutes outside the retained interruption tabs.
	 * @param heldTabIds - Browser tabs whose interruptions still require muting.
	 * @param requireSuccess - Whether incomplete cleanup must reject after attempting eligible restorations.
	 * @return Promise resolved after all eligible restoration attempts.
	 * @throws {Error} Browser or session failure when required cleanup cannot complete.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreExcept: ( heldTabIds: ReadonlySet<number>, requireSuccess?: boolean ) => Promise<void>;
}
