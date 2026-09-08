import { Radio } from '@tocus/ui';
import type { BehaviorChoicesProps } from './types';
import './style.scss';

/**
 * Keeps behavior choices readable as cards while sharing every interaction state with Mantine.
 * @param props - Existing domain values, localized explanations and draft mutation callback.
 * @return Accessible radio group with responsive Settings-only composition.
 * @since 0.1.0
 */
export function BehaviorChoices<Value extends string>( props: BehaviorChoicesProps<Value> ) {
	/**
	 * Resolves the library string to an existing domain choice before publishing a draft change.
	 * @param value - Selected Mantine card value.
	 */
	function changeSelection( value: string ): void {
		const choice = props.options.find( ( option ) => option.value === value );
		if ( choice ) {
			props.onChange( choice.value );
		}
	}
	return <Radio.Group className="settings-behavior-control" name={ props.name }
		classNames={ { label: 'settings-behavior-label' } }
		label={ props.label } value={ props.value } onChange={ changeSelection }>
		<div className={ `settings-behavior-choices${ props.stacked ? ' settings-behavior-choices-stacked' : '' }` }>
			{ props.options.map( ( option ) => <Radio key={ option.value } value={ option.value }
				className="tocus-choice-card tocus-choice-radio" disabled={ props.disabled }
				label={ option.label } description={ option.description } /> ) }
		</div>
	</Radio.Group>;
}
