import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createNotificationsStore, notifications, Notifications } from '@mantine/notifications';
import { Icon } from '../icon';
import { IconName } from '../icon/types';
import { SnackbarTone, type SnackbarApi, type SnackbarProviderProps } from './types';

const SnackbarContext = createContext<SnackbarApi | null>( null );

/**
 * Owns a private Mantine notification store inside the current themed portal boundary.
 * @since 0.1.0
 * @param root0 - Notification ownership and localization.
 * @param root0.children - Consumers of this provider's stable feedback API.
 * @param root0.closeLabel - Localized accessible label for the dismissal button.
 * @return The consuming tree and its bottom-centered notification host.
 */
export function SnackbarProvider( { children, closeLabel }: SnackbarProviderProps ) {
	const [ store ] = useState( createNotificationsStore );
	const currentCloseLabel = useRef( closeLabel );
	useLayoutEffect( () => {
		currentCloseLabel.current = closeLabel;
	}, [ closeLabel ] );
	const api = useMemo<SnackbarApi>( () => ( {
		/**
		 * Replaces obsolete feedback through the owning library store.
		 * @param options - Localized message and semantic treatment.
		 * @param options.message - Plain feedback copy.
		 * @param options.tone - Information by default, or successful completion.
		 */
		show: ( { message, tone = SnackbarTone.INFO } ) => {
			notifications.clean( store );
			notifications.show( {
				message, role: 'status', 'aria-live': 'polite', 'aria-atomic': true,
				className: 'tocus-snackbar', 'data-snackbar-tone': tone,
				icon: <Icon name={tone === SnackbarTone.SUCCESS ? IconName.CIRCLE_CHECK : IconName.CIRCLE_INFO} />,
				closeButtonProps: { 'aria-label': currentCloseLabel.current },
			}, store );
		},
	} ), [ store ] );
	return <SnackbarContext value={api}>
		{children}
		<Notifications store={store} position="bottom-center" layout="stacked" limit={1} autoClose={4000} />
	</SnackbarContext>;
}

/**
 * Returns the stable feedback API for the nearest notification boundary.
 * @since 0.1.0
 * @return Methods targeting only this provider's notifications.
 */
export function useSnackbar(): SnackbarApi {
	const api = useContext( SnackbarContext );
	if ( api === null ) {
		throw new Error( 'useSnackbar requires a SnackbarProvider.' );
	}
	return api;
}
