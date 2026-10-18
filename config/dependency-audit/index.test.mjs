import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateAuditException } from './index.mjs';

const advisory = 'GHSA-vfj7-8cjw-p6xm';
const expiry = new Date( '2026-10-31T05:00:00.000Z' );
const beforeExpiry = new Date( '2026-10-31T04:59:59.999Z' );
const settings = { ignore: [ advisory ] };
const productionGraph = [ { name: 'tocus', path: '/fixture' } ];
const cliPath = fileURLToPath( new URL( './index.mjs', import.meta.url ) );

/**
 * Creates a complete pnpm dependency record without deriving the security expectation.
 * @param {string} from - Canonical package source or npm alias.
 * @param {object} [overrides] - Metadata or child dependency maps specific to the fixture.
 * @return {object} Dependency record with all metadata required for production evidence.
 */
function dependency( from, overrides = {} ) {
	return { from, version: '1.0.0', path: `/fixture/node_modules/${ from }`, ...overrides };
}

it( 'allows the approved advisory through the last millisecond of its review period', () => {
	expect( () => validateAuditException( settings, productionGraph, beforeExpiry ) ).not.toThrow();
} );

it.each( [ expiry, new Date( '2026-11-01T00:00:00.000Z' ), new Date( NaN ) ] )(
	'rejects an expired exception or invalid current date: %s', ( now ) => {
		expect( () => validateAuditException( settings, productionGraph, now ) ).toThrow( Error );
	},
);

it( 'rejects missing or malformed pnpm audit settings', () => {
	for ( const candidate of [
		undefined, null, {}, { auditConfig: { ignoreGhsas: [ advisory ] } }, { ignore: advisory },
	] ) {
		expect( () => validateAuditException( candidate, productionGraph, beforeExpiry ) ).toThrow( Error );
	}
} );

it( 'accepts only the single approved advisory without additional exceptions or duplicates', () => {
	for ( const ignore of [ [], [ 'GHSA-xxxx-yyyy-zzzz' ], [ advisory, 'GHSA-xxxx-yyyy-zzzz' ], [ advisory, advisory ], [ 'CVE-2026-99999' ] ] ) {
		expect( () => validateAuditException( { ignore }, productionGraph, beforeExpiry ) ).toThrow( Error );
	}
} );

it( 'rejects empty, malformed or incomplete production evidence', () => {
	for ( const graph of [
		undefined, null, {}, [], [ {} ], [ null ],
		[ { ...productionGraph[ 0 ], dependencies: [] } ],
		[ { ...productionGraph[ 0 ], dependencies: { tool: null } } ],
		[ { ...productionGraph[ 0 ], dependencies: { tool: {} } } ],
	] ) {
		expect( () => validateAuditException( settings, graph, beforeExpiry ) ).toThrow( Error );
	}
} );

it( 'rejects dependency records with missing, empty or non-string identifying metadata', () => {
	for ( const field of [ 'from', 'version', 'path' ] ) {
		for ( const value of [ undefined, '', ' ', 42 ] ) {
			const graph = [ { ...productionGraph[ 0 ], dependencies: {
				tool: dependency( 'tool', { [ field ]: value } ),
			} } ];
			expect( () => validateAuditException( settings, graph, beforeExpiry ), `${ field }: ${ String( value ) }` )
				.toThrow( Error );
		}
	}
} );

it( 'rejects project rows without nonempty names and absolute paths', () => {
	for ( const row of [
		{ name: '', path: '/fixture' }, { name: ' ', path: '/fixture' }, { name: 42, path: '/fixture' },
		{ name: 'tocus', path: '' }, { name: 'tocus', path: ' ' }, { name: 'tocus', path: 'relative/project' },
	] ) {
		expect( () => validateAuditException( settings, [ row ], beforeExpiry ) ).toThrow( Error );
	}
} );

it( 'rejects relative dependency paths instead of treating them as complete lockfile evidence', () => {
	const graph = [ { ...productionGraph[ 0 ], dependencies: {
		tool: dependency( 'tool', { path: 'node_modules/tool' } ),
	} } ];
	expect( () => validateAuditException( settings, graph, beforeExpiry ) ).toThrow( Error );
} );

it.each( [
	[ 'dependency key', { braces: dependency( 'pattern-parser' ) } ],
	[ 'canonical package name', { alias: dependency( 'pattern-parser', { name: 'braces', version: '3.0.3' } ) } ],
	[ 'canonical package source', { alias: dependency( 'braces', { version: '3.0.3' } ) } ],
	[ 'version-qualified package source', { alias: dependency( 'braces@3.0.3', { version: '3.0.3' } ) } ],
	[ 'npm alias source', { alias: dependency( 'npm:braces@3.0.3', { version: '3.0.3' } ) } ],
	[ 'npm alias version', { alias: dependency( 'alias', { version: 'npm:braces@3.0.3' } ) } ],
	[ 'nested dependency', { tool: dependency( 'tool', {
		dependencies: { braces: dependency( 'braces', { version: '3.0.3' } ) },
	} ) } ],
	[ 'nested optional dependency', { tool: dependency( 'tool', {
		optionalDependencies: { braces: dependency( 'braces', { version: '3.0.3' } ) },
	} ) } ],
	[ 'workspace dependency', { '@tocus/ui': dependency( '@tocus/ui', {
		version: 'link:packages/ui', path: '/fixture/packages/ui',
		dependencies: { braces: dependency( 'braces', { version: '3.0.3' } ) },
	} ) } ],
] )( 'rejects braces in the production graph via its %s', ( _label, dependencies ) => {
	const graph = [ { ...productionGraph[ 0 ], dependencies } ];
	expect( () => validateAuditException( settings, graph, beforeExpiry ) )
		.toThrow( /Braces appears in production dependencies/u );
} );

it( 'checks optional dependencies and every workspace row', () => {
	const graph = [
		productionGraph[ 0 ],
		{ name: '@tocus/ui', path: '/fixture/packages/ui', optionalDependencies: {
			braces: dependency( 'braces', { version: '3.0.3' } ),
		} },
	];
	expect( () => validateAuditException( settings, graph, beforeExpiry ) )
		.toThrow( /Braces appears in production dependencies/u );
} );

it( 'allows unrelated production packages whose names resemble braces', () => {
	const graph = [ { ...productionGraph[ 0 ], dependencies: {
		'brace-expansion': dependency( 'brace-expansion', { version: '2.0.2' } ),
		'braces-helper': dependency( 'braces-helper' ),
	} } ];
	expect( () => validateAuditException( settings, graph, beforeExpiry ) ).not.toThrow();
} );

it( 'accepts complete non-braces production records across nested, workspace, optional and alias paths', () => {
	const graph = [
		{ ...productionGraph[ 0 ], dependencies: {
			'@tocus/ui': dependency( '@tocus/ui', { version: 'link:packages/ui', path: '/fixture/packages/ui' } ),
			tool: dependency( 'tool', { dependencies: { runtime: dependency( 'runtime' ) } } ),
			alias: dependency( 'brace-expansion', { version: 'npm:brace-expansion@2.0.2' } ),
		} },
		{ name: '@tocus/ui', path: '/fixture/packages/ui', optionalDependencies: {
			'native-addon': dependency( 'native-addon' ),
		} },
	];
	expect( () => validateAuditException( settings, graph, beforeExpiry ) ).not.toThrow();
} );

/**
 * Executes the real audit entrypoint against a disposable pnpm executable with controlled output.
 * @param {object} scenario - Command output and exit conditions supplied to pnpm.
 * @return {object} Actual Node process output and termination status.
 */
function runAuditCli( scenario = {} ) {
	const directory = mkdtempSync( join( tmpdir(), 'tocus-dependency-audit-' ) );
	try {
		const executable = join( directory, 'pnpm' );
		writeFileSync( executable, `#!/usr/bin/env node
const scenario = JSON.parse(process.env.TOCUS_AUDIT_TEST_SCENARIO);
const args = process.argv.slice(2);
const command = args[0];
if (command === 'config') {
  if (args[1] !== 'get' || args[2] !== 'audit' || !args.includes('--json')) process.exit(98);
  process.stdout.write(scenario.settingsRaw ?? JSON.stringify(scenario.settings));
  process.exit(scenario.configStatus ?? 0);
}
if (command === 'list') {
  if (!args.some(arg => arg === '-r' || arg === '--recursive') ||
      !['--prod', '--lockfile-only', '--json'].every(arg => args.includes(arg)) ||
      args[args.indexOf('--depth') + 1] !== 'Infinity') process.exit(98);
  process.stdout.write(scenario.graphRaw ?? JSON.stringify(scenario.graph));
  process.exit(scenario.listStatus ?? 0);
}
if (command === 'audit') {
  if (!['--audit-level=high', '--ignore-registry-errors'].every(arg => args.includes(arg))) process.exit(98);
  process.stdout.write(scenario.auditOutput);
  if (scenario.auditSignal) process.kill(process.pid, 'SIGTERM');
  else process.exit(scenario.auditStatus ?? 0);
} else {
  process.stderr.write('Unexpected pnpm command: ' + JSON.stringify(args));
  process.exit(99);
}
` );
		chmodSync( executable, 0o755 );
		const result = spawnSync( process.execPath, [ cliPath ], {
			encoding: 'utf8',
			timeout: 5_000,
			maxBuffer: 1024 * 1024,
			env: {
				...process.env,
				PATH: directory + delimiter + process.env.PATH,
				TOCUS_AUDIT_TEST_SCENARIO: JSON.stringify( {
					settings,
					graph: productionGraph,
					auditOutput: `1 ignored vulnerability: ${ advisory }\n`,
					...scenario,
				} ),
			},
		} );
		return result;
	} finally {
		rmSync( directory, { recursive: true, force: true } );
	}
}

// Successful CLI fixtures are meaningful only before midnight in America/Bogota on the review date.
describe.skipIf( Date.now() >= expiry.getTime() )( 'audit CLI before the 2026-10-31 America/Bogota review deadline', () => {
	it( 'checks the complete production lockfile graph and preserves the native ignored-advisory output', () => {
		const result = runAuditCli();
		expect( result.error ).toBeUndefined();
		expect( result.status, result.stdout + result.stderr ).toBe( 0 );
		expect( result.stdout ).toContain( `1 ignored vulnerability: ${ advisory }` );
	} );

	it( 'fails for another high-severity advisory and preserves its audit output', () => {
		const result = runAuditCli( { auditStatus: 1, auditOutput: '1 high vulnerability: GHSA-xxxx-yyyy-zzzz\n' } );
		expect( result.error ).toBeUndefined();
		expect( result.status ).not.toBe( 0 );
		expect( result.stdout ).toContain( '1 high vulnerability: GHSA-xxxx-yyyy-zzzz' );
	} );

	it( 'fails closed on missing, malformed or rejected production evidence', () => {
		for ( const scenario of [
			[ 'failed configuration read', { configStatus: 1 } ],
			[ 'invalid configuration JSON', { settingsRaw: 'not-json' } ],
			[ 'failed production listing', { listStatus: 1 } ],
			[ 'invalid production JSON', { graphRaw: 'not-json' } ],
			[ 'missing production projects', { graph: [] } ],
			[ 'braces in production', { graph: [ { ...productionGraph[ 0 ], dependencies: { braces: dependency( 'braces', { version: '3.0.3' } ) } } ] } ],
			[ 'missing production dependency metadata', { graph: [ { ...productionGraph[ 0 ], dependencies: { tool: {} } } ] } ],
		] ) {
			const result = runAuditCli( scenario[ 1 ] );
			expect( result.error, scenario[ 0 ] ).toBeUndefined();
			expect( result.status, scenario[ 0 ] ).not.toBe( 0 );
			expect( result.stdout, scenario[ 0 ] ).not.toContain( '1 ignored vulnerability' );
		}
	} );

	it( 'fails when pnpm audit terminates on a signal', () => {
		const result = runAuditCli( { auditSignal: true } );
		expect( result.error ).toBeUndefined();
		expect( result.stdout ).toContain( '1 ignored vulnerability' );
		expect( result.status ).not.toBe( 0 );
	} );
} );
