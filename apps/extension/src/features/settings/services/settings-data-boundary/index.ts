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
	let publishing = false;
	let queued = false;
	let dirty: PreferencesStorageChanges = {};
	let blocked = false;

	/**
	 * Rejects a pending reset or import without exposing partial values.
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
	 * Retains every affected key while earlier reads or editor refreshes are pending.
	 * @return Completion of coherent publications currently queued by browser events.
	 * @since 1.1.0
	 */
	async function publish(): Promise<void> {
		publishing = true;
		try {
			while ( queued ) {
				queued = false;
				const changes = dirty;
				dirty = {};
				const requested = revision;
				try {
					const current = await ready();
					const replacement = blocked || generation !== current;
					const next = { ...changes };
					for ( const key of [ PreferencesStorageKey.PREFERENCES, StatisticsStorageKey.STATISTICS ] ) {
						if ( replacement || Object.hasOwn( changes, key ) ) {
							next[ key ] = { newValue: ( await options.area.get( key ) )[ key ] };
						}
					}
					if ( requested !== revision || current !== await ready() ) {
						dirty = { ...changes, ...dirty }; queued = true; continue;
					}
					if ( replacement ) {
						await options.onReplaced();
					}
					if ( requested !== revision || current !== await ready() ) {
						dirty = { ...changes, ...dirty }; queued = true; continue;
					}
					for ( const listener of listeners ) {
						listener( next, 'local' );
					}
					generation = current;
					blocked = false;
				} catch {
					blocked = true;
					dirty = { ...changes, ...dirty };
					if ( requested === revision ) {
						break;
					}
					queued = true;
				}
			}
		} finally {
			publishing = false;
		}
	}

	/**
	 * Coalesces storage events without dropping distinct changed keys.
	 * @param changes - Storage keys changed by the browser.
	 * @param areaName - Browser storage area name.
	 * @since 1.1.0
	 */
	function changed( changes: PreferencesStorageChanges, areaName: string ): void {
		if ( areaName === 'local' ) {
			dirty = { ...dirty, ...changes };
			revision++;
			queued = true;
			if ( ! publishing ) {
				void publish();
			}
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
				let before: string | null;
				try {
					before = await ready();
				} catch ( error ) {
					blocked = true; throw error;
				}
				const values = await options.area.get( key );
				if ( before !== await ready() ) {
					throw new LocalDataResetError();
				}
				if ( generation === undefined && ! blocked && ! publishing ) {
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
