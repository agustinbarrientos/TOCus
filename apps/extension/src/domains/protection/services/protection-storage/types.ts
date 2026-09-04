import { z } from 'zod';

/**
 * Stable keys for durable and session protection documents.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStorageKey = Object.freeze( {
	DURABLE: 'tocus.protection.durable.v1',
	SESSION: 'tocus.protection.session.v1',
} as const );

/**
 * Validates one identifier shared by a complete durable and session snapshot.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStorageSnapshotIdSchema = z.uuid().brand<'ProtectionStorageSnapshotId'>();

/**
 * Identifier shared by a complete durable and session snapshot.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStorageSnapshotId = z.infer<typeof ProtectionStorageSnapshotIdSchema>;

/**
 * Validates one domain document wrapped with its shared storage snapshot identifier.
 * @since 0.1.0 Initial implementation.
 */
export const ProtectionStorageEnvelopeSchema = z.object( {
	snapshotId: ProtectionStorageSnapshotIdSchema,
	document: z.unknown(),
} ).strict();

/**
 * Domain document wrapped with its shared storage snapshot identifier.
 * @since 0.1.0 Initial implementation.
 */
export type ProtectionStorageEnvelope = z.infer<typeof ProtectionStorageEnvelopeSchema>;

/**
 * Validates independently loaded durable and session protection documents.
 * @since 0.1.0 Initial implementation.
 */
export const LoadedProtectionStateSchema = z.object( {
	durable: z.unknown().optional(),
	session: z.unknown().optional(),
} ).strict();

/**
 * Independently loaded durable and session protection documents.
 * @since 0.1.0 Initial implementation.
 */
export type LoadedProtectionState = z.infer<typeof LoadedProtectionStateSchema>;

/**
 * Minimal browser storage-area operations used by protection persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionStorageArea {
	/**
	 * Reads one storage key.
	 * @param key - Requested storage key.
	 * @return Stored values indexed by key.
	 * @since 0.1.0 Initial implementation.
	 */
	get( key: string ): Promise<Record<string, unknown>>;

	/**
	 * Writes values indexed by storage key.
	 * @param values - Values to store.
	 * @return Promise resolved after the write completes.
	 * @since 0.1.0 Initial implementation.
	 */
	set( values: Record<string, unknown> ): Promise<void>;
}

/**
 * Browser storage areas used by protection persistence.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionStorageServiceOptions {
	durableArea: ProtectionStorageArea;
	sessionArea: ProtectionStorageArea;

	/**
	 * Creates a fresh storage snapshot identifier.
	 * @return Fresh snapshot identifier.
	 * @since 0.1.0 Initial implementation.
	 */
	createSnapshotId(): string;
}

/**
 * Browser-backed protection persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export interface ProtectionStorageService {
	/**
	 * Loads durable and session protection documents independently.
	 * @return Loaded unknown documents for domain parsing.
	 * @throws {Error} When either browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<LoadedProtectionState>;

	/**
	 * Validates and stores durable and session protection documents.
	 * @param input - Unknown complete stored-state input.
	 * @return Promise resolved after both writes complete.
	 * @throws {Error} When validation fails or either browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void>;

	/**
	 * Validates and stores only the durable document for one statistics-delivery update.
	 * @param input - Unknown current durable-state input.
	 * @return Promise resolved after the durable write completes.
	 * @throws {Error} When validation fails, no current snapshot is established, or storage rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	saveDurableStatisticsDelivery( input: unknown ): Promise<void>;
}
