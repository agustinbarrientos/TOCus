import type {
	TimingConfiguration,
} from '../../../../domains/protection/types/timing-configuration';
import type {
	TimingScreenCopy,
} from '../timing-screen/types';


/**
 * Numeric timing field expressed in milliseconds by the domain.
 * @since 0.1.0
 */
export type TimingField = keyof Omit<TimingConfiguration, 'completionAction'>;


/**
 * Approved timing range bounds and localized presentation.
 * @since 0.1.0
 */
export interface TimingRange {
	key: TimingField;
	id: string;
	label: string;
	help: string;
	min: number;
	max: number;
	step: number;
	unit: number;
	format: ( value: number ) => string;
}


/**
 * Controlled global timing form contents.
 * @since 0.1.0
 */
export interface TimingControlsProps {
	copy: TimingScreenCopy;
	value: TimingConfiguration;
	disabled: boolean;
	onChange: ( value: TimingConfiguration ) => void;
}
