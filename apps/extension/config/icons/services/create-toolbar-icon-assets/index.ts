import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { CopiedPublicFile } from 'wxt';
import { ToolbarIcons } from '../../constants/index.ts';

/**
 * Generates two-tone toolbar icons that remain legible independently of browser theme detection.
 * @param directory - Build directory receiving the generated PNG assets.
 * @return Public files copied into the extension package.
 * @since 0.1.0
 */
export async function createToolbarIconAssets( directory: string ): Promise<Array<CopiedPublicFile>> {
	const source = await readFile(
		new URL( '../../../../../../packages/theme/assets/icon.svg', import.meta.url ),
		'utf8',
	);
	// Retain the canonical silhouette and brown currentColor. The cream face stands out on
	// dark toolbars; its brown keyline defines it on light ones. Padding prevents stroke clipping.
	const artwork = source.replace( 'viewBox="0 0 64 64"', 'viewBox="-6 -6 76 76"' )
		.replace( 'fill="currentColor"',
			'fill="#fff8f0" stroke="currentColor" stroke-width="10" stroke-linejoin="round" paint-order="stroke fill"' );
	await mkdir( join( directory, 'icons' ), { recursive: true } );
	const assets: Array<CopiedPublicFile> = [];
	for ( const [ size, relativeDest ] of Object.entries( ToolbarIcons ) ) {
		const absoluteSrc = join( directory, relativeDest );
		await sharp( Buffer.from( artwork ) ).resize( Number( size ) ).png().toFile( absoluteSrc );
		assets.push( { absoluteSrc, relativeDest } );
	}
	return assets;
}
