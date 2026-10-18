import type { BackupDocument } from '../../../../domains/local-data/types/backup-document';
import type { BackupExportResult, BackupImportResult } from '../../../../domains/local-data/types/backup-operation';
import type { SitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import type { PrivacyDataRuntime } from '../privacy-data-actions/types';

/**
 * A validated file and generation captured without replacing any data.
 * @since 1.1.0
 */
export interface BackupPreview {
	backup: BackupDocument;
	expectedGeneration: string | null;
	requestId: string;
}

/**
 * Confirmed import outcome including current browser access.
 * @since 1.1.0
 */
export type BackupActionResult = Exclude<BackupImportResult, Omit<BackupActionCompletion, 'missingAccess'>> |
	BackupPermissionFailure | BackupActionCompletion;

/**
 * Permission API failure before replacement starts.
 * @since 1.1.0
 */
export interface BackupPermissionFailure { status: 'permission-error' }

/**
 * Completed replacement with current browser access.
 * @since 1.1.0
 */
export interface BackupActionCompletion {
	status: 'completed';
	requestId: string;
	generation: string;
	missingAccess: boolean;
}

/**
 * Localized presentation-independent backup operations.
 * @since 1.1.0
 */
export interface BackupDataActions {
	/**
	 * Reads validated local history without changing an active session.
	 * @return Portable backup or unavailable state.
	 */
	export(): Promise<BackupExportResult>;
	/**
	 * Captures the authority generation for a validated selected file.
	 * @param backup - Portable document selected by the user.
	 * @return Explicit replacement preview.
	 */
	preview( backup: BackupDocument ): Promise<BackupPreview>;
	/**
	 * Starts browser consent in the original confirmation gesture.
	 * @param preview - Previously validated file and expected generation.
	 * @return Recoverable replacement result.
	 */
	confirmImport( preview: BackupPreview ): Promise<BackupActionResult>;
}

/**
 * Browser messaging, consent and generation-bound settings refresh.
 * @since 1.1.0
 */
export interface BackupDataActionsOptions {
	runtime: PrivacyDataRuntime;
	permissions: Pick<SitePermissionManager, 'requestMany' | 'hasAccess'>;
	/**
	 * Allocates an identity retained across retries of the same preview.
	 * @return Collision-resistant operation identity.
	 */
	createId(): string;
	/**
	 * Rebinds editors and refreshes coherent preferences after success.
	 * @return Completion of the settings refresh.
	 */
	onImported(): Promise<void>;
}
