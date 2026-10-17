import type { LocalDataBackup } from '../../../../domains/local-data/services/local-data-backup';
import type { LocalDataGenerationArea } from '../../../../domains/local-data/services/local-data-generation';
import type { LocalDataResetMessageEvent } from '../local-data-reset-controller/types';

/**
 * Trusted browser metadata and recovery-aware backup authority.
 * @since 1.1.0
 */
export interface LocalDataBackupControllerOptions {
	optionsPageUrl: string;
	localArea: LocalDataGenerationArea;
	backup: LocalDataBackup;
	onMessage: LocalDataResetMessageEvent;
	/**
	 * Waits for initial recovery or retries previously failed recovery.
	 * @return Whether ordinary backup operations can proceed.
	 */
	ready(): Promise<boolean>;
}

/**
 * Single-lifetime background message registration.
 * @since 1.1.0
 */
export interface LocalDataBackupController {
	/** Registers authenticated settings requests once. */
	start(): void;
}
