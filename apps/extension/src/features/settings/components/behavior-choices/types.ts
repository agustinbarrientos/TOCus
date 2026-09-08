/**
 * Localized choice in an existing Settings domain catalog.
 * @since 0.1.0
 */
export interface BehaviorChoice<Value extends string> {
	value: Value;
	label: string;
	description: string;
}

/**
 * Controlled presentation of one mutually exclusive Settings behavior.
 * @since 0.1.0
 */
export interface BehaviorChoicesProps<Value extends string> {
	name: string;
	label: string;
	value: Value;
	options: readonly BehaviorChoice<Value>[];
	disabled?: boolean | undefined;
	stacked?: boolean;
	onChange: ( value: Value ) => void;
}
