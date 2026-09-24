import { z } from 'zod';

const preferences = z.object( {
	duration: z.number().int().min( 1 ),
	sites: z.array( z.string().min( 1 ) ),
} );
const globalConfig = { jitless: false };

/**
 * Successful validation through the extension's configured interpreter.
 * @since 1.0.0
 */
export const valid = preferences.safeParse( { duration: 10, sites: [ 'example.com' ] } );
/**
 * Rejected values must stay rejected when compilation is disabled.
 * @since 1.0.0
 */
export const invalid = preferences.safeParse( { duration: 0, sites: [ '' ] } );
/**
 * Other modules can use the same property name without being rewritten.
 * @since 1.0.0
 */
export const unrelatedJitless = globalConfig.jitless;
