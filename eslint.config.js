import eslint from '@eslint/js';
import astro from 'eslint-plugin-astro';
import jsdoc from 'eslint-plugin-jsdoc';
import lit from 'eslint-plugin-lit';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const javascriptFiles = [ '**/*.{js,mjs,cjs}' ];
const typescriptFiles = [ '**/*.{ts,tsx}' ];
const sourceFiles = [ ...javascriptFiles, ...typescriptFiles ];
const testFiles = [
	'**/*.{test,wtr.test}.{js,mjs,cjs,ts,tsx}',
	'**/__fixtures__/**/*.{js,mjs,cjs,ts,tsx}',
];
const exportedDeclarations = [ 'ExportDefaultDeclaration', 'ExportNamedDeclaration[declaration]' ];
const documentedDeclarations = [
	...exportedDeclarations,
	'TSInterfaceDeclaration:not(ExportNamedDeclaration > TSInterfaceDeclaration)',
	'TSTypeAliasDeclaration:not(ExportNamedDeclaration > TSTypeAliasDeclaration)',
	'VariableDeclaration:not(ExportNamedDeclaration > VariableDeclaration):has(VariableDeclarator[id.type="Identifier"][id.name=/Schema$/])',
	'VariableDeclaration:not(ExportNamedDeclaration > VariableDeclaration):has(VariableDeclarator[init.type="ArrowFunctionExpression"])',
	'VariableDeclaration:not(ExportNamedDeclaration > VariableDeclaration):has(VariableDeclarator[init.type="FunctionExpression"])',
	'FunctionExpression[id]',
	'Property[value.type="ArrowFunctionExpression"]',
	'Property[value.type="FunctionExpression"]',
];
const componentClass = 'ExportNamedDeclaration[declaration.type="ClassDeclaration"]';
const typedConfigs = tseslint.configs.strictTypeChecked.map( ( config ) => ( {
	...config,
	files: typescriptFiles,
	languageOptions: {
		...config.languageOptions,
		parserOptions: {
			...config.languageOptions?.parserOptions,
			projectService: true,
			tsconfigRootDir: import.meta.dirname,
		},
	},
} ) );

/**
 * Defines the repository's JavaScript, TypeScript, documentation, Lit, and Astro linting contract.
 * @since 0.1.0 Initial implementation.
 */
export default tseslint.config(
	{
		ignores: [
			'.superpowers/**',
			'**/node_modules/**',
			'**/.turbo/**',
			'**/.wxt/**',
			'**/.astro/**',
			'**/.output/**',
			'**/dist/**',
			'**/coverage/**',
			'**/playwright-report/**',
			'**/test-results/**',
		],
	},
	eslint.configs.recommended,
	{
		files: javascriptFiles,
		languageOptions: { globals: globals.node },
	},
	{
		files: sourceFiles,
		rules: {
			'array-bracket-spacing': [ 'error', 'always' ],
			'arrow-spacing': [ 'error', { after: true, before: true } ],
			'brace-style': [ 'error', '1tbs', { allowSingleLine: false } ],
			'comma-spacing': [ 'error', { after: true, before: false } ],
			'computed-property-spacing': [ 'error', 'always' ],
			'curly': 'error',
			'function-call-argument-newline': [ 'error', 'consistent' ],
			'func-call-spacing': [ 'error', 'never' ],
			'indent': [ 'error', 'tab', { SwitchCase: 1, ignoredNodes: [ 'TemplateLiteral *' ] } ],
			'key-spacing': [ 'error', { afterColon: true, beforeColon: false } ],
			'keyword-spacing': [ 'error', { after: true, before: true } ],
			'lines-between-class-members': [ 'error', 'always' ],
			'max-len': [
				'error',
				{
					code: 120,
					ignoreComments: true,
					ignoreStrings: true,
					ignoreTemplateLiterals: true,
					ignoreUrls: true,
					tabWidth: 4,
				},
			],
			'no-empty-function': 'error',
			'no-mixed-spaces-and-tabs': [ 'error', 'smart-tabs' ],
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: [ '@', '@/*', '~', '~/*', '@@', '@@/*', '~~', '~~/*' ],
							message: 'Use an explicit @tocus package namespace for non-relative imports.',
						},
					],
				},
			],
			'no-trailing-spaces': 'error',
			'object-curly-spacing': [ 'error', 'always' ],
			'prefer-template': 'error',
			'quotes': [ 'error', 'single', { avoidEscape: true } ],
			'semi': [ 'error', 'always' ],
			'space-before-blocks': [ 'error', 'always' ],
			'space-before-function-paren': [ 'error', { anonymous: 'never', asyncArrow: 'always', named: 'never' } ],
			'space-in-parens': [ 'error', 'always' ],
			'space-unary-ops': [
				'error',
				{ nonwords: true, overrides: { '+': false, '++': false, '-': false, '--': false }, words: true },
			],
			'spaced-comment': [ 'error', 'always' ],
			'template-curly-spacing': [ 'error', 'always' ],
			'yoda': [ 'error', 'never' ],
		},
	},
	{
		...jsdoc.configs[ 'flat/recommended-error' ],
		files: javascriptFiles,
		rules: {
			...jsdoc.configs[ 'flat/recommended-error' ].rules,
			'jsdoc/check-tag-names': [
				'error',
				{
					definedTags: [ 'attr', 'csspart', 'cssprop', 'element', 'fires', 'remarks', 'since', 'slot', 'summary' ],
				},
			],
			'jsdoc/check-values': 'off',
			'jsdoc/require-jsdoc': 'off',
		},
		settings: {
			jsdoc: {
				mode: 'typescript',
				tagNamePreference: {
					param: 'param',
					returns: 'return',
				},
			},
		},
	},
	...typedConfigs,
	{
		files: typescriptFiles,
		ignores: testFiles,
		rules: {
			'@typescript-eslint/consistent-type-assertions': [ 'error', { assertionStyle: 'never' } ],
			'@typescript-eslint/consistent-type-imports': [ 'error', { fixStyle: 'inline-type-imports' } ],
			'no-restricted-syntax': [
				'error',
				{
					message: 'Define structured contracts in a canonical domain type file or executable leaf types.ts.',
					selector: 'TSTypeLiteral',
				},
			],
		},
	},
	{
		...jsdoc.configs[ 'flat/recommended-typescript-error' ],
		files: typescriptFiles,
		rules: {
			...jsdoc.configs[ 'flat/recommended-typescript-error' ].rules,
			'jsdoc/check-tag-names': [
				'error',
				{
					definedTags: [ 'attr', 'csspart', 'cssprop', 'element', 'fires', 'remarks', 'since', 'slot', 'summary' ],
					typed: true,
				},
			],
			'jsdoc/check-values': 'off',
			'jsdoc/require-jsdoc': 'off',
		},
		settings: {
			jsdoc: {
				mode: 'typescript',
				tagNamePreference: {
					param: 'param',
					returns: 'return',
				},
			},
		},
	},
	{
		files: sourceFiles,
		plugins: { jsdoc },
		rules: {
			'jsdoc/require-jsdoc': [
				'error',
				{
					contexts: documentedDeclarations,
					require: {
						ClassDeclaration: true,
						ClassExpression: true,
						FunctionDeclaration: true,
						MethodDefinition: true,
					},
				},
			],
		},
	},
	{
		files: sourceFiles,
		ignores: testFiles,
		plugins: { jsdoc },
		rules: {
			'jsdoc/require-tags': [
				'error',
				{
					tags: exportedDeclarations.map( ( context ) => ( {
						context,
						tag: 'since',
					} ) ),
				},
			],
		},
	},
	{
		...lit.configs[ 'flat/recommended' ],
		files: [ 'apps/extension/src/**/*.ts' ],
	},
	{
		files: [ 'apps/extension/src/**/components/**/index.ts' ],
		rules: {
			'jsdoc/require-tags': [
				'error',
				{
					tags: [
						...exportedDeclarations.map( ( context ) => ( {
							context,
							tag: 'since',
						} ) ),
						{ context: componentClass, tag: 'element' },
						{ context: componentClass, tag: 'summary' },
						{ context: 'MethodDefinition', tag: 'since' },
					],
				},
			],
		},
	},
	...astro.configs[ 'flat/recommended' ],
);
