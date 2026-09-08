import {
	Alert,
	NativeNotice,
	Icon, IconName,
} from '@tocus/ui';
import type {
	FeedbackProps,
} from './types';


/**
 * Announces failures and successful persistence using shared semantic alerts.
 * @param props - Localized messages, omitted when their state is inactive.
 * @return Error and success notices with distinct visual and screen-reader roles.
 * @since 0.1.0
 */
export function Feedback( props: FeedbackProps ) {
	return (
		<>
			{ props.error && ( props.nativeError
				? <NativeNotice className={ props.className ?? '' } role="alert" color="red"
					icon={ IconName.EXCLAMATION } message={ props.error } />
				: <Alert className={ props.className } role="alert" color="red"
					icon={ <Icon name={ IconName.EXCLAMATION } /> }>
					{ props.error }
				</Alert> ) }
			{ props.success && <Alert className={ props.className } role="status" color="green"
				icon={ <Icon name={ IconName.CIRCLE_CHECK } /> }>
				{ props.success }
			</Alert> }
		</>
	);
}
