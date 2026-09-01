import { z } from 'zod';
import {
	ProtectionScopeIdSchema,
	SessionContinuityIdSchema,
} from '../../types/protection-value';
import { ProtectionStateSchema } from '../../types/protection-state';

/**
 * Validates runtime protection states indexed by their scope identifiers.
 * @since 0.1.0 Initial implementation.
 */
const RuntimeProtectionStatesByScopeSchema = z.preprocess(
	( input ) => {
		if ( typeof input !== 'object' || input === null || Array.isArray( input ) ) {
			return null;
		}

		const prototype: unknown = Object.getPrototypeOf( input );

		if ( prototype !== Object.prototype && prototype !== null ) {
			return null;
		}

		return Object.entries( input );
	},
	z.array( z.tuple( [ ProtectionScopeIdSchema, ProtectionStateSchema ] ) ),
).transform( ( entries ) => Object.fromEntries( entries ) );

/**
 * Validates runtime protection state supplied for stored-state preparation.
 * @since 0.1.0 Initial implementation.
 */
export const PrepareStoredProtectionStateInputSchema = z.object( {
	statesByScope: RuntimeProtectionStatesByScopeSchema,
	sessionContinuityId: SessionContinuityIdSchema,
} ).strict().superRefine( ( input, context ) => {
	Object.entries( input.statesByScope ).forEach( ( [ scopeId, state ] ) => {
		if ( scopeId !== state.scopeId ) {
			context.addIssue( {
				code: 'custom',
				message: 'A runtime-state record key must equal its contained scope identifier.',
				path: [ 'statesByScope', scopeId, 'scopeId' ],
			} );
		}
	} );
} );

/**
 * Runtime protection state supplied for stored-state preparation.
 * @since 0.1.0 Initial implementation.
 */
export type PrepareStoredProtectionStateInput = z.infer<typeof PrepareStoredProtectionStateInputSchema>;
