import type { ProtectedSiteRule } from '../../../protection/types/protected-site-rule';
import type { ProtectionConfigurationDocument } from '../../../protection/types/protected-site-configuration';
import type { BackupExportResult, BackupImportResult } from '../../types/backup-operation';
import type { BackupSource } from '../../utils/backup-document';
import type { LocalDataResetArea, LocalDataResetLocks } from '../local-data-reset/types';

/**
 * Persistence and lifecycle operations owned by the background composition.
 * @since 1.1.0
 */
export interface LocalDataBackupOptions {
	localArea: LocalDataResetArea;
	sessionArea: Pick<LocalDataResetArea, 'remove'>;
	locks: LocalDataResetLocks;
	/**
	 * Creates a fresh data or measurement identity.
	 * @return Stable random identifier.
	 */
	createId(): string;
	/**
	 * Reads current documents under the authoritative statistics queue.
	 * @return Coherent user choices and committed historical aggregates.
	 */
	snapshot(): Promise<BackupSource>;
	/**
	 * Stops ingress and drains old writers before replacing records.
	 * @return Completion of browser cleanup and writer draining.
	 */
	suspend(): Promise<void>;
	/**
	 * Restores protection against the complete authoritative saved documents.
	 * @return Completion of runtime restart and capability reconciliation.
	 */
	resume(): Promise<void>;
	/**
	 * Releases only obsolete website grants after replacement targets are committed.
	 * @param previousRules - Former configured rules retained for recovery.
	 * @param configuration - Committed replacement configuration under mutation coordination.
	 * @return Completion of overlap-aware browser grant cleanup.
	 */
	releaseObsoleteAccess?(
		previousRules: readonly ProtectedSiteRule[], configuration: ProtectionConfigurationDocument,
	): Promise<void>;
}

/**
 * Portable exports and durable, authenticated-caller replacement operations.
 * @since 1.1.0
 */
export interface LocalDataBackup {
	/**
	 * Reads user choices and history without changing current browsing sessions.
	 * @return Export or an unavailable/busy result.
	 */
	export(): Promise<BackupExportResult>;
	/**
	 * Revalidates one untrusted confirmed request before any mutation.
	 * @param request - Unknown background message payload.
	 * @return Completion, validation, conflict, or recovery status.
	 */
	import( request: unknown ): Promise<BackupImportResult>;
	/**
	 * Completes pending replacement before ordinary background startup.
	 * @return Whether startup can safely proceed.
	 */
	recover(): Promise<boolean>;
}
