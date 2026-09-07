import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { CopiedPublicFile } from 'wxt';

/**
 * Generates contrasting tab icons from the canonical brand silhouette.
 * @param directory - Build directory receiving the generated PNG assets.
 * @return Public files copied into the extension package.
 * @since 0.1.0 Initial implementation.
 */
export async function createTabFaviconAssets( directory: string ): Promise<Array<CopiedPublicFile>> {
	const source = await readFile(
		new URL( '../../../../../../packages/theme/assets/icon.svg', import.meta.url ),
		'utf8',
	);
	const variants = [
		[ 'tab-dark', source ],
		[ 'tab-light', source.replace( 'fill="currentColor"', 'fill="#fff8f0"' ) ],
	] as const;
	const assets: Array<CopiedPublicFile> = [];

	await mkdir( directory, { recursive: true } );

	for ( const [ name, svg ] of variants ) {
		const absoluteSrc = join( directory, `${ name }.png` );

		await sharp( Buffer.from( svg ) ).resize( 32 ).png().toFile( absoluteSrc );
		assets.push( { absoluteSrc, relativeDest: `icons/${ name }.png` } );
	}

	return assets;
}
