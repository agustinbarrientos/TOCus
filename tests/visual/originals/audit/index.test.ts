import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import type { FullConfig, FullResult, Suite, TestCase } from '@playwright/test/reporter';
import inventory from '../inventory.json' with { type: 'json' };
import OriginalSnapshotAudit from './index';

vi.mock( 'node:fs', async ( importOriginal ) => {
	const actual = await importOriginal<typeof import( 'node:fs' )>();
	return { ...actual, readFileSync: vi.fn( actual.readFileSync ) };
} );

const originalArguments = process.argv;
const originalTitles = inventory.map( ( entry ) => entry.path );

/**
 * Models the public project-suite reporter boundary without starting a browser runner.
 * @param name - Discovered project name.
 * @param titles - Cases registered beneath that project.
 * @return Project suite exposing the metadata consumed by the audit.
 */
function projectSuite( name: string, titles: readonly string[] ): Suite {
	return {
		/** @return The discovered project identity exposed to reporters. */
		project: () => ( { name } ),
		/** @return Registered titles exposed through the public suite boundary. */
		allTests: () => titles.map( ( title ) => ( { title } ) as TestCase ),
	} as Suite;
}

/**
 * Runs the actual reporter against controlled discovery and CLI inputs, reading real original files.
 * @param projects - Discovered project suites.
 * @param arguments_ - Explicit Playwright command-line arguments.
 * @param grep - Resolved positive test-name filter.
 * @param grepInvert - Resolved negative test-name filter.
 * @return Final acceptance status for an otherwise successful screenshot run.
 */
async function audit(
	projects: Suite[], arguments_: string[] = [], grep = /.*/, grepInvert: RegExp | null = null,
): Promise<FullResult['status']> {
	process.argv = [ 'node', 'playwright', 'test', ...arguments_ ];
	const reporter = new OriginalSnapshotAudit();
	reporter.onBegin( { grep, grepInvert } as FullConfig, {
		suites: projects,
		/** @return All registered cases, including supplemental projects. */
		allTests: () => projects.flatMap( ( project ) => project.allTests() ),
	} as Suite );
	return ( await reporter.onEnd( { status: 'passed', startTime: new Date( 0 ), duration: 0 } ) ).status;
}

beforeEach( () => {
	vi.spyOn( process.stderr, 'write' ).mockImplementation( () => true );
} );
afterEach( () => {
	process.argv = originalArguments;
	vi.restoreAllMocks();
} );

describe( 'immutable original screenshot audit', () => {
	it( 'accepts exactly one registration per original alongside supplemental tests', async () => {
		expect( await audit( [
			projectSuite( 'chromium-originals', originalTitles ),
			projectSuite( 'chromium-onboarding', [ 'Onboarding regional flow spanish-vos' ] ),
		] ) ).toBe( 'passed' );
	} );

	it( 'fails an unfiltered run when the original project is absent from discovery', async () => {
		expect( await audit( [ projectSuite( 'chromium-onboarding', [ 'Regional flow' ] ) ] ) ).toBe( 'failed' );
	} );

	it( 'fails an unfiltered run when no cases are discovered', async () => {
		expect( await audit( [] ) ).toBe( 'failed' );
	} );

	it( 'fails when the original project exists but registers no original cases', async () => {
		expect( await audit( [ projectSuite( 'chromium-originals', [] ) ] ) ).toBe( 'failed' );
	} );

	it( 'does not let supplemental titles fill missing original registrations', async () => {
		expect( await audit( [
			projectSuite( 'chromium-originals', originalTitles.slice( 1 ) ),
			projectSuite( 'chromium-onboarding', originalTitles.slice( 0, 1 ) ),
		] ) ).toBe( 'failed' );
	} );

	it( 'ignores matching supplemental titles when counting complete original registrations', async () => {
		expect( await audit( [
			projectSuite( 'chromium-originals', originalTitles ),
			projectSuite( 'chromium-onboarding', originalTitles.slice( 0, 1 ) ),
		] ) ).toBe( 'passed' );
	} );

	it( 'rejects duplicate registrations within the original project', async () => {
		expect( await audit( [
			projectSuite( 'chromium-originals', [ ...originalTitles, ...originalTitles.slice( 0, 1 ) ] ),
		] ) ).toBe( 'failed' );
	} );

	it.each( [
		[ '--project', 'chromium-onboarding' ],
		[ '--project=chromium-onboarding' ],
		[ '--project', 'chromium-website' ],
		[ '--project=chromium-website' ],
		[ '--project', 'chromium-onboarding', 'chromium-website' ],
		[ '--project=chromium-onboarding', 'chromium-website' ],
		[ '--project', 'chromium-onboarding', '--project=chromium-website' ],
	] )( 'allows an explicitly selected supplemental-only run: %j', async ( ...arguments_ ) => {
		expect( await audit( [ projectSuite( 'chromium-onboarding', [ 'Regional flow' ] ) ], arguments_ ) ).toBe( 'passed' );
	} );

	it.each( [
		[ '--project', 'chromium-originals' ],
		[ '--project=chromium-originals' ],
		[ '--project', 'chromium-onboarding', 'chromium-originals' ],
		[ '--project=chromium-onboarding', 'chromium-originals' ],
		[ '--project', 'chromium-onboarding', '--project=chromium-originals' ],
		[ '--project', 'chromium-*' ],
		[ '--project=chromium-unknown' ],
		[ '--project', 'chromium-onboarding', '--project=chromium-unknown' ],
		[ '--project' ],
		[ '--project', 'chromium-onboarding', '--project' ],
		[ '--project', '--project=chromium-onboarding' ],
		[ '--', '--project=chromium-onboarding' ],
		[ 'chromium-onboarding' ],
	] )( 'does not exempt missing originals for other selections: %j', async ( ...arguments_ ) => {
		expect( await audit( [ projectSuite( 'chromium-onboarding', [ 'Regional flow' ] ) ], arguments_ ) ).toBe( 'failed' );
	} );

	it( 'still requires completeness if an original project is discovered during a supplemental selection', async () => {
		expect( await audit( [ projectSuite( 'chromium-originals', originalTitles.slice( 1 ) ) ],
			[ '--project', 'chromium-onboarding' ] ) ).toBe( 'failed' );
	} );

	it( 'permits explicit case investigation without claiming full registration', async () => {
		expect( await audit( [ projectSuite( 'chromium-originals', originalTitles.slice( 0, 1 ) ) ],
			[ '--project', 'chromium-originals', '--grep', 'one-case' ],
			/one-case/ ) ).toBe( 'passed' );
	} );

	it.each( [ 'supplemental selection', 'grep investigation' ] )( 'rejects changed original bytes during %s', async ( scope ) => {
		vi.mocked( fs.readFileSync ).mockReturnValueOnce( Buffer.from( 'changed original bytes' ) );
		const arguments_ = scope === 'supplemental selection'
			? [ '--project', 'chromium-onboarding' ] : [ '--grep', 'one-case' ];
		expect( await audit( [ projectSuite( 'chromium-onboarding', [ 'Regional flow' ] ) ], arguments_ ) ).toBe( 'failed' );
	} );

	it( 'rejects an unreadable original during a supplemental-only run', async () => {
		vi.mocked( fs.readFileSync ).mockImplementationOnce( () => {
			throw new Error( 'Original is unreadable' );
		} );
		expect( await audit( [ projectSuite( 'chromium-onboarding', [ 'Regional flow' ] ) ],
			[ '--project', 'chromium-onboarding' ] ) ).toBe( 'failed' );
	} );

	it( 'preserves an existing browser failure when audit checks have not failed', async () => {
		const reporter = new OriginalSnapshotAudit();
		expect( await reporter.onEnd( { status: 'failed', startTime: new Date( 0 ), duration: 0 } ) ).toEqual( { status: 'failed' } );
	} );
} );
