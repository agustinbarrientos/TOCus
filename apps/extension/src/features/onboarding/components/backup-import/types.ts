import type { BackupResetScreenCopy } from '../../../settings/components/backup-reset-screen/types';
import type { OnboardingState } from '../../types/flow';
import type { OnboardingContentProps } from '../../types/presentation';

/**
 * Localized onboarding import, review and permission recovery messages.
 * @since 1.1.0
 */
export interface OnboardingBackupCopy {
	entryLabel: string;
	importTitle: string;
	importDescription: string;
	chooseFile: string;
	reviewTitle: string;
	reviewDescription: string;
	restoreBackup: string;
	chooseDifferentFile: string;
	websitesLabel: string;
	settingsLabel: string;
	statisticsLabel: string;
	includedLabel: string;
	replacementDescription: string;
	successTitle: string;
	successDescription: string;
	accessTitle: string;
	accessDescription: string;
	allowAccess: string;
	later: string;
	accessError: string;
	common: Readonly<BackupResetScreenCopy>;
	/**
	 * Formats the validated backup's creation date in the current locale.
	 * @param value - Validated ISO export date.
	 * @return Localized creation date.
	 */
	formatCreatedAt( value: string ): string;
	/**
	 * Formats the complete imported reconsidered-visit total.
	 * @param count - Total visits across imported scopes.
	 * @return Localized visit count and noun.
	 */
	formatReconsideredVisits( count: number ): string;
}

/**
 * Page-owned backup authority and the manual setup operation guard.
 * @since 1.1.0
 */
export interface OnboardingBackupImportProps {
	readonly state: Readonly<OnboardingState>;
	readonly disabled: boolean;
	/**
	 * Ends manual setup after a durable import, retaining any access recovery.
	 * @param missingAccess - Whether imported websites still need browser access.
	 */
	readonly onImported: ( missingAccess: boolean ) => void;
}

/**
 * Restored page outcome and the remaining website permission decision.
 * @since 1.1.0
 */
export interface OnboardingBackupOutcomeProps extends OnboardingContentProps {
	readonly missingAccess: boolean;
	/** Replaces access recovery with verified completion after all grants are checked. */
	readonly onAccessGranted: () => void;
}
