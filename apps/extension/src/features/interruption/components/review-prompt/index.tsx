import { Button, Icon, IconName } from '@tocus/ui';
import type { ReviewPromptProps } from './types';

/**
 * Offers an optional store review without interrupting the pause or stealing focus.
 * @param props - Localized copy, eligible store destination and dismissal action.
 * @param props.copy - Localized invitation and action labels.
 * @param props.presentation - Store destination and dismissal state.
 * @param props.onDismiss - Persist the choice to stop asking for a review.
 * @return Non-modal review invitation.
 * @since 1.0.0
 */
export function ReviewPrompt( { copy, presentation, onDismiss }: ReviewPromptProps ) {
	return <aside className="review-prompt" aria-labelledby="review-title" onFocus={( event ) => {
		for ( const animation of event.currentTarget.getAnimations() ) {
			animation.finish();
		}
	}}>
		<h2 id="review-title">{copy.formatReviewTitle( presentation.savedMilliseconds )}</h2>
		<p>{copy.reviewMessage}</p>
		<div className="review-actions">
			<Button component="a" href={presentation.url} target="_blank" rel="noopener noreferrer" onClick={onDismiss}
				leftSection={<Icon name={IconName.STAR} />}
				rightSection={<Icon name={IconName.ARROW_UP_RIGHT_FROM_SQUARE} />}>
				{copy.reviewActionLabel}
			</Button>
			<Button type="button" variant="subtle" disabled={presentation.dismissing} onClick={onDismiss}>
				{copy.reviewDismissLabel}
			</Button>
		</div>
		{presentation.dismissalFailed && <p role="alert">{copy.reviewDismissError}</p>}
	</aside>;
}
