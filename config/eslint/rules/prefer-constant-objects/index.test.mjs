import { Linter } from 'eslint';
import ts from 'typescript';
import { parser } from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import repositoryConfig from '../../../../eslint.config.js';

const declaration = `
interface Array<T> { [index: number]: T; length: number; }
export const Status = { READY: 'ready', FAILED: 'failed' } as const;
export type Status = typeof Status[keyof typeof Status];
declare const status: Status;
declare function accept(value: Status): void;
declare function expect<T>(value: T): { toBe(expected: unknown): void };
`;

/**
 * Runs the repository rule against a real TypeScript program without writing scratch files.
 * @param {string} code Valid or deliberately violating TypeScript fixture source.
 * @param {Record<string, string>} [dependencies] Virtual dependency declaration files.
 * @return {import('eslint').Linter.LintMessage[]} Actual diagnostics from the configured repository rule.
 */
function lint( code, dependencies = {} ) {
	const filename = `${ process.cwd() }/tocus-lint-fixture.tsx`;
	const files = new Map( [ [ filename, code ], ...Object.entries( dependencies ) ] );
	const options = { jsx: ts.JsxEmit.ReactJSX, strict: true, moduleResolution: ts.ModuleResolutionKind.Bundler };
	const host = ts.createCompilerHost( options );
	const readSource = host.getSourceFile;
	const fileExists = host.fileExists;
	host.fileExists = ( name ) => files.has( name ) || fileExists( name );
	host.getSourceFile = ( name, version ) => files.has( name )
		? ts.createSourceFile( name, files.get( name ), version, true, ts.ScriptKind.TSX )
		: readSource( name, version );
	const program = ts.createProgram( [ ...files.keys() ], options, host );
	const configured = repositoryConfig.find( ( config ) => config.plugins?.tocus );
	const plugins = configured?.plugins ?? {};
	const rules = configured?.rules ?? {};
	return new Linter().verify( code, {
		files: [ '**/*.tsx' ],
		languageOptions: { parser, parserOptions: { programs: [ program ], filePath: filename } },
		plugins,
		rules,
	}, { filename } );
}

describe( 'constant-object conventions', () => {
	it( 'rejects handwritten finite states, including nullable and numeric unions', () => {
		for ( const type of [ "'ready' | 'failed'", "'restore' | 'commit' | null", '0 | 1 | 2' ] ) {
			expect( lint( `type State = ${ type };` ) ).toEqual( [
				expect.objectContaining( { messageId: 'declaration', severity: 2 } ),
			] );
		}
	} );

	it( 'rejects raw domain values at typed assignments, calls and comparisons', () => {
		for ( const usage of [
			"const current: Status = 'ready';",
			"accept('ready');",
			"if (status === 'ready') { accept(status); }",
			"const result: { state: Status } = { state: 'failed' };",
			"const entries: Status[] = ['ready'];",
		] ) {
			expect( lint( declaration + usage ), usage ).toEqual( [
				expect.objectContaining( { messageId: 'reference', severity: 2 } ),
			] );
		}
	} );

	it( 'rejects raw enum values in matcher expectations and JSX props', () => {
		for ( const usage of [
			"expect(status).toBe('ready');",
			'declare function View(props: { status: Status }): any; const view = <View status="ready" />;',
		] ) {
			expect( lint( declaration + usage ), usage ).toEqual( [
				expect.objectContaining( { messageId: 'reference', severity: 2 } ),
			] );
		}
	} );

	it( 'recognizes constant-backed states when schema inference drops the alias name', () => {
		expect( lint( `${ declaration  }
type Inferred = { status: (typeof Status)[keyof typeof Status] };
declare const row: Inferred;
if (row.status === 'ready') { accept(row.status); }
` ) ).toEqual( [ expect.objectContaining( { messageId: 'reference', severity: 2 } ) ] );
	} );

	it( 'checks switch cases and nested test assertions against their actual domain types', () => {
		for ( const usage of [
			"switch (status) { case 'ready': break; }",
			"declare const row: { current: Status }; expect(row).toEqual({ current: 'ready' });",
		] ) {
			expect( lint( declaration + usage ), usage ).toEqual( [
				expect.objectContaining( { messageId: 'reference', severity: 2 } ),
			] );
		}
	} );

	it( 'does not substitute owned constants into matching third-party inline unions', () => {
		const dependency = `${ process.cwd() }/node_modules/review-upstream/index.d.ts`;
		expect( lint( `${ declaration  }
import { upstream } from 'review-upstream';
upstream('ready');
`, { [ dependency ]: "declare module 'review-upstream' { export function upstream(value: 'ready' | 'failed'): void; }" } ) ).toEqual( [] );
	} );

	it( 'checks templates and signed numeric states without relying on quote style', () => {
		for ( const usage of [ 'accept(`ready`);', 'const value: Status = `ready`;', 'if(status === `ready`) {}' ] ) {
			expect( lint( declaration + usage ), usage ).toEqual( [
				expect.objectContaining( { messageId: 'reference', severity: 2 } ),
			] );
		}
		expect( lint( `
const Position = { BEFORE: -1, AFTER: 1 } as const;
type Position = typeof Position[keyof typeof Position];
declare function move(value: Position): void;
move(-1);
` ) ).toEqual( [ expect.objectContaining( { messageId: 'reference', severity: 2 } ) ] );
		expect( lint( 'type Position = -1 | 1;' ) ).toEqual( [
			expect.objectContaining( { messageId: 'declaration', severity: 2 } ),
		] );
	} );

	it( 'preserves upstream property ownership but checks explicitly owned generic arguments', () => {
		const dependency = `${ process.cwd() }/node_modules/review-upstream/index.d.ts`;
		const dependencies = {
			[ dependency ]: `declare module 'review-upstream' {
export interface Options { status: 'ready' | 'failed' }
export function identity<T>(value: T): T;
}`,
		};
		expect( lint( `${ declaration }
import type { Options } from 'review-upstream';
const options: Options = { status: 'ready' };
declare const row: Options;
if(row.status === 'ready') {}
`, dependencies ) ).toEqual( [] );
		expect( lint( `${ declaration }
import { identity } from 'review-upstream';
identity<Status>('ready');
`, dependencies ) ).toEqual( [ expect.objectContaining( { messageId: 'reference', severity: 2 } ) ] );
	} );

	it( 'accepts inferred types, constant consumers, key selections and ordinary strings', () => {
		expect( lint( `${ declaration  }
const current: Status = Status.READY;
accept(Status.FAILED);
expect(status).toBe(Status.READY);
const label: string = 'ready';
type Keys = Pick<{ first: string; second: string }, 'first' | 'second'>;
interface Selected extends Pick<{ first: string; second: string }, 'first' | 'second'> {}
type Optional = string | null;
` ) ).toEqual( [] );
	} );

	it( 'keeps unknown protocol data available for validation tests', () => {
		expect( lint( `${ declaration  }
declare function validate(value: unknown): boolean;
validate('invalid-state');
validate('ready');
` ) ).toEqual( [] );
	} );
} );
