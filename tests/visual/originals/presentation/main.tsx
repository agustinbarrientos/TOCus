import '../../../../packages/ui/src/styles.scss';
import { createRoot } from 'react-dom/client';
import { Text, Title, TocusProvider } from '../../../../packages/ui/src';
import {
	DefaultPreferencesDocument, Language, Palette, PreferencesDocumentSchema, ThemeMode,
} from '../../../../apps/extension/src/domains/preferences/types';
import { PreferencesUpdateSchema } from '../../../../apps/extension/src/domains/preferences/services/preferences-editor';
import { createEnglishLocalizationBundle, loadLocalizationBundle } from '../../../../apps/extension/src/localization';
import { mountOnboarding } from '../../../../apps/extension/src/features/onboarding/services/onboarding-presentation';
import { OnboardingSiteSuggestions } from '../../../../apps/extension/src/features/onboarding/utils/site-suggestion-catalog';
import { ProtectedSiteEnrollmentStatus } from '../../../../apps/extension/src/features/protected-sites/services/protected-site-enrollment/types';
import { OnboardingVisualScenario } from './types';
import { advanceOriginalOnboarding } from './advance';
import type { OriginalAdvanceBoundary } from './advance/types';
import { useOnboardingController } from '../../../../apps/extension/src/features/onboarding/services/onboarding-flow';
import { SitesStep } from '../../../../apps/extension/src/features/onboarding/components/sites-step';
import { createPresentationPort } from '../../../../apps/extension/src/shared/utils/presentation-port';
import type { OnboardingState } from '../../../../apps/extension/src/features/onboarding/types/flow';
import type { OnboardingViewProps } from '../../../../apps/extension/src/features/onboarding/types/presentation';
import '../../../../apps/extension/src/features/onboarding/components/shell/styles.scss';

/**
 * Captures the actual Sites form outside the shell, as the original component test did.
 * @param root0 - Original component inputs and its event boundary.
 * @param root0.state - Current onboarding projection.
 * @param root0.port - Stateful presentation boundary used by the real controller.
 * @return The production website-selection form in its original capture frame.
 */
function StandaloneSites( { state, port }: OnboardingViewProps ) {
	const controller = useOnboardingController( state, port );
	if ( ! state.copy ) {
		return null;
	}
	return <TocusProvider appearance={ state.theme } palette={ state.palette } reducedMotion transparent>
		<div className="onboarding-standalone-step">
			<header className="tocus-preferences-header tocus-preferences-sites-header">
				<Title order={ 1 }>{ state.copy.sites.title }</Title><Text>{ state.copy.sites.introduction }</Text>
			</header>
			<SitesStep state={ state } copy={ state.copy } controller={ controller } />
		</div>
	</TocusProvider>;
}

const root = document.getElementById( 'app' );
if ( ! root ) {
	throw new Error( 'Original onboarding comparisons require their component capture root.' );
}
// The original browser suite loaded Fredoka before mounting each capture surface.
const brandFonts = await document.fonts.load( '600 2rem "Fredoka Variable"' );
if ( brandFonts.length === 0 ) {
	throw new Error( 'Original onboarding comparisons require the packaged brand font.' );
}
const query = new URLSearchParams( location.search );
const dark = query.get( 'theme' ) === ThemeMode.DARK;
const standalone = query.has( 'sites-step' );
const scenario = query.get( 'scenario' ) ?? OnboardingVisualScenario.LANGUAGE;
const advanceBoundary: OriginalAdvanceBoundary = { saved: null, language: null };
if ( ! standalone && scenario !== OnboardingVisualScenario.LANGUAGE &&
	scenario !== OnboardingVisualScenario.RECOVERY ) {
	// The archived browser fixture advanced through native events before its first paint.
	// A separate Playwright click first paints Language and changes Chromium's cached edges.
	let languageAdvanced = false;
	let appearanceAdvanced = false;
	const navigation = new MutationObserver( () => {
		const heading = root.querySelector( 'h1' );
		const button = root.querySelector<HTMLButtonElement>( '.tocus-preferences-actions button' );
		if ( ! languageAdvanced && button && ! button.disabled ) {
			languageAdvanced = true;
			void advanceOriginalOnboarding( button, advanceBoundary, true );
			return;
		}
		if ( ! languageAdvanced || heading?.textContent !== port.copy?.appearance.title ) {
			return;
		}
		if ( scenario === OnboardingVisualScenario.SITES ) {
			if ( ! appearanceAdvanced && button && ! button.disabled ) {
				appearanceAdvanced = true;
				void advanceOriginalOnboarding( button, advanceBoundary, false );
				navigation.disconnect();
			}
		} else if ( scenario === OnboardingVisualScenario.COMPLETED_LANGUAGE ) {
			root.querySelector<HTMLButtonElement>( '.onboarding-progress-step' )?.click();
			navigation.disconnect();
		} else {
			const screen = root.querySelector( 'tocus-f-interruption-screen' );
			if ( screen ) {
				screen.progressing = false;
				screen.focusedProgressMilliseconds = 0;
				navigation.disconnect();
			}
		}
	} );
	navigation.observe( root, { childList: true, subtree: true, attributes: true } );
}
// The archived component fixture inherited the document's theme color scheme.
document.documentElement.style.colorScheme = dark ? ThemeMode.DARK : ThemeMode.LIGHT;
const reactRoot = standalone ? createRoot( root ) : null;
const port = reactRoot ? createPresentationPort<OnboardingState>( {
	copy: undefined, interruptionCopy: undefined, editor: null, enrollment: null, language: Language.ENGLISH,
	theme: ThemeMode.LIGHT, palette: Palette.BROWN, protectedSites: [], reducedMotion: true,
	suggestions: [], startupUnavailable: false, synchronizeLanguage: null,
}, ( state ) => {
	reactRoot.render( <StandaloneSites state={ state } port={ port } /> );
} ) : mountOnboarding( root );
if ( standalone ) {
	root.style.width = query.get( 'width' ) ?? '100%';
}
const language = Object.values( Language ).find( ( candidate ) => candidate === query.get( 'language' ) );
// Every archived standalone Sites fixture mounted in English before any locale-copy change.
const bundle = ! standalone && language ? await loadLocalizationBundle( language ) : createEnglishLocalizationBundle();
port.copy = bundle.onboarding;
port.interruptionCopy = bundle.interruption;
port.language = Language.ENGLISH;
port.theme = dark ? ThemeMode.DARK : ThemeMode.LIGHT;
port.palette = dark && query.get( 'scenario' ) !== OnboardingVisualScenario.RECOVERY ? Palette.PURPLE : Palette.BROWN;
if ( query.get( 'palette' ) === Palette.GREEN ) {
	port.palette = Palette.GREEN;
}
port.reducedMotion = true;
port.suggestions = OnboardingSiteSuggestions;
port.startupUnavailable = query.get( 'scenario' ) === OnboardingVisualScenario.RECOVERY;
port.editor = {
	/**
	 * Supplies the same deterministic preference boundary as the archived scenario.
	 * @return Original valid preference defaults.
	 */
	load: () => Promise.resolve( DefaultPreferencesDocument ),
	/**
	 * Restores fixture-local defaults without touching extension storage.
	 * @return Original valid preference defaults.
	 */
	restoreDefaults: () => Promise.resolve( DefaultPreferencesDocument ),
	/**
	 * Validates real controller updates before advancing the displayed step.
	 * @param input - Controller-provided preference update.
	 * @return Validated preferences merged with the original defaults.
	 */
	update: ( input: unknown ) => {
		const saved = Promise.resolve( PreferencesDocumentSchema.parse( {
			...DefaultPreferencesDocument, ...PreferencesUpdateSchema.parse( input ),
		} ) );
		advanceBoundary.saved = saved;
		return saved;
	},
};
/**
 * Shares the actual language-readiness promise with the original event-settling fixture.
 * @return Successful readiness consumed by the production controller.
 */
port.synchronizeLanguage = () => {
	const ready = Promise.resolve( true );
	advanceBoundary.language = ready;
	return ready;
};
port.enrollment = {
	/**
	 * Rejects enrollment that bypasses the original batched Finish gesture.
	 * @return A rejected promise identifying an invalid fixture interaction.
	 */
	add: () => Promise.reject( new Error( 'Unexpected visual fixture enrollment.' ) ),
	/**
	 * Rejects persisted removal because these original scenarios contain only local drafts.
	 * @return A rejected promise identifying an invalid fixture interaction.
	 */
	remove: () => Promise.reject( new Error( 'Unexpected visual fixture removal.' ) ),
	/**
	 * Rejects a Settings-only draft save from an onboarding scenario.
	 * @return A rejected promise identifying an invalid fixture interaction.
	 */
	saveDraft: () => Promise.reject( new Error( 'Unexpected visual fixture save.' ) ),
	/**
	 * Supplies the original recoverable permission-denial result after Finish.
	 * @return A denied batch without changing the selected draft websites.
	 */
	addMany: () => Promise.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } ),
};
window.onboardingOriginal = port;

/**
 * Replays the archived copy assignment and native address input before the next render.
 * @param language - Packaged language applied after the English suggestions are selected and decoded.
 * @param address - Original unfocused address draft.
 * @return Completion of the original fixture mutations, without a synthetic keyboard gesture.
 * @since 0.1.0
 */
async function prepareOriginalSitesInput( language: Language, address: string ): Promise<void> {
	if ( language !== Language.ENGLISH ) {
		const localized = await loadLocalizationBundle( language );
		if ( ! port.copy ) {
			throw new Error( 'The original Sites input requires its mounted English copy.' );
		}
		port.copy = { ...port.copy, sites: localized.onboarding.sites };
	}
	const input = document.querySelector( '.manual-control input' );
	if ( ! ( input instanceof HTMLInputElement ) ) {
		throw new Error( 'The original Sites input requires its native address field.' );
	}
	const valueDescriptor = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' );
	if ( ! valueDescriptor?.set ) {
		throw new Error( 'The original Sites input requires the browser input value setter.' );
	}
	// React tracks instance assignments; the native setter preserves the archived input event.
	valueDescriptor.set.call( input, address );
	input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
}
window.prepareOriginalSitesInput = prepareOriginalSitesInput;
