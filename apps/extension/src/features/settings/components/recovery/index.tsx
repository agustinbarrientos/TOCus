import {
	Alert,
	Button,
	Icon, IconName,
	Group,
} from '@tocus/ui';
import { LoadState,
	type RecoveryProps,
} from './types';


/**
 * Preserves malformed data until an explicit supported recovery action.
 * @param props - Current load state, localized guidance and safe recovery callbacks.
 * @return Loading announcement, actionable failure notice or no extra content.
 * @since 0.1.0
 */
export function Recovery( props: RecoveryProps ) {
	if ( props.status === LoadState.READY ) {
		return null;
	}
	if ( props.status === LoadState.LOADING ) {
		return <p role="status">{ props.copy.loading }</p>;
	}
	const malformed = props.status === LoadState.MALFORMED;
	const restoreAvailable = malformed && props.restore !== undefined;
	const title = malformed ? props.copy.malformedDataTitle : props.copy.loadErrorTitle;
	const description = malformed ? props.copy.malformedDataDescription : props.copy.loadErrorDescription;
	return (
		<Alert role="alert" color="red" className="tocus-alert-actionable" icon={ <Icon name={ IconName.CIRCLE_EXCLAMATION } /> }>
			<div className="tocus-alert-layout">
				<div className="tocus-alert-copy"><h2>{ title }</h2><p>{ description }</p></div>
				<Group className="tocus-alert-actions">
					<Button variant="outline" disabled={ props.disabled ?? false }
						onClick={ restoreAvailable ? props.restore : props.retry }>
						{ restoreAvailable ? props.copy.restoreDefaults : props.copy.retry }
					</Button>
				</Group>
			</div>
		</Alert>
	);
}
