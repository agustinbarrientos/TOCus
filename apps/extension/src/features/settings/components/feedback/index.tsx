import {
	SnackbarTone,
	useSnackbar,
	Alert,
	NativeNotice,
	Icon, IconName,
} from '@tocus/ui';
import { useEffect, useRef } from 'react';
import type {
	FeedbackProps,
} from './types';


/**
 * Keeps failures inline and announces successful operations with a shared snackbar.
 * @param props - Localized messages, omitted when their state is inactive.
 * @return Contextual error notice while success feedback uses the persistent provider.
 * @since 0.1.0
 */
function SuccessFeedback( props: FeedbackProps ) {
	const { show } = useSnackbar();
	const announced = useRef<string | null>( null );
	const success = props.success ?? null;
	useEffect( () => {
		if ( success && success !== announced.current && ! props.error ) {
			show( { message: success, tone: SnackbarTone.SUCCESS } );
		}
		announced.current = success;
	}, [ success, props.error, show ] );
	return null;
}

/**
 * Keeps error-only contexts independent of the notification provider.
 * @param props - Localized error or completed-operation messages.
 * @return Inline errors and an optional success announcement consumer.
 * @since 0.1.0
 */
export function Feedback( props: FeedbackProps ) {
	return (
		<>
			{ props.success && <SuccessFeedback success={ props.success } error={ props.error ?? null } /> }
			{ props.error && ( props.nativeError
				? <NativeNotice className={ props.className ?? '' } role="alert" color="red"
					icon={ IconName.CIRCLE_EXCLAMATION } message={ props.error } />
				: <Alert className={ props.className } role="alert" color="red"
					icon={ <Icon name={ IconName.CIRCLE_EXCLAMATION } /> }>
					{ props.error }
				</Alert> ) }
		</>
	);
}
