import type { BackupDataActions, BackupDataActionsOptions } from '../../../settings/services/backup-data-actions';
import type { ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';

/**
 * Local backup restoration and browser access recovery during onboarding.
 * @since 1.1.0
 */
export interface OnboardingBackupActions extends Pick<BackupDataActions, 'preview' | 'confirmImport'> {
	/**
	 * Requests current restored website access in the original user gesture.
	 * @return Whether every current restored rule has verified browser access.
	 */
	requestAccess(): Promise<boolean>;
}

/**
 * Shared import dependencies and the authoritative restored website projection.
 * @since 1.1.0
 */
export interface OnboardingBackupOptions extends BackupDataActionsOptions {
	/**
	 * Reads the latest complete site projection without asynchronous work.
	 * @return Current authoritative website rules.
	 */
	getProtectedSites(): readonly ProtectedSiteConfiguration[];
}
