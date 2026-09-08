import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';
import inventory from '../inventory.json' with { type: 'json' };
import type { OriginalAuditResult } from './types';

/**
 * Recognizes explicit selections containing only the known supplemental projects.
 * @remarks Missing, wildcard, unknown and mixed original selections keep the complete original gate.
 * @param arguments_ - Playwright command-line arguments, including repeated or variadic project options.
 * @return Whether the caller deliberately omitted the original project.
 * @since 0.1.0
 */
function isSupplementalOnlyRun( arguments_: readonly string[] ): boolean {
	const projects: string[] = [];
	for ( let index = 0; index < arguments_.length; index++ ) {
		const argument = arguments_[ index ] ?? '';
		if ( argument === '--' ) {
			break;
		}
		if ( argument !== '--project' && ! argument.startsWith( '--project=' ) ) {
			continue;
		}
		const previousCount = projects.length;
		if ( argument.startsWith( '--project=' ) ) {
			projects.push( argument.slice( '--project='.length ) );
		}
		while ( index + 1 < arguments_.length ) {
			const project = arguments_[ index + 1 ];
			if ( project === undefined || project.startsWith( '-' ) ) {
				break;
			}
			projects.push( project );
			index++;
		}
		if ( projects.length === previousCount ) {
			return false;
		}
	}
	return projects.length > 0 && projects.every( ( project ) =>
		project === 'chromium-onboarding' || project === 'chromium-website' );
}

/**
 * Makes immutable-original integrity and complete case registration part of the normal visual gate.
 * Explicit case or supplemental-only runs may omit original registrations, never their hash checks.
 * @since 0.1.0
 */
export default class OriginalSnapshotAudit implements Reporter {
	private failed = false;

	/**
	 * Verifies all original bytes and requires all106 registrations in a default unfiltered run.
	 * @remarks Missing original discovery is a failure, not an implicit supplemental-only selection.
	 * @param config - Resolved project filters and comparison configuration.
	 * @param suite - Registered tests remaining after explicit command-line filtering.
	 * @since 0.1.0
	 */
	onBegin( config: FullConfig, suite: Suite ): void {
		const failures: string[] = [];
		const originalPaths = new Set( inventory.map( ( entry ) => entry.path ) );
		if ( originalPaths.size !== 106 || inventory.length !== 106 ) {
			failures.push( 'The immutable original inventory must contain exactly106 unique paths.' );
		}
		for ( const entry of inventory ) {
			try {
				const bytes = readFileSync( fileURLToPath( new URL( `../../../../${ entry.path }`, import.meta.url ) ) );
				if ( createHash( 'sha256' ).update( bytes ).digest( 'hex' ) !== entry.sha256 ) {
					failures.push( `Original bytes changed: ${ entry.path }` );
				}
			} catch {
				failures.push( `Original file missing or unreadable: ${ entry.path }` );
			}
		}
		const explicitFilter = process.argv.some( ( argument ) =>
			argument === '-g' || argument.startsWith( '--grep' ) || argument.endsWith( '.spec.ts' ) );
		const unfiltered = ! explicitFilter && config.grep.toString() === '/.*/' && config.grepInvert === null;
		const originalProjects = suite.suites.filter(
			( project ) => project.project()?.name === 'chromium-originals',
		);
		if ( unfiltered && ( originalProjects.length > 0 || ! isSupplementalOnlyRun( process.argv ) ) ) {
			const titles = originalProjects.flatMap(
				( project ) => project.allTests().map( ( entry ) => entry.title ),
			);
			for ( const path of originalPaths ) {
				const registrations = titles.filter( ( title ) => title === path ).length;
				if ( registrations !== 1 ) {
					failures.push( `Expected one original case, found ${ String( registrations ) }: ${ path }` );
				}
			}
		}
		if ( failures.length > 0 ) {
			this.failed = true;
			process.stderr.write( `${ failures.join( '\n' ) }\n` );
		}
	}

	/**
	 * Keeps registration or integrity errors from appearing as a passing partial migration.
	 * @param result - Browser comparison result before completeness enforcement.
	 * @return Final visual gate result.
	 * @since 0.1.0
	 */
	onEnd( result: FullResult ): Promise<OriginalAuditResult> {
		return Promise.resolve( { status: this.failed ? 'failed' : result.status } );
	}
}
