import { createBackupDataActions } from '../../../settings/services/backup-data-actions';
import { SitePermissionRequestStatus } from '../../../protected-sites/services/site-permission-manager';
import type { OnboardingBackupActions, OnboardingBackupOptions } from './types';

/**
 * Reuses generation-bound imports and verifies access to restored onboarding rules.
 * @param options - Shared backup dependencies and authoritative website projection.
 * @return Read-only preview, explicit restoration and gesture-owned access recovery.
 * @since 1.1.0
 */
export function createOnboardingBackupActions( options: OnboardingBackupOptions ): OnboardingBackupActions {
	const actions = createBackupDataActions( options );
	return {
		preview: actions.preview.bind( actions ),
		confirmImport: actions.confirmImport.bind( actions ),
		/**
		 * Starts browser consent before awaiting and verifies the actual grants afterward.
		 * @return Whether every current restored website has complete browser access.
		 * @since 1.1.0
		 */
		async requestAccess(): Promise<boolean> {
			const rules = options.getProtectedSites().map( ( site ) => site.rule );
			try {
				const consent = await options.permissions.requestMany( rules );
				if ( consent.status !== SitePermissionRequestStatus.GRANTED ) {
					return false;
				}
				const grants = await Promise.all( rules.map( ( rule ) => options.permissions.hasAccess( rule ) ) );
				return grants.every( ( granted ) => granted );
			} catch {
				return false;
			}
		},
	};
}

export * from './types';
