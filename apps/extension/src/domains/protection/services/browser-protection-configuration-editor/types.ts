import {
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
} from '../protection-configuration-editor';
import {
	type ProtectionConfigurationStorageArea,
	type ProtectionConfigurationStorageService,
} from '../protection-configuration-storage';

/**
 * Browser lock boundary used to coordinate protection mutations across extension contexts.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionConfigurationMutationLock {
	/**
	 * Runs one protection mutation while holding an exclusive named lock.
	 * @param name - Stable lock name.
	 * @param mutation - Deferred protection configuration mutation.
	 * @return Exact edit result after the lock is released.
	 * @since 0.1.0 Initial implementation.
	 */
	request(
		name: string,
		mutation: ProtectionConfigurationMutation,
	): Promise<ProtectionConfigurationEditResult>;
}

/**
 * Browser cryptography boundary used to create collision-resistant identifiers.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionCryptography {
	/**
	 * Creates one unprefixed collision-resistant identifier.
	 * @return Browser-generated identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	randomUUID(): string;
}

/**
 * Browser dependencies required by coordinated protection configuration editing.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionConfigurationEditorOptions {
	/** Extension-local storage area. */
	area: ProtectionConfigurationStorageArea;
	/** Collision-resistant browser identifier source. */
	cryptography: BrowserProtectionCryptography;
	/** Extension-origin lock manager. */
	locks: BrowserProtectionConfigurationMutationLock;
}

/**
 * Coordinated protection editor and its shared persistence boundary.
 * @since 0.1.0 Initial implementation.
 */
export interface BrowserProtectionConfigurationEditor {
	/** Validated protection configuration editing operations. */
	editor: ProtectionConfigurationEditor;
	/** Persistence used by the editor and page-level configuration reads. */
	storage: ProtectionConfigurationStorageService;
}
