import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
	createProtectionCoordinator,
	createProtectionStorageService,
} from '../../domains/protection';

/**
 * Starts browser-backed protection-state restoration for each background runtime.
 * @since 0.1.0 Initial implementation.
 */
export default defineBackground( () => {
	const storage = createProtectionStorageService( {
		durableArea: browser.storage.local,
		sessionArea: browser.storage.session,
		createSnapshotId: crypto.randomUUID.bind( crypto ),
	} );
	const coordinator = createProtectionCoordinator( {
		storage,
		createSessionContinuityId: crypto.randomUUID.bind( crypto ),
	} );

	void coordinator.initialize( {
		nowEpochMilliseconds: Date.now(),
		readyObservations: [],
	} );
} );
