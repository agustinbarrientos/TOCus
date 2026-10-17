import { createLocalDataBackup } from '..';
import { createBackupDocument } from '../../../utils/backup-document';
import { createBackupSource } from '../../../utils/backup-document/__fixtures__';
import { ProtectionConfigurationStorageKey } from '../../../../protection/services/protection-configuration-storage';
import { PreferencesStorageKey } from '../../../../preferences/services/preferences-storage';
import { StatisticsStorageKey } from '../../../../statistics/services/statistics-storage';
import { BackupImportJournalKey } from '../../../types/backup-operation';
import type { LocalDataResetArea, LocalDataResetLocks } from '../../local-data-reset/types';
import type { LocalDataBackupOptions } from '../types';

/**
 * Creates real map-backed storage and lifecycle barriers with injectable failures.
 * @return Deterministic persistence and restart controls.
 * @since 1.1.0
 */
export function createBackupFixture() {
	const source = createBackupSource();
	const values: Record<string, unknown> = {
		[ ProtectionConfigurationStorageKey.CONFIGURATION ]: source.configuration,
		[ PreferencesStorageKey.PREFERENCES ]: source.preferences,
		[ StatisticsStorageKey.STATISTICS ]: source.statistics,
		unrelated: 'preserved',
	};
	let failure = '';
	let suspended = false;
	let sequence = 0;
	let writes = 0;
	const queues = new Map<string, Promise<unknown>>();

	/**
	 * Reads detached records by exact storage key.
	 * @param key - Requested key.
	 * @return Detached storage result.
	 */
	function get( key: string ): Promise<Record<string, unknown>> {
		return Promise.resolve( structuredClone( { [ key ]: values[ key ] } ) );
	}

	/**
	 * Applies writes or simulates rejection before or after application.
	 * @param update - Records to write.
	 * @return Simulated browser storage completion.
	 */
	function set( update: Record<string, unknown> ): Promise<void> {
		writes += 1;
		const phase = Object.hasOwn( update, BackupImportJournalKey ) ? 'journal' : 'target';
		if ( failure === phase ) {
			return Promise.reject( new Error( 'Injected storage rejection.' ) );
		}
		Object.assign( values, structuredClone( update ) );
		return failure === `${ phase }-response`
			? Promise.reject( new Error( 'Applied write with lost response.' ) ) : Promise.resolve();
	}

	/**
	 * Removes exact owned keys without modifying unrelated records.
	 * @param keys - Records to remove.
	 * @return Simulated browser storage completion.
	 */
	function remove( keys: string[] ): Promise<void> {
		if ( failure === 'remove' ) {
			return Promise.reject( new Error( 'Injected removal rejection.' ) );
		}
		for ( const key of keys ) {
			Reflect.deleteProperty( values, key );
		}
		return Promise.resolve();
	}

	/**
	 * Serializes real operations by the requested lock name.
	 * @template Result Result of the protected operation.
	 * @param name - Lock name.
	 * @param operation - Protected operation.
	 * @return Protected operation result.
	 */
	function requestLock<Result>( name: string, operation: () => Promise<Result> ): Promise<Result> {
		const result = ( queues.get( name ) ?? Promise.resolve() ).then( operation );
		queues.set( name, result.catch( () => undefined ) );
		return result;
	}

	/**
	 * Creates deterministic valid identifiers for assertions.
	 * @return Next identifier.
	 */
	function createId(): string {
		sequence += 1;
		return `id_${ String( sequence ) }`;
	}

	/**
	 * Returns the configured source snapshot.
	 * @return Source documents.
	 */
	function snapshot() {
		return Promise.resolve( source );
	}

	/**
	 * Stops fixture runtime ingress.
	 * @return Suspension completion or an injected rejection.
	 */
	function suspend(): Promise<void> {
		suspended = true;
		return failure === 'suspend' ? Promise.reject( new Error( 'Suspension failed.' ) ) : Promise.resolve();
	}

	/**
	 * Restores fixture runtime ingress.
	 * @return Resumption completion or an injected rejection.
	 */
	function resume(): Promise<void> {
		if ( failure === 'resume' ) {
			return Promise.reject( new Error( 'Resume failed.' ) );
		}
		suspended = false;
		return Promise.resolve();
	}

	/**
	 * Completes session-only cleanup without altering local records.
	 * @return Successful cleanup.
	 */
	function removeSession(): Promise<void> {
		return Promise.resolve();
	}
	const area: LocalDataResetArea = { get, set, remove };
	const locks: LocalDataResetLocks = { request: requestLock };
	const options: LocalDataBackupOptions = { localArea: area, sessionArea: { remove: removeSession },
		locks, createId, snapshot, suspend, resume };
	const request = { type: 'import-local-backup', requestId: 'request_1', expectedGeneration: null,
		backup: createBackupDocument( source ) };

	/**
	 * Creates a fresh worker authority against the same persistent records.
	 * @return New authority.
	 */
	function restart() {
		return createLocalDataBackup( options );
	}
	/**
	 * Selects the boundary that will reject.
	 * @param value - Failure stage, or empty for success.
	 */
	function setFailure( value: string ): void {
		failure = value;
	}
	/**
	 * Reads whether protection ingress is stopped.
	 * @return Current suspension state.
	 */
	function isSuspended(): boolean {
		return suspended;
	}
	/**
	 * Reads the number of storage-write attempts.
	 * @return Write count.
	 */
	function writeCount(): number {
		return writes;
	}
	return { values, request, area, options, backup: createLocalDataBackup( options ),
		restart, setFailure, isSuspended, writeCount };
}
