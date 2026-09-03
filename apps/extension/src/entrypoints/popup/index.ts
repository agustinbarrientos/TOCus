import '@tocus/theme/index.scss';
import { browser } from 'wxt/browser';
import { createPreferencesStorageService } from '../../domains/preferences/services';
import { createPreferencesController } from '../../features/preferences/services/preferences-controller';
import '../../features/popup/components/shell';
import './styles.scss';

const preferencesStorage = createPreferencesStorageService( {
	area: browser.storage.local,
} );
const preferencesController = createPreferencesController( {
	appearanceTarget: document.documentElement,
	storage: preferencesStorage,
	storageChanges: browser.storage.onChanged,
	systemMotionPreference: window.matchMedia( '(prefers-reduced-motion: reduce)' ),
} );

/**
 * Applies persisted preferences before revealing the popup document.
 * @return Promise resolved after the initial preference projection.
 * @since 0.1.0 Initial implementation.
 */
async function startPopup(): Promise<void> {
	await preferencesController.start();
	document.documentElement.style.removeProperty( 'color-scheme' );
	document.documentElement.style.removeProperty( 'background' );
	document.documentElement.style.removeProperty( 'visibility' );
}

void startPopup();
