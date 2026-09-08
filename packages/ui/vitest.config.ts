import { defineConfig } from 'vitest/config';

/**
 * Browser fixture runner, isolated from the domain suite.
 * @since 0.1.0
 */
export default defineConfig( { test: { include: [ 'tests/**/*.test.ts' ], testTimeout: 30000, hookTimeout: 30000 } } );
