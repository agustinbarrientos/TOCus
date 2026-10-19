import type { PreferencesDocument } from '../../../../domains/preferences/types';
import type { InterruptionScreenCopy } from '../screen/types';

/**
 * Localized, inert browser preview with optional unsaved personalization choices.
 * @since 1.1.0
 */
export interface PausePreviewProps {
	readonly title?: string | undefined;
	readonly copy?: Readonly<InterruptionScreenCopy> | undefined;
	readonly reducedMotion: boolean;
	readonly preferences?: Readonly<Pick<PreferencesDocument, 'theme' | 'palette' | 'pauseMode' | 'focusLinks'>> | undefined;
	readonly className: string;
}
