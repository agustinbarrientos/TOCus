import { Button, Input, colorsTuple, createTheme, type CSSVariablesResolver, type VariantColorsResolver } from '@mantine/core';
import { createElement, Fragment } from 'react';

/**
 * Resolve semantic variants against the active scoped palette.
 * @since 0.1.0
 * @param root0 - Mantine variant request.
 * @param root0.color - Semantic color name.
 * @param root0.variant - Packaged component variant.
 * @return Accessible surface, foreground and border colors.
 */
export const resolveTocusVariant: VariantColorsResolver = ( { color, variant } ) => {
	const danger = color === 'red';
	const surface = color === 'green' || color === 'teal' ? 'success' : danger ? 'error'
		: color === 'yellow' || color === 'orange' ? 'warning' : 'info';
	if ( variant === 'light' ) {
		return {
			background: `var(--tocus-color-${ surface }-surface)`,
			hover: `var(--tocus-color-${ surface }-surface)`,
			color: `var(--tocus-color-on-${ surface })`,
			border: `1px solid var(--tocus-color-${ surface }-border, ${ danger
				? 'var(--tocus-color-danger)' : 'var(--tocus-color-divider)' })`,
		};
	}
	if ( variant === 'outline' || variant === 'default' || variant === 'subtle' || variant === 'transparent' ) {
		const transparent = variant === 'subtle' || variant === 'transparent';
		return {
			background: transparent || variant === 'outline' ? 'transparent' : 'var(--tocus-color-surface)',
			hover: 'var(--tocus-color-surface-container)',
			color: danger ? 'var(--tocus-color-danger)' : variant === 'outline'
				? 'var(--tocus-color-action)' : 'var(--tocus-color-on-surface)',
			border: transparent ? '1px solid transparent' : variant === 'outline'
				? '1px solid var(--tocus-color-action)' : '1px solid var(--tocus-color-divider)',
		};
	}
	return {
		background: danger ? 'var(--tocus-color-danger)' : 'var(--tocus-color-action)',
		hover: danger ? 'var(--tocus-color-danger-hover)'
			: 'color-mix(in srgb, var(--tocus-color-action) 88%, var(--tocus-color-on-surface))',
		color: danger ? 'var(--tocus-color-on-danger)' : 'var(--tocus-color-on-action)',
		border: `1px solid var(--tocus-color-${ danger ? 'danger' : 'action' })`,
	};
};

/**
 * Palette mappings shared by both color schemes.
 * @since 0.1.0
 * @return Variables resolved in each provider's owned root.
 */
export const tocusCssVariables: CSSVariablesResolver = () => {
	const semantic = {
		'--mantine-color-text': 'var(--tocus-color-on-surface)',
		'--mantine-color-body': 'var(--tocus-color-surface)',
		'--mantine-color-bright': 'var(--tocus-color-on-surface)',
		'--mantine-color-dimmed': 'var(--tocus-color-on-surface-muted)',
		'--mantine-color-placeholder': 'var(--tocus-color-on-surface-muted)',
		'--mantine-color-default': 'var(--tocus-color-surface)',
		'--mantine-color-default-hover': 'var(--tocus-color-surface-container)',
		'--mantine-color-default-color': 'var(--tocus-color-on-surface)',
		'--mantine-color-default-border': 'var(--tocus-color-divider)',
		'--mantine-color-disabled': 'var(--tocus-color-surface-container)',
		'--mantine-color-disabled-color': 'var(--tocus-color-on-surface-muted)',
		'--mantine-color-disabled-border': 'var(--tocus-color-divider)',
		'--mantine-color-anchor': 'var(--tocus-color-action)',
		'--mantine-color-error': 'var(--tocus-color-on-error)',
		'--mantine-primary-color-contrast': 'var(--tocus-color-on-action)',
	};
	return { variables: {}, light: semantic, dark: semantic };
};

/**
 * Shared packaged-control theme; application copy and layout stay with consumers.
 * @since 0.1.0
 */
export const tocusTheme = createTheme( {
	fontFamily: 'var(--tocus-font-family-body)',
	headings: {
		fontFamily: 'var(--tocus-font-family-brand)', fontWeight: '600',
		sizes: {
			h1: { fontSize: 'var(--tocus-typography-headline-large-font-size)',
				lineHeight: 'var(--tocus-typography-headline-large-line-height)' },
		},
	},
	defaultRadius: 'md',
	cursorType: 'pointer',
	respectReducedMotion: true,
	focusClassName: 'tocus-focus',
	primaryColor: 'tocus',
	colors: { tocus: colorsTuple( 'var(--tocus-color-action)' ) },
	variantColorResolver: resolveTocusVariant,
	components: {
		Anchor: { defaultProps: { underline: 'always' } },
		NavLink: { defaultProps: { variant: 'filled' }, styles: { root: { minHeight: '3rem' } } },
		Button: { ...Button.extend( {
			/**
			 * Retains original default geometry without changing explicit packaged size requests.
			 * @param _theme - Active packaged theme.
			 * @param props - Consumer control properties.
			 * @return Original default action dimensions and typography.
			 */
			styles: ( _theme, props ) => ( { root: {
				fontWeight: 500,
				'--tocus-button-hover-border': props.color === 'red'
					? 'var(--tocus-color-danger-hover)' : 'var(--tocus-color-action)',
				height: props.size === undefined || props.size === 'sm' ? 'var(--tocus-action-height, 2.75rem)' : undefined,
			} } ),
		} ), defaultProps: { variant: 'filled', tabIndex: 0, radius: 'var(--tocus-radius-full)', px: '1.5rem' } },
		CloseButton: { defaultProps: { tabIndex: 0 } },
		Alert: { defaultProps: { variant: 'light' }, styles: {
			root: { borderWidth: '0 0 0 4px', borderRadius: 0, padding: '1rem' },
			message: { color: 'inherit' },
			icon: { width: '1.25em', height: '1.25em',
				marginInlineEnd: 'var(--tocus-notice-icon-gap, 0.75rem)',
				marginTop: '0.125em', justifyContent: 'center' },
		} },
		Checkbox: { defaultProps: { iconColor: 'var(--tocus-color-on-action)' } },
		Radio: { defaultProps: { iconColor: 'var(--tocus-color-on-action)' } },
		NativeSelect: { defaultProps: { rightSection: createElement( Fragment ) }, styles: {
			input: { appearance: 'auto', paddingInline: '1rem' },
		} },
		Input: Input.extend( {
			/**
			 * Maps native range surfaces without changing Mantine's wrapper positioning contract.
			 * @param _theme - Active packaged theme.
			 * @param props - Public native input properties forwarded by the polymorphic component.
			 * @return Semantic field colors for regular inputs and native ranges.
			 */
			styles: ( _theme, props ) => {
				const nativeRange = 'type' in props && props.type === 'range';
				return {
					input: {
						backgroundColor: nativeRange ? 'transparent' : 'var(--tocus-color-surface)',
						color: nativeRange ? 'var(--tocus-color-action)' : 'var(--tocus-color-on-surface)',
						borderColor: 'var(--tocus-color-divider)',
					},
				};
			},
		} ),
		Slider: {
			styles: {
				track: { backgroundColor: 'var(--tocus-color-surface-container)' },
				thumb: {
					width: '1.5rem', height: '1.5rem', borderWidth: 2,
					backgroundColor: 'var(--tocus-color-surface-lowest)',
					borderColor: 'var(--tocus-color-action)',
					boxShadow: '0 1px 3px color-mix(in srgb, var(--tocus-color-shadow-depth) 30%, transparent)',
				},
			},
		},
		Modal: {
			styles: {
				content: { backgroundColor: 'var(--tocus-color-surface)' },
				header: { backgroundColor: 'var(--tocus-color-surface)' },
			},
		},
		Divider: { styles: { root: { borderColor: 'var(--tocus-color-divider)' } } },
	},
} );
