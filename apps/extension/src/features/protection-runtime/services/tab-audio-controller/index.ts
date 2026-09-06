import { type TabAudioController, type TabAudioControllerOptions, type TabAudioMutedInfo } from './types';

/**
 * Session key containing identifiers of tabs muted from an initially unmuted state.
 * @since 0.1.0 Initial implementation.
 */
export const TAB_AUDIO_STORAGE_KEY = 'tocus.protection.tab-audio-receipts';

/**
 * Creates browser-native tab audio ownership control.
 * Browsers without native ownership metadata use session receipts and observed unmute events; another actor reasserting an already-muted state cannot be distinguished.
 * @param options - Extension identity and browser tab operations.
 * @return Serialized audio operations.
 * @since 0.1.0 Initial implementation.
 */
export function createTabAudioController( options: TabAudioControllerOptions ): TabAudioController {
	let pending = Promise.resolve();

	/**
	 * Serializes browser effects and contains recoverable browser or session failures.
	 * @param operation - Audio operation to perform in call order.
	 * @param requireSuccess - Whether the caller must observe failures after the queue recovers.
	 * @return Promise resolved after the operation settles.
	 * @since 0.1.0 Initial implementation.
	 */
	function enqueue( operation: () => Promise<void>, requireSuccess = false ): Promise<void> {
		const result = pending.then( operation );
		pending = result.catch( () => undefined );
		return requireSuccess ? result : pending;
	}

	/**
	 * Reads valid tab identifiers from session storage.
	 * @return Persisted mute receipts.
	 * @since 0.1.0 Initial implementation.
	 */
	async function readReceipts(): Promise<Set<number>> {
		const values = await options.storage.get( TAB_AUDIO_STORAGE_KEY );
		const stored = values[ TAB_AUDIO_STORAGE_KEY ];
		return new Set( Array.isArray( stored )
			? stored.filter( ( value: unknown ): value is number => typeof value === 'number' && Number.isInteger( value ) && value >= 0 )
			: [] );
	}

	/**
	 * Persists only the identifiers of owned mute receipts.
	 * @param receipts - Current mute receipt identifiers.
	 * @return Session persistence completion.
	 * @since 0.1.0 Initial implementation.
	 */
	async function writeReceipts( receipts: ReadonlySet<number> ): Promise<void> {
		await options.storage.set( { [ TAB_AUDIO_STORAGE_KEY ]: [ ...receipts ] } );
	}

	/**
	 * Checks native ownership when metadata exists, otherwise consults the session receipt.
	 * @param tabId - Browser tab identifier.
	 * @param mutedInfo - Current browser mute metadata.
	 * @param receipts - Persisted mute receipt identifiers.
	 * @return Whether this extension owns the mute.
	 * @since 0.1.0 Initial implementation.
	 */
	function ownsMute( tabId: number, mutedInfo: TabAudioMutedInfo, receipts: ReadonlySet<number> ): boolean {
		return mutedInfo.reason !== undefined || mutedInfo.extensionId !== undefined
			? mutedInfo.reason === 'extension' && mutedInfo.extensionId === options.runtimeId
			: receipts.has( tabId );
	}

	/**
	 * Restores current mute ownership and releases a completed receipt.
	 * @param tabId - Browser tab whose interruption ended.
	 * @param receipts - Mutable receipt set awaiting persistence after restoration.
	 * @return Restoration completion.
	 * @since 0.1.0 Initial implementation.
	 */
	async function restoreTab( tabId: number, receipts: Set<number> ): Promise<void> {
		const tab = await options.tabs.get( tabId );
		if ( tab.incognito !== false || tab.mutedInfo === undefined ) {
			return;
		}
		if ( tab.mutedInfo.muted && ownsMute( tabId, tab.mutedInfo, receipts ) ) {
			await options.tabs.update( tabId, { muted: false } );
		}
		receipts.delete( tabId );
	}

	/**
	 * Records an initially unmuted tab before changing its native audio state.
	 * @param tabId - Browser tab displaying an interruption.
	 * @return Promise resolved after the mute attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	function mute( tabId: number ): Promise<void> {
		return enqueue( async () => {
			const tab = await options.tabs.get( tabId );
			if ( tab.incognito !== false || tab.mutedInfo?.muted !== false ) {
				return;
			}
			const receipts = await readReceipts();
			receipts.add( tabId );
			await writeReceipts( receipts );
			try {
				const currentTab = await options.tabs.get( tabId );
				if ( currentTab.incognito === false && currentTab.mutedInfo?.muted === false ) {
					await options.tabs.update( tabId, { muted: true } );
					return;
				}
			} catch {
				receipts.delete( tabId );
				await writeReceipts( receipts );
				return;
			}
			receipts.delete( tabId );
			await writeReceipts( receipts );
		} );
	}

	/**
	 * Restores a tab in call order with other audio effects.
	 * @param tabId - Browser tab whose interruption ended.
	 * @return Promise resolved after the restoration attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	function restore( tabId: number ): Promise<void> {
		return enqueue( async () => {
			const receipts = await readReceipts();
			const previousSize = receipts.size;
			await restoreTab( tabId, receipts );
			if ( receipts.size !== previousSize ) {
				await writeReceipts( receipts );
			}
		} );
	}

	/**
	 * Reconciles owned audio against the currently interrupted tab set.
	 * @param heldTabIds - Browser tabs whose interruptions still require muting.
	 * @param requireSuccess - Whether incomplete cleanup must reject after attempting eligible restorations.
	 * @return Promise resolved after every eligible tab restoration attempt.
	 * @since 0.1.0 Initial implementation.
	 */
	function restoreExcept( heldTabIds: ReadonlySet<number>, requireSuccess = false ): Promise<void> {
		const held = new Set( heldTabIds );
		return enqueue( async () => {
			const tabs = await options.tabs.query( {} );
			const receipts = await readReceipts();
			const previousSize = receipts.size;
			const failures: unknown[] = [];
			const liveTabIds = new Set( tabs.map( ( tab ) => tab.id ) );
			for ( const tabId of receipts ) {
				if ( ! liveTabIds.has( tabId ) ) {
					receipts.delete( tabId );
				}
			}
			for ( const tab of tabs ) {
				if ( tab.id !== undefined && ! held.has( tab.id ) && (
					receipts.has( tab.id ) || (
						tab.mutedInfo?.muted === true && ownsMute( tab.id, tab.mutedInfo, receipts )
					)
				) ) {
					try {
						await restoreTab( tab.id, receipts );
					} catch ( error ) {
						failures.push( error );
					}
				}
			}
			if ( receipts.size !== previousSize ) {
				try {
					await writeReceipts( receipts );
				} catch ( error ) {
					failures.push( error );
				}
			}
			if ( failures.length > 0 ) {
				throw new AggregateError( failures, 'Failed to restore interrupted tab audio.' );
			}
		}, requireSuccess );
	}

	/**
	 * Releases receipts when observed audio changes no longer belong to this extension.
	 * @param tabId - Browser tab whose mute state changed.
	 * @param mutedInfo - Latest browser-reported mute metadata.
	 * @return Promise resolved after receipt reconciliation.
	 * @since 0.1.0 Initial implementation.
	 */
	function observeMuteChange( tabId: number, mutedInfo: TabAudioMutedInfo ): Promise<void> {
		return enqueue( async () => {
			const receipts = await readReceipts();
			if ( ( ! mutedInfo.muted || ! ownsMute( tabId, mutedInfo, receipts ) ) && receipts.delete( tabId ) ) {
				await writeReceipts( receipts );
			}
		} );
	}

	return { mute, restore, restoreExcept, observeMuteChange };
}

export * from './types';
