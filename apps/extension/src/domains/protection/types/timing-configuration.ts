import { z } from 'zod';
import { DurationMillisecondsSchema } from './protection-value';
import { CompletionAction, CompletionActionSchema } from './completion-action';

const FIVE_SECONDS_MILLISECONDS = 5_000;
const ONE_SECOND_MILLISECONDS = 1_000;
const TEN_SECONDS_MILLISECONDS = 10_000;
const THIRTY_SECONDS_MILLISECONDS = 30_000;
const SIXTY_SECONDS_MILLISECONDS = 60_000;
const ONE_MINUTE_MILLISECONDS = 60_000;
const TWO_MINUTES_MILLISECONDS = 2 * ONE_MINUTE_MILLISECONDS;
const TWENTY_MINUTES_MILLISECONDS = 20 * ONE_MINUTE_MILLISECONDS;

/**
 * Validates a permitted initial wait selected in five-second increments.
 * @since 0.1.0 Initial implementation.
 */
const InitialWaitMillisecondsSchema = DurationMillisecondsSchema
	.min( TEN_SECONDS_MILLISECONDS )
	.max( THIRTY_SECONDS_MILLISECONDS )
	.multipleOf( FIVE_SECONDS_MILLISECONDS );

/**
 * Validates a permitted daily-ladder wait increase.
 * @since 0.1.0 Initial implementation.
 */
const LadderIncreaseMillisecondsSchema = DurationMillisecondsSchema
	.max( FIVE_SECONDS_MILLISECONDS )
	.multipleOf( ONE_SECOND_MILLISECONDS );

/**
 * Validates a permitted maximum wait selected in thirty-second increments.
 * @since 0.1.0 Initial implementation.
 */
const MaximumWaitMillisecondsSchema = DurationMillisecondsSchema
	.min( THIRTY_SECONDS_MILLISECONDS )
	.max( 2 * SIXTY_SECONDS_MILLISECONDS )
	.multipleOf( THIRTY_SECONDS_MILLISECONDS );

/**
 * Validates a configured allowance selected in whole minutes.
 * @since 0.1.0 Initial implementation.
 */
const TimingAllowanceMillisecondsSchema = DurationMillisecondsSchema
	.min( TWO_MINUTES_MILLISECONDS )
	.max( TWENTY_MINUTES_MILLISECONDS )
	.multipleOf( ONE_MINUTE_MILLISECONDS );

/**
 * Validates the global timing configuration.
 * @since 0.1.0 Initial implementation.
 */
export const TimingConfigurationSchema = z.object( {
	initialWaitMilliseconds: InitialWaitMillisecondsSchema,
	ladderIncreaseMilliseconds: LadderIncreaseMillisecondsSchema,
	maximumWaitMilliseconds: MaximumWaitMillisecondsSchema,
	allowanceMilliseconds: TimingAllowanceMillisecondsSchema,
	completionAction: CompletionActionSchema,
} ).strict().superRefine( ( configuration, context ) => {
	if ( configuration.maximumWaitMilliseconds < configuration.initialWaitMilliseconds ) {
		context.addIssue( {
			code: 'custom',
			message: 'Maximum wait must be greater than or equal to the initial wait.',
			path: [ 'maximumWaitMilliseconds' ],
		} );
	}
} );

/**
 * Global wait and allowance timing configuration.
 * @since 0.1.0 Initial implementation.
 */
export type TimingConfiguration = z.infer<typeof TimingConfigurationSchema>;

/**
 * Default global timing configuration.
 * @since 0.1.0 Initial implementation.
 */
export const DefaultTimingConfiguration = Object.freeze(
	TimingConfigurationSchema.parse( {
		initialWaitMilliseconds: 10_000,
		ladderIncreaseMilliseconds: FIVE_SECONDS_MILLISECONDS,
		maximumWaitMilliseconds: SIXTY_SECONDS_MILLISECONDS,
		allowanceMilliseconds: 5 * ONE_MINUTE_MILLISECONDS,
		completionAction: CompletionAction.SHOW_CONTINUE,
	} ),
);
