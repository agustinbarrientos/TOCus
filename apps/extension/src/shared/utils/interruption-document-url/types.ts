/**
 * Packaged pause document identities, including the pre-favicon-fix upgrade entrypoint.
 * @since 1.0.0 Initial implementation.
 */
export const InterruptionDocumentPath = {
	CURRENT: '/pause.html',
	LEGACY: '/interruption.html',
} as const;

/**
 * Packaged path accepted by the pause document compatibility boundary.
 * @since 1.0.0 Initial implementation.
 */
export type InterruptionDocumentPath = typeof InterruptionDocumentPath[ keyof typeof InterruptionDocumentPath ];
