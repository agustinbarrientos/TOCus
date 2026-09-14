import {
	Group,
	Slider,
	FieldHelp,
} from '@tocus/ui';
import {
	CompletionAction,
} from '../../../../domains/protection/types/completion-action';
import type {
	TimingScreenCopy,
} from '../timing-screen/types';
import type {
	TimingControlsProps,
	TimingRange,
} from './types';
import './style.scss';
import { BehaviorChoices } from '../behavior-choices';


/**
 * Defines approved numeric limits without duplicating domain persistence units in JSX.
 * @param copy - Canonical timing labels, help and unit formatters.
 * @return Four global slider presentations.
 * @since 0.1.0
 */
function createRanges( copy: TimingScreenCopy ): TimingRange[] {
	return [
		{ key: 'initialWaitMilliseconds', id: 'initial-wait', label: copy.initialWaitLabel,
			help: copy.initialWaitHelp, min: 10, max: 30, step: 5, unit: 1000,
			format: copy.formatSecondsOption.bind( copy ) },
		{ key: 'ladderIncreaseMilliseconds', id: 'wait-increase', label: copy.waitIncreaseLabel,
			help: copy.waitIncreaseHelp, min: 0, max: 5, step: 1, unit: 1000,
			/**
			 * Describes the meaningful zero-increase state explicitly.
			 * @param value - Selected whole seconds.
			 * @return Localized duration or no-increase explanation.
			 */
			format: ( value ) => value === 0 ? copy.noWaitIncrease : copy.formatSecondsOption( value ) },
		{ key: 'maximumWaitMilliseconds', id: 'maximum-wait', label: copy.maximumWaitLabel,
			help: copy.maximumWaitHelp, min: 30, max: 120, step: 30, unit: 1000,
			format: copy.formatSecondsOption.bind( copy ) },
		{ key: 'allowanceMilliseconds', id: 'allowance', label: copy.allowanceLabel,
			help: copy.allowanceHelp, min: 2, max: 20, step: 1, unit: 60000,
			format: copy.formatMinutesOption.bind( copy ) },
	];
}


/**
 * Renders accessible packaged sliders and completion choices for global timing.
 * @param props - Current draft, localized controls and mutation callback.
 * @return Form-owned timing controls with units and a live plain-language summary.
 * @since 0.1.0
 */
export function TimingControls( props: TimingControlsProps ) {
	const { copy, value, disabled } = props;
	const summary = copy.formatSummary( value.initialWaitMilliseconds / 1000,
		value.ladderIncreaseMilliseconds / 1000,
		value.maximumWaitMilliseconds / 1000,
		value.allowanceMilliseconds / 60000,
		value.completionAction );
	return (
		<>
			{ createRanges( copy ).map( ( range ) => <div key={ range.id } className="settings-timing-range">
				<Group justify="space-between">
					<Group gap="xs"><label className="tocus-field-label" id={ `${ range.id }-label` } htmlFor={ range.id }>{ range.label }</label>
						<FieldHelp label={ range.label } description={ range.help } descriptionId={ `${ range.id }-help` } /></Group>
					<output htmlFor={ range.id }>{ range.format( value[ range.key ] / range.unit ) }</output>
				</Group>
				<Slider name={ range.id } min={ range.min } max={ range.max } step={ range.step }
					value={ value[ range.key ] / range.unit } disabled={ disabled }
					marks={ Array.from( { length: ( range.max - range.min ) / range.step + 1 },
						( _, index ) => ( { value: range.min + index * range.step } ) ) }
					label={ null } thumbLabel={ range.label } thumbValueText={ range.format }
					attributes={ { thumb: { id: range.id, 'aria-labelledby': `${ range.id }-label`,
						'aria-describedby': `${ range.id }-help` } } }
					onChange={ ( selected ) => {
						props.onChange( { ...value, [ range.key ]: selected * range.unit } );
					} } />
				<div className="settings-timing-ticks"><span>{ range.format( range.min ) }</span>
					<span>{ range.format( range.max ) }</span></div>
			</div> ) }
			<BehaviorChoices label={ copy.completionActionLegend } name="completion-action" value={ value.completionAction }
				disabled={ disabled } options={ [
					{ value: CompletionAction.SHOW_CONTINUE, label: copy.showContinueLabel },
					{ value: CompletionAction.OPEN_AUTOMATICALLY, label: copy.openAutomaticallyLabel },
				] }
				onChange={ ( completionAction ) => {
					props.onChange( { ...value, completionAction } );
				} } />
			<section className="tocus-section settings-timing-summary"><h2>{ copy.summaryTitle }</h2><p>{ summary }</p></section>
		</>
	);
}
