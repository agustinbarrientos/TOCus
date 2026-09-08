import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run beside `pnpm --filter @tocus/website dev --port 4180`.
// The browser supplies the standard canvas encoder used by GLTFExporter; no model leaves localhost.
const origin = process.argv[ 2 ] ?? 'http://127.0.0.1:4180';
const url = new URL( origin );
if ( ! [ '127.0.0.1', 'localhost' ].includes( url.hostname ) ) {
	throw new Error( 'Asset authoring only accepts a local development server.' );
}
const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	await page.route( `${ origin }/__mascot-export`, ( route ) => route.fulfill( {
		contentType: 'text/html', body: '<!doctype html><title>Local GLB authoring</title>',
	} ) );
	await page.goto( `${ origin }/__mascot-export` );
	const bytes = await page.evaluate( async () => {
		const { exportMascotGlb } = await import( '/src/services/mascot-asset/export.ts' );
		const response = await fetch( '/src/services/mascot-asset/assets/white-mesh.glb' );
		if ( ! response.ok ) {
			throw new Error( 'The supplied source asset is unavailable.' );
		}
		const output = await exportMascotGlb( await response.arrayBuffer() );
		return Array.from( new Uint8Array( output ) );
	} );
	const directory = new URL( '../public/models/', import.meta.url );
	await mkdir( directory, { recursive: true } );
	await writeFile( new URL( 'mascot.glb', directory ), new Uint8Array( bytes ) );
	process.stdout.write( `Repaired GLB: ${ bytes.length } bytes; saved to apps/website/public/models/mascot.glb\n` );
} finally {
	await browser.close();
}
