import { StatisticsDocumentSchema, type StatisticsDocument } from '../../types/statistics-document';
import { createStatisticsDocument } from '../../utils/create-statistics-document';
import {
	StatisticsStorageKey,
	type StatisticsStorageService,
	type StatisticsStorageServiceOptions,
} from './types';

/**
 * Creates local persistence for aggregate statistics.
 * @param options - Local browser storage dependency and generation factory.
 * @return Local statistics persistence operations.
 * @since 0.1.0 Initial implementation.
 */
export function createStatisticsStorageService(
	options: StatisticsStorageServiceOptions,
): StatisticsStorageService {
	/**
	 * Loads current statistics without replacing malformed stored data.
	 * @return Current statistics, an in-memory empty document, or null for unsafe persistence.
	 * @throws {Error} When the browser storage read rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function load(): Promise<StatisticsDocument | null> {
		const values = await options.area.get( StatisticsStorageKey.STATISTICS );

		if ( ! Object.hasOwn( values, StatisticsStorageKey.STATISTICS ) ) {
			return createStatisticsDocument( options.createGenerationId() );
		}

		const document = StatisticsDocumentSchema.safeParse(
			values[ StatisticsStorageKey.STATISTICS ],
		);

		return document.success ? document.data : null;
	}

	/**
	 * Validates and stores one complete local statistics document.
	 * @param input - Unknown statistics document input.
	 * @return Promise resolved after the write completes.
	 * @throws {import('zod').ZodError} When the document violates its storage contract.
	 * @throws {Error} When the browser storage write rejects.
	 * @since 0.1.0 Initial implementation.
	 */
	async function save( input: unknown ): Promise<void> {
		const document = StatisticsDocumentSchema.parse( input );

		await options.area.set( {
			[ StatisticsStorageKey.STATISTICS ]: document,
		} );
	}

	return { load, save };
}

export * from './types';
