import { z } from 'zod';
import { DurationMillisecondsSchema } from './protection-value';
import { AllowanceDurationMillisecondsSchema } from './allowance-duration';
import { CompletionAction, CompletionActionSchema } from './completion-action';
import { WaitDurationMillisecondsSchema } from './wait-duration';

const FIVE_SECONDS_MILLISECONDS = 5_000;
const SIXTY_SECONDS_MILLISECONDS = 60_000;
const ONE_MINUTE_MILLISECONDS = 60_000;

/**
 * Validates a permitted daily-ladder wait increase.
 * @since 0.1.0 Initial implementation.
 */
const LadderIncreaseMillisecondsSchema = DurationMillisecondsSchema
	.min( FIVE_SECONDS_MILLISECONDS )
	.max( SIXTY_SECONDS_MILLISECONDS )
	.multipleOf( FIVE_SECONDS_MILLISECONDS );

/**
 * Validates the global timing configuration.
 * @since 0.1.0 Initial implementation.
 */
export const TimingConfigurationSchema = z.object( {
	initialWaitMilliseconds: WaitDurationMillisecondsSchema,
	ladderIncreaseMilliseconds: LadderIncreaseMillisecondsSchema,
	maximumWaitMilliseconds: WaitDurationMillisecondsSchema,
	allowanceMilliseconds: AllowanceDurationMillisecondsSchema,
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
