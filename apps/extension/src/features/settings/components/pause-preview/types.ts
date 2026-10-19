import type { ReactNode } from 'react';
import type { PreferencesDocument } from '../../../../domains/preferences/types';
import type { InterruptionScreenCopy } from '../../../interruption/components/screen/types';

/**
 * Localized caption and production pause content for the Settings preview.
 * @since 1.1.0
 */
export interface SettingsPausePreviewCopy {
	title: string;
	screen: Readonly<InterruptionScreenCopy>;
}

/**
 * Unsaved personalization draft and its editable controls.
 * @since 1.1.0
 */
export interface SettingsPausePreviewProps {
	preferences: Readonly<PreferencesDocument>;
	copy: Readonly<SettingsPausePreviewCopy>;
	children: ReactNode;
}
