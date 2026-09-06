import { z } from 'zod';
import { type StatisticsRuntimeRequest } from '../../../statistics/types/runtime-message';

/**
 * Explicit full-reset request accepted only from the settings page.
 * @since 0.1.0 Initial implementation.
 */
export const ResetAllDataRequestSchema = z.strictObject( {
	type: z.enum( [ 'reset-all-data' ] ),
} );

/**
 * Validated full-reset request.
 * @since 0.1.0 Initial implementation.
 */
export type ResetAllDataRequest = z.infer<typeof ResetAllDataRequestSchema>;

/**
 * Local background messaging required by privacy controls.
 * @since 0.1.0 Initial implementation.
 */
export interface PrivacyDataRuntime {
	/**
	 * Sends a confirmed local-data operation to its background authority.
	 * @param request - Statistics or full-reset request.
	 * @return Unknown response awaiting validation.
	 * @since 0.1.0 Initial implementation.
	 */
	sendMessage( request: StatisticsRuntimeRequest | ResetAllDataRequest ): Promise<unknown>;
}

/**
 * Local messaging dependency for the privacy action client.
 * @since 0.1.0 Initial implementation.
 */
export interface PrivacyDataActionsOptions {
	/** Background messaging boundary. */
	runtime: PrivacyDataRuntime;
}
