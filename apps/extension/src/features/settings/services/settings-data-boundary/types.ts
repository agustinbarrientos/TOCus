import type { PreferencesStorageArea } from '../../../../domains/preferences/services/preferences-storage';
import type { PreferencesStorageChangeSource } from '../../../preferences/services/preferences-controller';

/**
 * Storage and notifications used by one settings document.
 * @since 1.1.0
 */
export interface SettingsDataBoundaryOptions {
	area: PreferencesStorageArea;
	changes: PreferencesStorageChangeSource;
	/**
	 * Recreates generation-bound editors before publishing replacement values.
	 * @return Completion of editor rebinding.
	 */
	onReplaced(): Promise<void>;
}

/**
 * Coherent reads and subscriptions around a durable data replacement.
 * @since 1.1.0
 */
export interface SettingsDataBoundary {
	area: PreferencesStorageArea;
	changes: PreferencesStorageChangeSource;
}
