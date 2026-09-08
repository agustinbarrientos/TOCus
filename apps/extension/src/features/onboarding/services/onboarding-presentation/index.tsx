import { createRoot } from 'react-dom/client';
import { Language, Palette, ThemeMode } from '../../../../domains/preferences/types';
import { createPresentationPort } from '../../../../shared/utils/presentation-port';
import type { OnboardingPageShell } from '../onboarding-page/types';
import type { OnboardingState } from '../../types/flow';
import { OnboardingView } from '../../components/shell';
import '../../components/shell/styles.scss';

/**
 * Mounts the presentation boundary consumed by the existing onboarding page service.
 * @remarks Storage, localization loading and browser permissions remain service-owned.
 * @param container - Dedicated extension-page React mount point.
 * @return Mutable controller port whose assignments produce coherent React snapshots.
 * @since 0.1.0
 */
export function mountOnboarding( container: HTMLElement ): OnboardingPageShell {
	const root = createRoot( container );
	let disposed = false;
	const port = createPresentationPort<OnboardingState>( {
		copy: undefined,
		interruptionCopy: undefined,
		editor: null,
		enrollment: null,
		language: Language.ENGLISH,
		theme: ThemeMode.SYSTEM,
		palette: Palette.BROWN,
		protectedSites: [],
		reducedMotion: false,
		suggestions: [],
		startupUnavailable: false,
		synchronizeLanguage: null,
	}, ( state ) => {
		if ( ! disposed ) {
			root.render( <OnboardingView state={ state } port={ port } /> );
		}
	} );

	window.addEventListener( 'pagehide', () => {
		disposed = true;
		root.unmount();
	}, { once: true } );
	return port;
}
