/**
 * Configures CSS and SCSS quality rules for authored styles.
 * @since <version> Initial implementation.
 */
export default {
	extends: [ 'stylelint-config-standard-scss' ],
	ignoreFiles: [ '**/node_modules/**', '**/dist/**', '**/.output/**', '**/coverage/**' ],
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
