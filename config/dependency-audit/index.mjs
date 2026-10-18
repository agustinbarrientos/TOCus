import { execFileSync, spawnSync } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const advisory = 'GHSA-vfj7-8cjw-p6xm';
const reviewDeadline = Date.parse( '2026-10-31T05:00:00.000Z' );
const repositoryRoot = fileURLToPath( new URL( '../../', import.meta.url ) );
const packageName = /^(?:npm:)?braces(?:@|$)/u;

/**
 * Checks whether the single approved development-tool exception still applies.
 * @since 1.1.0 Temporary development-tool audit exception.
 * @param {object} settings Effective native audit settings.
 * @param {object[]} productionGraph Complete recursive production lockfile graph.
 * @param {Date} [now] Current time used for the review deadline.
 */
export function validateAuditException( settings, productionGraph, now = new Date() ) {
	if ( ! ( now instanceof Date ) || ! Number.isFinite( now.getTime() ) || now.getTime() >= reviewDeadline ) {
		throw new Error( 'The Braces audit exception requires review by 2026-10-31 at 00:00 America/Bogota.' );
	}
	if ( ! Array.isArray( settings?.ignore ) || settings.ignore.length !== 1 || settings.ignore[ 0 ] !== advisory ) {
		throw new Error( `Only the approved ${ advisory } audit exception is allowed.` );
	}
	if ( ! Array.isArray( productionGraph ) || productionGraph.length === 0 || productionGraph.some( ( row ) =>
		! row || typeof row !== 'object' || typeof row.name !== 'string' || ! row.name.trim() ||
		typeof row.path !== 'string' || ! isAbsolute( row.path ) ) ) {
		throw new Error( 'A complete production lockfile dependency graph is required for the audit exception.' );
	}

	const pending = [ ...productionGraph ];
	while ( pending.length ) {
		const node = pending.pop();
		if ( [ node.name, node.from, node.version ].some( ( value ) =>
			typeof value === 'string' && packageName.test( value ) ) ) {
			throw new Error( 'Braces appears in production dependencies; its development-tool exception no longer applies.' );
		}
		for ( const group of [ 'dependencies', 'optionalDependencies' ] ) {
			if ( node[ group ] === undefined ) {
				continue;
			}
			if ( ! node[ group ] || typeof node[ group ] !== 'object' || Array.isArray( node[ group ] ) ) {
				throw new Error( 'The production lockfile dependency graph is malformed.' );
			}
			for ( const [ name, dependency ] of Object.entries( node[ group ] ) ) {
				if ( packageName.test( name ) ) {
					throw new Error( 'Braces appears in production dependencies; its development-tool exception no longer applies.' );
				}
				if ( ! dependency || typeof dependency !== 'object' || Array.isArray( dependency ) ||
					[ 'from', 'version', 'path' ].some( ( field ) =>
						typeof dependency[ field ] !== 'string' || ! dependency[ field ].trim() ) ||
					! isAbsolute( dependency.path ) ) {
					throw new Error( 'The production lockfile dependency graph is malformed.' );
				}
				pending.push( dependency );
			}
		}
	}
}

/**
 * Reads native policy and lockfile evidence before running the unchanged high-severity audit.
 * @return {number} Native audit exit status, or failure when it terminates without a status.
 */
function auditDependencies() {
	const options = { cwd: repositoryRoot, encoding: 'utf8', timeout: 30_000, maxBuffer: 32 * 1024 * 1024 };
	const settings = JSON.parse( execFileSync( 'pnpm', [ 'config', 'get', 'audit', '--json' ], options ) );
	const graph = JSON.parse( execFileSync( 'pnpm', [
		'list', '-r', '--prod', '--depth', 'Infinity', '--json', '--lockfile-only',
	], options ) );
	validateAuditException( settings, graph );
	console.info( `Approved development-tool exception: ${ advisory }; review due 2026-10-31 (America/Bogota).` );
	const result = spawnSync( 'pnpm', [ 'audit', '--audit-level=high', '--ignore-registry-errors' ], {
		cwd: repositoryRoot,
		stdio: 'inherit',
	} );
	if ( result.error ) {
		throw result.error;
	}
	return result.status ?? 1;
}

if ( process.argv[ 1 ] && fileURLToPath( import.meta.url ) === resolve( process.argv[ 1 ] ) ) {
	try {
		process.exitCode = auditDependencies();
	} catch ( error ) {
		console.error( error instanceof Error ? error.message : String( error ) );
		process.exitCode = 1;
	}
}
