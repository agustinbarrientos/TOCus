import { PreferencesStorageKey } from '../../../preferences/services/preferences-storage';
import { ProtectionConfigurationStorageKey } from '../../../protection/services/protection-configuration-storage';
import { ProtectionStorageKey } from '../../../protection/services/protection-storage';
import { ProtectionMeasurementRevisionSchema } from '../../../protection/types/protection-value';
import { StatisticsStorageKey } from '../../../statistics/services/statistics-storage';
import { StatisticsSessionStorageKey } from '../../../statistics/services/statistics-session-storage';
import { StatisticsGenerationIdSchema } from '../../../statistics/types/statistics-value';
import {
	BackupImportJournalKey, BackupImportJournalSchema, BackupImportReceiptKey, BackupImportReceiptSchema,
	BackupImportRequestSchema, type BackupImportJournal, type BackupImportResult,
} from '../../types/backup-operation';
import { createBackupDocument, createBackupDocuments, parseBackupText } from '../../utils/backup-document';
import { LocalDataGenerationStorageKey, readLocalDataGeneration } from '../local-data-generation';
import type { LocalDataBackup, LocalDataBackupOptions } from './types';

/**
 * Hashes validated contents so durable receipts contain no backup data.
 * @param input - Detached validated backup contents.
 * @return Hex-encoded SHA-256 fingerprint.
 * @since 1.1.0
 */
async function fingerprint( input: unknown ): Promise<string> {
	const digest = await crypto.subtle.digest( 'SHA-256', new TextEncoder().encode( JSON.stringify( input ) ) );
	return Array.from( new Uint8Array( digest ), ( byte ) => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );
}

/**
 * Coordinates portable backups and restart-safe replacement with existing writers.
 * @param options - Storage, lock, and runtime lifecycle boundaries.
 * @return Background-owned local backup operations.
 * @since 1.1.0
 */
export function createLocalDataBackup( options: LocalDataBackupOptions ): LocalDataBackup {
	let suspended = false;

	/**
	 * Uses the same mutation order as reset and existing settings editors.
	 * @param operation - Work owning both mutation locks.
	 * @return Serialized operation result.
	 * @since 1.1.0
	 */
	function locked<Result>( operation: () => Promise<Result> ): Promise<Result> {
		return options.locks.request( ProtectionConfigurationStorageKey.CONFIGURATION,
			() => options.locks.request( PreferencesStorageKey.PREFERENCES, operation ) );
	}

	/**
	 * Reads unknown recovery metadata without repairing it.
	 * @param key - Exact owned storage key.
	 * @return Stored record or undefined.
	 * @since 1.1.0
	 */
	async function read( key: string ): Promise<unknown> {
		return ( await options.localArea.get( key ) )[ key ];
	}

	/**
	 * Resumes only an authority suspended by this instance.
	 * @return Completion without resetting an already running browsing session.
	 * @since 1.1.0
	 */
	async function resume(): Promise<void> {
		if ( suspended ) {
			await options.resume();
			suspended = false;
		}
	}

	/**
	 * Completes one durable intent; the journal stays until every target is stored.
	 * @param journal - Fully validated target documents and request identity.
	 * @return Confirmed replacement after runtime resumption.
	 * @since 1.1.0
	 */
	async function complete( journal: BackupImportJournal ): Promise<BackupImportResult> {
		await options.sessionArea.remove( [ ProtectionStorageKey.SESSION,
			StatisticsSessionStorageKey.SESSION, StatisticsSessionStorageKey.FOCUS_EPOCH ] );
		await options.localArea.remove( [ ProtectionStorageKey.DURABLE ] );
		const receipt = BackupImportReceiptSchema.parse( { requestId: journal.requestId,
			fingerprint: journal.fingerprint, generation: journal.generation } );
		await options.localArea.set( {
			[ ProtectionConfigurationStorageKey.CONFIGURATION ]: journal.documents.configuration,
			[ PreferencesStorageKey.PREFERENCES ]: journal.documents.preferences,
			[ StatisticsStorageKey.STATISTICS ]: journal.documents.statistics,
			[ LocalDataGenerationStorageKey ]: {
				generation: journal.generation, pending: false, needsOnboarding: false,
			},
			[ BackupImportReceiptKey ]: receipt,
		} );
		await options.localArea.remove( [ BackupImportJournalKey ] );
		await resume();
		return { status: 'completed', requestId: journal.requestId, generation: journal.generation };
	}

	/**
	 * Validates a request before entering any lifecycle or persistence boundary.
	 * @param input - Unknown confirmed import request.
	 * @return Safe import result without leaking validation details.
	 * @since 1.1.0
	 */
	async function importBackup( input: unknown ): Promise<BackupImportResult> {
		const parsed = BackupImportRequestSchema.safeParse( input );
		if ( ! parsed.success ) {
			return { status: 'invalid' };
		}
		const request = parsed.data;
		let hash: string;
		try {
			parseBackupText( JSON.stringify( request.backup ) );
			hash = await fingerprint( request.backup );
		} catch {
			return { status: 'invalid' };
		}
		return locked( async (): Promise<BackupImportResult> => {
			try {
				const current = await readLocalDataGeneration( options.localArea );
				if ( current?.pending ) {
					return { status: 'busy' };
				}
				const pending = await read( BackupImportJournalKey );
				if ( pending !== undefined ) {
					const journal = BackupImportJournalSchema.parse( pending );
					if ( journal.requestId !== request.requestId || journal.fingerprint !== hash ) {
						return { status: 'busy' };
					}
					suspended = true;
					await options.suspend();
					return await complete( journal );
				}
				const saved = await read( BackupImportReceiptKey );
				const receipt = saved === undefined ? null : BackupImportReceiptSchema.parse( saved );
				if ( receipt?.requestId === request.requestId ) {
					if ( receipt.fingerprint !== hash || receipt.generation !== current?.generation ) {
						return { status: 'stale' };
					}
					await resume();
					return { status: 'completed', requestId: receipt.requestId, generation: receipt.generation };
				}
				if ( ( current?.generation ?? null ) !== request.expectedGeneration ) {
					return { status: 'stale' };
				}
				suspended = true;
				await options.suspend();
				const generation = options.createId();
				const documents = createBackupDocuments( request.backup, {
					dataGeneration: generation,
					statisticsGeneration: StatisticsGenerationIdSchema.parse( options.createId() ),
					measurementRevision: ProtectionMeasurementRevisionSchema.parse( options.createId() ),
				} );
				const journal = BackupImportJournalSchema.parse( {
					requestId: request.requestId, fingerprint: hash, generation, documents,
				} );
				await options.localArea.set( { [ BackupImportJournalKey ]: journal } );
				return await complete( journal );
			} catch {
				try {
					if ( await read( BackupImportJournalKey ) !== undefined ) {
						return { status: 'recovery-pending' };
					}
					await resume();
					return { status: 'failed' };
				} catch {
					return { status: 'recovery-pending' };
				}
			}
		} );
	}

	return {
		import: importBackup,
		/**
		 * Reads a coherent portable snapshot without altering browsing state.
		 * @return Portable snapshot or safe failure status.
		 */
		async export() {
			return locked( async () => {
				try {
					const marker = await readLocalDataGeneration( options.localArea );
					if ( marker?.pending || await read( BackupImportJournalKey ) !== undefined || suspended ) {
						return { status: 'busy' } as const;
					}
					const source = await options.snapshot();
					const backup = parseBackupText( JSON.stringify( createBackupDocument( source ) ) );
					return { status: 'available', backup, generation: marker?.generation ?? null } as const;
				} catch {
					return { status: 'unavailable' } as const;
				}
			} );
		},
		/**
		 * Completes durable replacement before ordinary startup.
		 * @return Whether runtime startup is safe.
		 */
		async recover() {
			return locked( async () => {
				try {
					const marker = await readLocalDataGeneration( options.localArea );
					if ( marker?.pending ) {
						await options.localArea.remove( [ BackupImportJournalKey, BackupImportReceiptKey ] );
						return false;
					}
					const pending = await read( BackupImportJournalKey );
					if ( pending === undefined ) {
						await resume();
						return true;
					}
					const journal = BackupImportJournalSchema.parse( pending );
					suspended = true;
					await options.suspend();
					await complete( journal );
					return true;
				} catch {
					return false;
				}
			} );
		},
	};
}

export * from './types';
