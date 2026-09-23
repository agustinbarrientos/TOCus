import type { Entrypoint, WxtViteConfig } from 'wxt';

/** Stable destinations already exposed by the protected-page resource allowlist. */
const ProtectedPageFontAssets = new Map( [
	[ 'fredoka-hebrew-wght-normal.woff2', 'assets/protected-page-font.woff2' ],
	[ 'fredoka-latin-ext-wght-normal.woff2', 'assets/protected-page-font2.woff2' ],
	[ 'fredoka-latin-wght-normal.woff2', 'assets/protected-page-font3.woff2' ],
] );

/**
 * Assigns stable font identities to the protected-page CSS entrypoint's assets.
 * @param entrypoints - WXT entrypoints in the current build group.
 * @param config - Merged Vite build configuration for that group.
 * @since 1.0.0 Deterministic release font assets.
 */
export function configureProtectedPageFontAssets( entrypoints: readonly Entrypoint[], config: WxtViteConfig ): void {
	const entrypoint = entrypoints[ 0 ];

	if ( entrypoint === undefined || entrypoints.length !== 1 || entrypoint.name !== 'protected-page-font'
		|| entrypoint.type !== 'unlisted-style' ) {
		return;
	}

	const output = config.build?.rolldownOptions?.output;

	if ( output === undefined || Array.isArray( output ) || output.assetFileNames === undefined ) {
		throw new Error( 'Expected WXT to configure one protected-page font output with asset filenames.' );
	}

	const originalAssetFileNames = output.assetFileNames;

	/**
	 * Resolves font identity without relying on asynchronous emission order.
	 * @param asset - Original names and contents of an emitted Vite asset.
	 * @return Stable font destination or the original non-font naming policy.
	 */
	output.assetFileNames = ( asset ) => {
		const fontNames = asset.names.filter( ( name ) => name.endsWith( '.woff2' ) );
		const fontName = fontNames[ 0 ];

		if ( fontName === undefined ) {
			return typeof originalAssetFileNames === 'function' ? originalAssetFileNames( asset ) : originalAssetFileNames;
		}

		const destination = ProtectedPageFontAssets.get( fontName );

		if ( fontNames.length !== 1 || destination === undefined ) {
			throw new Error( `Unexpected protected-page font asset: ${ fontNames.join( ', ' ) }` );
		}

		return destination;
	};
}
