import { z } from 'zod';
import {
	BackupControlRequestSchema, BackupImportRequestSchema,
	type BackupExportResult, type BackupImportResult, type BackupStateResult,
} from '../../../../domains/local-data/types/backup-operation';
import { BackupImportJournalKey } from '../../../../domains/local-data/types/backup-storage-key';
import { readLocalDataGeneration } from '../../../../domains/local-data/services/local-data-generation';
import type { ProtectionBackgroundMessageListener } from '../../../protection-runtime/services/protection-background-controller';
import type { LocalDataBackupController, LocalDataBackupControllerOptions } from './types';

/** Recognizes only the three owned request types before deeper validation. */
const RequestTypeSchema = z.looseObject( {
	type: z.enum( [ 'export-local-backup', 'import-local-backup', 'read-local-backup-state' ] ),
} );

/**
 * Registers backup operations exclusively for the top-level settings document.
 * @param options - Browser-authenticated sender and lifecycle dependencies.
 * @return One-shot message registration.
 * @since 1.1.0
 */
export function createLocalDataBackupController(
	options: LocalDataBackupControllerOptions,
): LocalDataBackupController {
	let registered = false;

	/**
	 * Validates before recovery can mutate records, then runs one owned operation.
	 * @param input - Unknown original browser payload.
	 * @param type - Recognized request type.
	 * @return Validated authority response or a contained failure.
	 * @since 1.1.0
	 */
	async function run( input: unknown, type: z.infer<typeof RequestTypeSchema>['type'] ): Promise<BackupExportResult | BackupImportResult | BackupStateResult> {
		const importing = type === 'import-local-backup';
		const valid = importing ? BackupImportRequestSchema.safeParse( input ).success
			: BackupControlRequestSchema.safeParse( input ).success;
		if ( ! valid ) {
			return { status: importing ? 'invalid' : 'unavailable' };
		}
		try {
			if ( ! await options.ready() ) {
				return { status: importing ? 'recovery-pending' : 'unavailable' };
			}
			if ( importing ) {
				return await options.backup.import( input );
			}
			if ( type === 'export-local-backup' ) {
				return await options.backup.export();
			}
			const marker = await readLocalDataGeneration( options.localArea );
			const pending = await options.localArea.get( BackupImportJournalKey );
			return marker?.pending || pending[ BackupImportJournalKey ] !== undefined
				? { status: 'busy' } : { status: 'ready', generation: marker?.generation ?? null };
		} catch {
			return { status: importing ? 'failed' : 'unavailable' };
		}
	}

	/**
	 * Owns only authenticated top-level settings operations outside private browsing.
	 * @param input - Unknown browser message.
	 * @param sender - Browser-authenticated sending context.
	 * @param sendResponse - Response channel, possibly closed after tab departure.
	 * @return True only for an owned asynchronous request.
	 * @since 1.1.0
	 */
	const listener: ProtectionBackgroundMessageListener = ( input, sender, sendResponse ) => {
		const message = RequestTypeSchema.safeParse( input );
		if ( ! message.success || sender.frameId !== 0 || sender.tab?.incognito !== false ||
			sender.url?.split( '#' )[ 0 ] !== options.optionsPageUrl ) {
			return undefined;
		}
		void run( input, message.data.type ).then( ( result ) => {
			try {
				sendResponse( result );
			} catch {
				// The background operation survives closing its requesting settings tab.
			}
		} );
		return true;
	};
	return {
		/** Registers the background listener synchronously and exactly once. */
		start(): void {
			if ( ! registered ) {
				registered = true;
				options.onMessage.addListener( listener );
			}
		},
	};
}

export * from './types';
