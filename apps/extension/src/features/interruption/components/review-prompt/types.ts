import type { InterruptionScreenCopy } from '../screen/types';
import type { ReviewPromptPresentation } from '../../services/review-prompt-controller/types';

/**
 * Localized review invitation and its persistent dismissal action.
 * @since 0.1.0
 */
export interface ReviewPromptProps {
	copy: Readonly<InterruptionScreenCopy>;
	presentation: Readonly<ReviewPromptPresentation>;
	onDismiss: () => void;
}
