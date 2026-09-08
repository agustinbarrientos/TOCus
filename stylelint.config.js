/**
 * Configures CSS and SCSS quality rules for authored styles.
 * @since 0.1.0 Initial implementation.
 */
export default {
	extends: [ 'stylelint-config-standard-scss' ],
	ignoreFiles: [ '**/node_modules/**', '**/dist/**', '**/.output/**', '**/coverage/**' ],
	overrides: [
		{
			files: [ 'packages/ui/src/**/*.{css,scss}' ],
			rules: {
				// Mantine exposes these component-local variables through its public Button and Slider Styles APIs.
				'custom-property-pattern': '^(tocus-|mantine-|button-(bg|color|bd)$|slider-(bar-width|size)$)',
				'selector-class-pattern': '^(tocus-[a-z0-9-]+|mantine-[A-Za-z0-9-]+)$',
			},
		},
		{
			files: [ 'apps/*/src/**/*.{css,scss}' ],
			rules: {
				// Layout may consume library sizing tokens; only the shared UI package may redefine them.
				'custom-property-pattern': '^(tocus-|mantine-|slider-size$)',
				'property-disallowed-list': [
					'/^--(?!tocus-)/',
					'font-family',
					'font-size',
					'font-weight',
					'letter-spacing',
					'line-height',
				],
			},
		},
	],
	rules: {
		'custom-property-pattern': [
			'^tocus-',
			{ message: 'Expected custom properties to use the "--tocus-" namespace.' },
		],
		'custom-property-empty-line-before': null,
		'number-max-precision': 6,
		'value-keyword-case': [ 'lower', { ignoreKeywords: [ 'BlinkMacSystemFont' ] } ],
	},
};
