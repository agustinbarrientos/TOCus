import {
	BackupExportResultSchema, BackupImportResultSchema, BackupStateResultSchema,
} from '../../../../domains/local-data/types/backup-operation';
import { BackupDocumentSchema } from '../../../../domains/local-data/types/backup-document';
import { SitePermissionRequestStatus } from '../../../protected-sites/services/site-permission-manager';
import type { BackupDataActions, BackupDataActionsOptions, BackupPreview, BackupActionResult } from './types';

/**
 * Keeps file previews read-only and confirmed replacements owned by the background.
 * @param options - Messaging, user-gesture consent and coherent settings refresh.
 * @return Validated export, preview and recoverable import actions.
 * @since 1.1.0
 */
export function createBackupDataActions( options: BackupDataActionsOptions ): BackupDataActions {
	const pending = new Map<string, Promise<BackupActionResult>>();

	/**
	 * Requests access before the first await and then submits the stable request identity.
	 * @param preview - Confirmed file and expected data generation.
	 * @return Completion with actual access state, or a safe retry outcome.
	 * @since 1.1.0
	 */
	async function replace( preview: BackupPreview ): Promise<BackupActionResult> {
		const rules = preview.backup.settings.sites.map( ( site ) => site.rule );
		try {
			const consent = await options.permissions.requestMany( rules );
			if ( consent.status === SitePermissionRequestStatus.ERROR ) {
				return { status: 'permission-error' };
			}
		} catch {
			return { status: 'permission-error' };
		}
		try {
			const result = BackupImportResultSchema.parse( await options.runtime.sendMessage( {
				type: 'import-local-backup', ...preview,
			} ) );
			if ( result.status !== 'completed' ) {
				return result;
			}
			if ( result.requestId !== preview.requestId ) {
				return { status: 'recovery-pending' };
			}
			await options.onImported();
			const access = await Promise.all( rules.map( ( rule ) => options.permissions.hasAccess( rule ) ) );
			return { ...result, missingAccess: access.some( ( granted ) => ! granted ) };
		} catch {
			// A closed response channel does not establish whether the durable import committed.
			return { status: 'recovery-pending' };
		}
	}

	return {
		/**
		 * Validates the background response before allowing a local download.
		 * @return Portable document or an unavailable state.
		 * @since 1.1.0
		 */
		async export() {
			try {
				return BackupExportResultSchema.parse( await options.runtime.sendMessage( { type: 'export-local-backup' } ) );
			} catch {
				return { status: 'unavailable' };
			}
		},
		/**
		 * Captures the current generation without saving the selected file.
		 * @param backup - Portable backup selected by the user.
		 * @return Validated preview for explicit replacement confirmation.
		 * @since 1.1.0
		 */
		async preview( backup ): Promise<BackupPreview> {
			const document = BackupDocumentSchema.parse( backup );
			const state = BackupStateResultSchema.parse(
				await options.runtime.sendMessage( { type: 'read-local-backup-state' } ),
			);
			if ( state.status !== 'ready' ) {
				throw new Error( 'Local data recovery is pending.' );
			}
			return { backup: document, expectedGeneration: state.generation, requestId: options.createId() };
		},
		/**
		 * Coalesces repeated confirmation while retaining the preview identity for later retries.
		 * @param preview - Validated replacement preview.
		 * @return The in-flight or newly started replacement.
		 * @since 1.1.0
		 */
		confirmImport( preview ): Promise<BackupActionResult> {
			const existing = pending.get( preview.requestId );
			if ( existing ) {
				return existing;
			}
			const operation = replace( preview ).finally( () => {
				pending.delete( preview.requestId );
			} );
			pending.set( preview.requestId, operation );
			return operation;
		},
	};
}

export * from './types';
