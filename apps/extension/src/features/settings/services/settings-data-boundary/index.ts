import { LocalDataResetError, readLocalDataGeneration } from '../../../../domains/local-data/services/local-data-generation';
import { BackupImportJournalKey } from '../../../../domains/local-data/types/backup-storage-key';
import { PreferencesStorageKey } from '../../../../domains/preferences/services/preferences-storage';
import { StatisticsStorageKey } from '../../../../domains/statistics/services/statistics-storage';
import type { PreferencesStorageChangeListener, PreferencesStorageChanges } from '../../../preferences/services/preferences-controller';
import type { SettingsDataBoundary, SettingsDataBoundaryOptions } from './types';

/**
 * Withholds partial replacement reads and rereads notifications after durable recovery.
 * @param options - Raw browser storage and editor lifecycle callback.
 * @return Coherent settings-only storage and notification boundaries.
 * @since 1.1.0
 */
export function createSettingsDataBoundary( options: SettingsDataBoundaryOptions ): SettingsDataBoundary {
	const listeners = new Set<PreferencesStorageChangeListener>();
	let generation: string | null | undefined;
	let revision = 0;

	/**
	 * Rejects a pending reset or import without returning any partially replaced values.
	 * @return Current complete data identity.
	 * @since 1.1.0
	 */
	async function ready(): Promise<string | null> {
		const marker = await readLocalDataGeneration( options.area );
		const journal = await options.area.get( BackupImportJournalKey );
		if ( marker?.pending || journal[ BackupImportJournalKey ] !== undefined ) {
			throw new LocalDataResetError();
		}
		return marker?.generation ?? null;
	}

	/**
	 * Publishes current stored values rather than delayed browser event payloads.
	 * @param changes - Keys affected by the browser event.
	 * @return Completion of the latest coherent notification.
	 * @since 1.1.0
	 */
	async function publish( changes: PreferencesStorageChanges ): Promise<void> {
		const requested = ++revision;
		try {
			const current = await ready();
			const next = { ...changes };
			for ( const key of generation !== current
				? [ PreferencesStorageKey.PREFERENCES, StatisticsStorageKey.STATISTICS ] : [] ) {
				next[ key ] = { newValue: ( await options.area.get( key ) )[ key ] };
			}
			if ( requested !== revision || current !== await ready() ) {
				return;
			}
			if ( generation !== undefined && generation !== current ) {
				await options.onReplaced();
			}
			generation = current;
			if ( requested !== revision ) {
				return;
			}
			for ( const listener of listeners ) {
				listener( next, 'local' );
			}
		} catch {
			// Pending or unavailable data remains hidden until a subsequent recovery notification.
		}
	}

	/**
	 * Contains asynchronous storage failures while ignoring unrelated browser areas.
	 * @param changes - Storage keys changed by the browser.
	 * @param areaName - Browser storage area name.
	 * @since 1.1.0
	 */
	function changed( changes: PreferencesStorageChanges, areaName: string ): void {
		if ( areaName === 'local' ) {
			void publish( changes );
		}
	}
	return {
		area: {
			/**
			 * Rejects a read spanning two generations or a pending journal.
			 * @param key - Requested storage key.
			 * @return Values from a single complete generation.
			 * @since 1.1.0
			 */
			async get( key ) {
				const before = await ready();
				const values = await options.area.get( key );
				if ( before !== await ready() ) {
					throw new LocalDataResetError();
				}
				if ( generation === undefined ) {
					generation = before;
				}
				return values;
			},
			/**
			 * Leaves persistence guarded by the owning generation-scoped editor and lock.
			 * @param values - Complete validated record set.
			 * @return Completion of the browser write.
			 * @since 1.1.0
			 */
			set( values ) {
				return options.area.set( values );
			},
		},
		changes: {
			/**
			 * Shares one browser subscription across active settings consumers.
			 * @param listener - Coherent local-data observer.
			 * @since 1.1.0
			 */
			addListener( listener ) {
				if ( listeners.size === 0 ) {
					options.changes.addListener( changed );
				}
				listeners.add( listener );
			},
			/**
			 * Releases the browser subscription after the last settings consumer leaves.
			 * @param listener - Observer to remove.
			 * @since 1.1.0
			 */
			removeListener( listener ) {
				listeners.delete( listener );
				if ( listeners.size === 0 ) {
					options.changes.removeListener( changed );
				}
			},
		},
	};
}

export * from './types';
