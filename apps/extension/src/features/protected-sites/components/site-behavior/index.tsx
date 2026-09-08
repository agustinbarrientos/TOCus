import { BehaviorChoices } from '../../../settings/components/behavior-choices';
import { SiteBehaviorMode,
	type SiteBehaviorProps,
} from './types';


/**
 * Shares real timer and schedule behavior choices between adding and editing websites.
 * @param props - Canonical copy and controlled separate-timer preference.
 * @return Shared packaged choices without status-like badges or duration overrides.
 * @since 0.1.0
 */
export function SiteBehavior( props: SiteBehaviorProps ) {
	const { copy, disabled } = props;
	return (
		<BehaviorChoices stacked={ props.stacked ?? false } label={ copy.behaviorLegend } name={ props.name }
			value={ props.independent ? SiteBehaviorMode.INDEPENDENT : SiteBehaviorMode.SHARED }
			disabled={ disabled } options={ [
				{ value: SiteBehaviorMode.SHARED, label: copy.sharedBehavior,
					description: copy.sharedBehaviorDescription },
				{ value: SiteBehaviorMode.INDEPENDENT, label: copy.independentBehavior,
					description: copy.independentBehaviorDescription },
			] }
			onChange={ ( value ) => {
				props.onChange( value === SiteBehaviorMode.INDEPENDENT );
			} } />
	);
}
