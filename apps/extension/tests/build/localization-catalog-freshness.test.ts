import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	getCatalogs,
	type ExtractedMessageType,
	type MessageOrigin,
	type MessageType,
} from '@lingui/cli/api';
import { getConfig } from '@lingui/conf';
import { describe, expect, it } from 'vitest';

/**
 * Absolute repository root used to resolve the shared Lingui configuration.
 * @since 0.1.0 Initial implementation.
 */
const repositoryRoot = fileURLToPath( new URL( '../../../../', import.meta.url ) );

/**
 * Normalizes one Lingui origin to its repository-relative source filename.
 * @param origin - Source filename and optional source line.
 * @return Repository-relative source filename.
 * @since 0.1.0 Initial implementation.
 */
function normalizeOrigin( origin: MessageOrigin ): string {
	const [ filename ] = origin;
	const relativeFilename = path.isAbsolute( filename )
		? path.relative( repositoryRoot, filename )
		: filename;

	return relativeFilename.split( path.sep ).join( '/' );
}

/**
 * Projects catalog metadata that must stay synchronized with its app source.
 * @param catalog - Extracted or committed Lingui catalog.
 * @return Stable catalog projection indexed by message identifier.
 * @since 0.1.0 Initial implementation.
 */
function projectCatalogMetadata<Message extends MessageType | ExtractedMessageType>(
	catalog: Readonly<Record<string, Message>>,
) {
	return Object.fromEntries(
		Object.entries( catalog )
			.sort( ( [ leftId ], [ rightId ] ) => leftId.localeCompare( rightId ) )
			.map( ( [ messageId, entry ] ) => [
				messageId,
				{
					comments: [ ...( entry.comments ?? [] ) ].sort(),
					context: entry.context ?? null,
					origins: Array.from(
						new Set( ( entry.origin ?? [] ).map( normalizeOrigin ) ),
					).sort(),
					source: entry.message ?? null,
				},
			] ),
	);
}

/**
 * Verifies every locale for one app catalog against messages extracted from current source code.
 * @param name - App name used in diagnostics.
 * @param relativePath - Repository-relative Lingui catalog path.
 * @return Promise resolved when every committed catalog is current and fully translated.
 * @since 0.1.0 Initial implementation.
 */
async function verifyLocalizationCatalogFreshness( name: string, relativePath: string ): Promise<void> {
	const config = getConfig( {
		configPath: path.join( repositoryRoot, 'lingui.config.ts' ),
		cwd: repositoryRoot,
	} );
	const locales: ReadonlyArray<string> = config.locales;
	const catalogs = await getCatalogs( config );
	const expectedPath = path.join( repositoryRoot, relativePath );
	const appCatalog = catalogs.find( ( catalog ) => catalog.path === expectedPath );

	if ( appCatalog === undefined ) {
		throw new Error( `The ${ name } Lingui catalog is not configured.` );
	}

	const extractedCatalog = await appCatalog.collect();

	if ( extractedCatalog === undefined ) {
		throw new Error( `The ${ name } source catalog could not be extracted.` );
	}

	const extractedMetadata = projectCatalogMetadata( extractedCatalog );

	for ( const locale of locales ) {
		const committedCatalog = await appCatalog.read( locale );

		if ( committedCatalog === undefined ) {
			throw new Error( `The ${ locale } ${ name } catalog is missing.` );
		}

		expect( projectCatalogMetadata( committedCatalog ), locale ).toEqual( extractedMetadata );
		expect(
			Object.entries( committedCatalog )
				.filter( ( [ , entry ] ) => ! entry.translation )
				.map( ( [ messageId ] ) => messageId ),
			locale,
		).toEqual( [] );
	}
}

describe( 'localization catalog freshness', () => {
	it( 'matches extension catalogs to current source metadata without writing', async () => {
		await verifyLocalizationCatalogFreshness( 'extension', 'apps/extension/locales/{locale}' );
	} );

	it( 'matches website catalogs to current source metadata without writing', async () => {
		await verifyLocalizationCatalogFreshness( 'website', 'apps/website/locales/{locale}' );
	} );
} );
