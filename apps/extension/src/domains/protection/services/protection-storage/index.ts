import {
	StoredDurableProtectionStateSchema,
	StoredProtectionStateSchema,
} from '../../types/stored-protection-state';
import {
	LoadedProtectionStateSchema,
	ProtectionStorageEnvelopeSchema,
	ProtectionStorageKey,
	ProtectionStorageSnapshotIdSchema,
	type LoadedProtectionState,
	type ProtectionStorageService,
	type ProtectionStorageServiceOptions,
	type ProtectionStorageSnapshotId,
} from './types';

/**
 * Creates browser-backed durable and session protection persistence.
 * @param options - Browser storage areas used by the service.
 * @return Focused protection storage operations.
 * @since 0.1.0 Initial implementation.
 */
export function createProtectionStorageService(
	options: ProtectionStorageServiceOptions,
): ProtectionStorageService {
	let currentSnapshotId: ProtectionStorageSnapshotId | null = null;

	/**
	 * Loads one complete durable and session snapshot for domain parsing.
	 * @return Compatible domain documents from the latest complete snapshot.
	 * @throws {Error} When either browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(): Promise<LoadedProtectionState> {
		currentSnapshotId = null;
		const [ durableValues, sessionValues ] = await Promise.all( [
			options.durableArea.get( ProtectionStorageKey.DURABLE ),
			options.sessionArea.get( ProtectionStorageKey.SESSION ),
		] );
		const hasDurableEnvelope = Object.hasOwn( durableValues, ProtectionStorageKey.DURABLE );

		if ( ! hasDurableEnvelope ) {
			return LoadedProtectionStateSchema.parse( {} );
		}

		const durableEnvelope = ProtectionStorageEnvelopeSchema.safeParse(
			durableValues[ ProtectionStorageKey.DURABLE ],
		);

		if ( ! durableEnvelope.success ) {
			return LoadedProtectionStateSchema.parse( { durable: null } );
		}

		currentSnapshotId = durableEnvelope.data.snapshotId;

		const sessionEnvelope = Object.hasOwn( sessionValues, ProtectionStorageKey.SESSION )
			? ProtectionStorageEnvelopeSchema.safeParse( sessionValues[ ProtectionStorageKey.SESSION ] )
			: null;

		return LoadedProtectionStateSchema.parse( {
			durable: durableEnvelope.data.document,
			...( sessionEnvelope?.success === true &&
				sessionEnvelope.data.snapshotId === durableEnvelope.data.snapshotId
				? { session: sessionEnvelope.data.document }
				: {} ),
		} );
	}

	/**
	 * Validates and stores session state before durable state.
	 * @param input - Unknown complete stored-state input.
	 * @return Promise resolved after both writes complete.
	 * @throws {Error} When validation fails or either browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function save( input: unknown ): Promise<void> {
		const state = StoredProtectionStateSchema.parse( input );
		const snapshotId = ProtectionStorageSnapshotIdSchema.parse( options.createSnapshotId() );
		const sessionEnvelope = ProtectionStorageEnvelopeSchema.parse( {
			snapshotId,
			document: state.session,
		} );
		const durableEnvelope = ProtectionStorageEnvelopeSchema.parse( {
			snapshotId,
			document: state.durable,
		} );

		await options.sessionArea.set( {
			[ ProtectionStorageKey.SESSION ]: sessionEnvelope,
		} );
		await options.durableArea.set( {
			[ ProtectionStorageKey.DURABLE ]: durableEnvelope,
		} );

		currentSnapshotId = snapshotId;
	}

	/**
	 * Validates and stores only the durable document for one statistics-delivery update.
	 * @param input - Unknown current durable-state input.
	 * @return Promise resolved after the durable write completes.
	 * @throws {Error} When validation fails, no current snapshot is established, or storage rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function saveDurableStatisticsDelivery( input: unknown ): Promise<void> {
		const durableState = StoredDurableProtectionStateSchema.parse( input );

		if ( currentSnapshotId === null ) {
			throw new Error( 'Cannot acknowledge statistics without a current protection snapshot.' );
		}

		const durableEnvelope = ProtectionStorageEnvelopeSchema.parse( {
			snapshotId: currentSnapshotId,
			document: durableState,
		} );

		await options.durableArea.set( {
			[ ProtectionStorageKey.DURABLE ]: durableEnvelope,
		} );
	}

	return { load, save, saveDurableStatisticsDelivery };
}

export * from './types';
