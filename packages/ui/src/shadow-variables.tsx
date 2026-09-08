import { convertCssVariables, defaultCssVariablesResolver, useMantineTheme } from '@mantine/core';
import { useLayoutEffect } from 'react';
import { tocusCssVariables } from './theme';
import { createShadowStyleSheet, observeShadowInlineLengths } from './shadow-styles';
import { TocusAppearance, type ShadowVariablesProps } from './types';

/**
 * Adopts Mantine-generated variables without relying on a host page's inline-style policy.
 * Uses the installed library's public resolvers and the same shared theme mapping as full pages.
 * @since 0.1.0
 * @param props - Extension-owned shadow boundary and unique provider selector.
 * @return No additional DOM nodes.
 */
export function ShadowVariables( props: ShadowVariablesProps ) {
	const theme = useMantineTheme();
	useLayoutEffect( () => {
		const defaults = defaultCssVariablesResolver( theme );
		const custom = tocusCssVariables( theme );
		const sheet = createShadowStyleSheet( convertCssVariables( {
			variables: { ...defaults.variables, ...custom.variables },
			light: { ...defaults.light, ...custom.light, '--mantine-color-scheme': TocusAppearance.LIGHT },
			dark: { ...defaults.dark, ...custom.dark, '--mantine-color-scheme': TocusAppearance.DARK },
		}, props.selector ) );
		props.root.adoptedStyleSheets = [ ...props.root.adoptedStyleSheets, sheet ];
		const scope = props.root.querySelector( props.selector );
		const releaseInlineLengths = scope ? observeShadowInlineLengths( scope ) : undefined;
		return () => {
			releaseInlineLengths?.();
			props.root.adoptedStyleSheets = props.root.adoptedStyleSheets.filter( ( existing ) => existing !== sheet );
		};
	}, [ theme, props.root, props.selector ] );
	return null;
}
