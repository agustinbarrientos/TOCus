import { Alert } from '@mantine/core';
import type { ComponentPropsWithRef } from 'react';
import { Icon } from './icons';
import type { NativeNoticeProps } from './types';

/**
 * Preserves native paragraph painting while retaining Mantine's semantic Alert root and theme.
 * Content is explicit; titled, closable and richer notices continue to use the ordinary Alert.
 * @param props - Localized message, decorative shape and shared semantic presentation.
 * @return The real packaged Alert root with a directly wrapping native message.
 * @since 0.1.0
 */
export function NativeNotice( props: NativeNoticeProps ) {
	/**
	 * Supplies native children through Mantine's public root renderer without inspecting its slots.
	 * @param rootProps - Packaged root attributes, ref, semantic role and resolved theme styles.
	 * @return Native paragraph carrying the unchanged packaged root contract.
	 */
	function renderNoticeRoot( rootProps: ComponentPropsWithRef<'p'> ) {
		return <p { ...rootProps }>
			<Icon className="tocus-native-notice-icon" name={ props.icon } />{ props.message }
		</p>;
	}
	return <Alert { ...( props.color === undefined ? {} : { color: props.color } ) } role={ props.role }
		styles={ { root: { color: 'var(--alert-color)' } } }
		className={ `tocus-native-notice ${ props.className ?? '' }` } renderRoot={ renderNoticeRoot } />;
}
