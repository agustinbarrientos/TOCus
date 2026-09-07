import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Serves the already-built static Astro output without changing its HTML or assets.
 * @since 0.1.0
 */
export default defineConfig( {
	root: fileURLToPath( new URL( '../../../website/', import.meta.url ) ),
	preview: { host: '127.0.0.1', port: 4178, strictPort: true },
} );
