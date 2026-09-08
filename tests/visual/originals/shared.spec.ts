import { TocusAppearance, TocusPalette } from '../../../packages/ui/src/types';
import { Language } from '../../../apps/extension/src/domains/preferences/types';
import { compareOriginal, originalCase, OriginalFixtureOrigin } from './helpers';
import { SharedOriginalSurface, type SharedOriginalCase } from './shared-fixture/types';

const controls = 'apps/extension/src/features/preferences/components/appearance-controls/__snapshots__/chromium/';
const onboarding = 'apps/extension/src/features/onboarding/components/';
const notices = 'apps/extension/src/shared/utils/shared-theme-styles/__snapshots__/chromium/';
const cases: SharedOriginalCase[] = [
	{ path: `${ controls }appearance-controls-brown-light.png`, surface: SharedOriginalSurface.APPEARANCE,
		scheme: TocusAppearance.LIGHT, palette: TocusPalette.BROWN, viewport: { width: 1280, height: 900 }, width: '46rem' },
	{ path: `${ controls }appearance-controls-purple-dark-narrow.png`, surface: SharedOriginalSurface.APPEARANCE,
		scheme: TocusAppearance.DARK, palette: TocusPalette.PURPLE, viewport: { width: 420, height: 900 }, width: '100%' },
	{ path: `${ onboarding }appearance-step/__snapshots__/chromium/onboarding-appearance-step-brown-light.png`,
		surface: SharedOriginalSurface.APPEARANCE_STEP, scheme: TocusAppearance.LIGHT, palette: TocusPalette.BROWN,
		viewport: { width: 1280, height: 1100 }, width: '58rem' },
	{ path: `${ onboarding }appearance-step/__snapshots__/chromium/onboarding-appearance-step-purple-dark-narrow.png`,
		surface: SharedOriginalSurface.APPEARANCE_STEP, scheme: TocusAppearance.DARK, palette: TocusPalette.PURPLE,
		viewport: { width: 420, height: 1500 }, width: '100%' },
	{ path: `${ onboarding }language-step/__snapshots__/chromium/onboarding-language-step-english-light.png`,
		surface: SharedOriginalSurface.LANGUAGE_STEP, scheme: TocusAppearance.LIGHT, palette: TocusPalette.BROWN,
		language: Language.ENGLISH, viewport: { width: 1280, height: 900 }, width: '50rem' },
	{ path: `${ onboarding }language-step/__snapshots__/chromium/onboarding-language-step-spanish-tu-dark-narrow.png`,
		surface: SharedOriginalSurface.LANGUAGE_STEP, scheme: TocusAppearance.DARK, palette: TocusPalette.PURPLE,
		language: Language.SPANISH_TU, viewport: { width: 420, height: 1100 }, width: '100%' },
	{ path: `${ onboarding }language-step/__snapshots__/chromium/onboarding-language-step-portuguese-brazil-dark-narrow.png`,
		surface: SharedOriginalSurface.LANGUAGE_STEP, scheme: TocusAppearance.DARK, palette: TocusPalette.PURPLE,
		language: Language.PORTUGUESE_BRAZIL, viewport: { width: 420, height: 1100 }, width: '100%' },
];
for ( const scheme of [ TocusAppearance.LIGHT, TocusAppearance.DARK ] ) {
	for ( const palette of [ TocusPalette.BLUE, TocusPalette.GREEN ] ) {
		cases.push( { path: `${ notices }shared-notices-${ palette }-${ scheme }.png`, surface: SharedOriginalSurface.NOTICES,
			scheme, palette, viewport: { width: 760, height: 1000 }, width: '700px' } );
	}
}

for ( const original of cases ) {
	originalCase( original.path, async ( { page } ) => {
		await page.setViewportSize( original.viewport );
		await page.emulateMedia( { colorScheme: original.scheme, reducedMotion: 'reduce', forcedColors: 'none' } );
		const query = new URLSearchParams( { surface: original.surface, scheme: original.scheme,
			palette: original.palette, width: original.width, language: original.language ?? Language.ENGLISH } );
		await page.goto( `${ OriginalFixtureOrigin }/tests/visual/originals/shared-fixture/index.html?${ query }` );
		await compareOriginal( page, original.path, page.locator( '#original-shared-capture' ) );
	} );
}
