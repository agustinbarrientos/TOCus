import { PausePreview as BrowserPausePreview } from '../../../interruption/components/pause-preview';
import type { PausePreviewProps } from '../../types/presentation';

/**
 * Supplies onboarding copy and motion preferences to the shared browser preview.
 * @param props - Current localized pause copy and motion preference.
 * @return A fixed bottom-left preview outside the onboarding content grid.
 * @since 1.0.0
 */
export function PausePreview( props: PausePreviewProps ) {
	const { state } = props;
	return <BrowserPausePreview className="onboarding-preview" title={ state.copy?.appearance.previewTitle }
		copy={ state.interruptionCopy } reducedMotion={ state.reducedMotion } />;
}
