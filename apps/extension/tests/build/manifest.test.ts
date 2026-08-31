import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const chromeManifestUrl = new URL( '../../.output/chrome-mv3/manifest.json', import.meta.url );
const firefoxManifestUrl = new URL( '../../.output/firefox-mv2/manifest.json', import.meta.url );
const chromeOutputUrl = new URL( '../../.output/chrome-mv3/', import.meta.url );
const firefoxOutputUrl = new URL( '../../.output/firefox-mv2/', import.meta.url );

async function readManifest( url: URL ): Promise<unknown> {
	const manifestPath = fileURLToPath( url );
	const manifestText = await readFile( manifestPath, 'utf8' );

	return JSON.parse( manifestText );
}

async function readOutputFile( outputUrl: URL, filePath: string ): Promise<string> {
	return readFile( fileURLToPath( new URL( filePath, outputUrl ) ), 'utf8' );
}

async function expectPopupComposition( outputUrl: URL ): Promise<void> {
	const popupHtml = await readOutputFile( outputUrl, 'popup.html' );
	const moduleScript = popupHtml.match( /<script\s[^>]*type="module"[^>]*src="([^"]+)"/u );
	const moduleSource = moduleScript?.[ 1 ];

	expect( popupHtml ).toContain( '<tocus-f-popup-shell>' );
	expect( moduleSource ).toBeDefined();

	if ( moduleSource === undefined ) {
		throw new Error( 'The generated popup is missing its module script.' );
	}

	const moduleCode = await readOutputFile( outputUrl, moduleSource.replace( /^\//u, '' ) );

	expect( moduleCode ).toContain( 'customElements.define' );
	expect( moduleCode ).toContain( 'tocus-f-popup-shell' );
}

function expectNoBroadPermissions( manifest: unknown ): void {
	expect( manifest ).not.toHaveProperty( 'permissions' );
	expect( manifest ).not.toHaveProperty( 'optional_permissions' );
	expect( manifest ).not.toHaveProperty( 'host_permissions' );
	expect( manifest ).not.toHaveProperty( 'optional_host_permissions' );
	expect( manifest ).not.toHaveProperty( 'content_scripts' );
}

function expectValidExtensionVersion( manifest: unknown ): void {
	if (
		typeof manifest !== 'object' ||
		manifest === null ||
		! ( 'version' in manifest ) ||
		typeof manifest.version !== 'string'
	) {
		throw new TypeError( 'The generated manifest is missing a string version.' );
	}

	const versionParts = manifest.version.split( '.' );

	expect( versionParts ).toHaveLength( 3 );
	expect( versionParts ).toEqual( versionParts.map( ( part ) => String( Number.parseInt( part, 10 ) ) ) );
	expect(
		versionParts.every( ( part ) => {
			const value = Number( part );

			return Number.isInteger( value ) && value >= 0 && value <= 65_535;
		} ),
	).toBe( true );
	expect( versionParts.some( ( part ) => Number( part ) !== 0 ) ).toBe( true );
}

describe( 'extension build manifest', () => {
	test( 'produces a minimal Chrome popup manifest', async () => {
		const manifest = await readManifest( chromeManifestUrl );

		expect( manifest ).toMatchObject( {
			manifest_version: 3,
			name: 'TOCus',
			action: { default_popup: 'popup.html' },
		} );
		expect( manifest ).not.toHaveProperty( 'background' );
		expect( manifest ).not.toHaveProperty( 'browser_specific_settings' );
		expectNoBroadPermissions( manifest );
		expectValidExtensionVersion( manifest );
	} );

	test( 'produces a minimal Firefox popup manifest with an explicit no-data declaration', async () => {
		const manifest = await readManifest( firefoxManifestUrl );

		expect( manifest ).toMatchObject( {
			manifest_version: 2,
			name: 'TOCus',
			browser_action: { default_popup: 'popup.html' },
			browser_specific_settings: {
				gecko: {
					id: 'tocus@agustinbarrientos.github.io',
					data_collection_permissions: { required: [ 'none' ] },
				},
			},
		} );
		expect( manifest ).not.toHaveProperty( 'background' );
		expect( manifest ).not.toHaveProperty( 'browser_specific_settings.gecko.data_collection_permissions.optional' );
		expectNoBroadPermissions( manifest );
		expectValidExtensionVersion( manifest );
	} );

	test.each( [
		[ 'Chrome', chromeOutputUrl ],
		[ 'Firefox', firefoxOutputUrl ],
	] )( 'connects the generated %s popup to its component implementation', async ( _browser, outputUrl ) => {
		await expectPopupComposition( outputUrl );
	} );
} );
