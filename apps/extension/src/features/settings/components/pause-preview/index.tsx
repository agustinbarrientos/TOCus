import { PausePreview } from '../../../interruption/components/pause-preview';
import { useDocumentAppearance } from '../../../preferences/services/document-appearance';
import type { SettingsPausePreviewProps } from './types';
import './style.scss';

/**
 * Keeps draft controls full width beside an independent, inert browser preview.
 * @param props - Current unsaved preferences, localized copy and editable form.
 * @return The form and shared onboarding preview, without persistence dependencies.
 * @since 1.1.0
 */
export function SettingsPausePreview( props: SettingsPausePreviewProps ) {
	const { reducedMotion } = useDocumentAppearance();
	return <div className="settings-preview-container">
		{ props.children }
		<PausePreview className="settings-pause-preview" title={ props.copy.title } copy={ props.copy.screen }
			reducedMotion={ reducedMotion } preferences={ props.preferences } />
	</div>;
}
