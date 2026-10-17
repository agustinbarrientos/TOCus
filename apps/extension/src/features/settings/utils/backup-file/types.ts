/**
 * Minimal file surface, keeping size checks ahead of browser decoding.
 * @since 1.1.0
 */
export interface BackupFile {
	size: number;
	/**
	 * Reads selected file bytes as text.
	 * @return Decoded local file.
	 */
	text(): Promise<string>;
}

/**
 * Safe localized file failure categories.
 * @since 1.1.0
 */
export const BackupFileFailure = {
	OVERSIZE: 'oversize', READ: 'read', JSON: 'json', APPLICATION: 'application',
	UNSUPPORTED: 'unsupported', INVALID: 'invalid',
} as const;

/**
 * Localized file failure category.
 * @since 1.1.0
 */
export type BackupFileFailure = typeof BackupFileFailure[keyof typeof BackupFileFailure];
