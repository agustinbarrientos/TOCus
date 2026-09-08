import { Language, Palette, ThemeMode } from '../../../apps/extension/src/domains/preferences/types';
import { PopupVisualScenario } from '../../../apps/extension/src/features/popup/components/shell/__fixtures__/visual-types';
import { InterruptionScreenMode, InterruptionScreenState } from '../../../apps/extension/src/features/interruption/components/screen/types';
import { OnboardingVisualScenario } from './presentation/types';
import { compareOriginal, expect, originalCase, OriginalFixtureOrigin } from './helpers';
import type {} from '../../../apps/extension/src/features/interruption/components/screen/__fixtures__/browser-types';

const popupSnapshots = 'apps/extension/src/features/popup/components/shell/__snapshots__/chromium/';
for ( const [ name, scenario ] of [
	[ 'popup-shell-light', PopupVisualScenario.UNLISTED ],
	[ 'popup-shell-protected-idle', PopupVisualScenario.IDLE ],
	[ 'popup-shell-dark', PopupVisualScenario.ACTIVE ],
	[ 'popup-shell-unavailable', PopupVisualScenario.UNAVAILABLE ],
	[ 'popup-shell-long-content-narrow', PopupVisualScenario.LONG_CONTENT ],
	[ 'popup-shell-manage-hover-green-light', PopupVisualScenario.IDLE ],
	[ 'popup-shell-manage-focus-green-light', PopupVisualScenario.IDLE ],
] as const ) {
	const path = `${ popupSnapshots }${ name }.png`;
	originalCase( path, async ( { page } ) => {
		const longContent = scenario === PopupVisualScenario.LONG_CONTENT;
		await page.setViewportSize( {
			width: longContent ? 360 : 800, height: longContent || scenario === PopupVisualScenario.ACTIVE ? 900 : 800,
		} );
		await page.goto( `${ OriginalFixtureOrigin }/apps/extension/src/features/popup/components/shell/__fixtures__/visual.html?scenario=${ scenario }` );
		await expect( page.getByRole( 'link', { name: longContent ? 'Open settings' : 'Settings', exact: true } ) ).toBeVisible();
		await page.locator( '.popup-site-mark img' ).evaluateAll( ( images ) => Promise.all(
			images.map( ( image ) => image instanceof HTMLImageElement ? image.decode() : Promise.resolve() ),
		) );
		if ( name.includes( '-hover-' ) ) {
			await page.getByRole( 'link', { name: 'Manage this website', exact: true } ).hover();
		} else if ( name.includes( '-focus-' ) ) {
			await page.keyboard.press( 'Tab' );
			await page.getByRole( 'link', { name: 'Manage this website', exact: true } ).focus();
		}
		if ( name.includes( '-hover-' ) || name.includes( '-focus-' ) ) {
			// Original interaction cases awaited the action's own animations before capture.
			await page.getByRole( 'link', { name: 'Manage this website', exact: true } ).evaluate( ( action ) =>
				Promise.all( action.getAnimations().map( ( animation ) => animation.finished ) ) );
		}
		await compareOriginal( page, path, page.locator( '#app' ) );
	} );
}

const onboardingSnapshots = 'apps/extension/src/features/onboarding/components/shell/__snapshots__/chromium/';
for ( const [ name, scenario, theme, width, height, system ] of [
	[ 'onboarding-shell-brown-light', OnboardingVisualScenario.LANGUAGE, ThemeMode.LIGHT, 1440, 1000, ThemeMode.LIGHT ],
	[ 'onboarding-shell-purple-dark-narrow', OnboardingVisualScenario.LANGUAGE, ThemeMode.DARK, 420, 1400, ThemeMode.DARK ],
	[ 'onboarding-shell-recovery-brown-dark', OnboardingVisualScenario.RECOVERY, ThemeMode.DARK, 1440, 1000, ThemeMode.DARK ],
	[ 'onboarding-shell-appearance-brown-light', OnboardingVisualScenario.APPEARANCE, ThemeMode.LIGHT, 1440, 1000, ThemeMode.DARK ],
	[ 'onboarding-shell-appearance-purple-dark-narrow', OnboardingVisualScenario.APPEARANCE, ThemeMode.DARK, 420, 1600, ThemeMode.LIGHT ],
	[ 'onboarding-shell-appearance-purple-dark-phone-scrolled', OnboardingVisualScenario.APPEARANCE, ThemeMode.DARK, 420, 900, ThemeMode.LIGHT ],
	[ 'onboarding-shell-appearance-brown-light-landscape-scrolled', OnboardingVisualScenario.APPEARANCE, ThemeMode.LIGHT, 800, 420, ThemeMode.DARK ],
	[ 'onboarding-shell-sites-brown-light', OnboardingVisualScenario.SITES, ThemeMode.LIGHT, 1440, 1200, ThemeMode.LIGHT ],
	[ 'onboarding-shell-language-completed-purple-dark-narrow', OnboardingVisualScenario.COMPLETED_LANGUAGE, ThemeMode.DARK, 420, 1400, ThemeMode.DARK ],
] as const ) {
	const path = `${ onboardingSnapshots }${ name }.png`;
	originalCase( path, async ( { page } ) => {
		await page.setViewportSize( { width, height } );
		await page.emulateMedia( { colorScheme: system, reducedMotion: 'reduce' } );
		await page.goto( `${ OriginalFixtureOrigin }/tests/visual/originals/presentation/index.html?theme=${ theme }&scenario=${ scenario }` );
		await expect( page.locator( '.onboarding-form h1' ) ).toBeVisible();
		if ( scenario === OnboardingVisualScenario.APPEARANCE ) {
			await expect( page.getByRole( 'heading', { name: 'Make TOCus yours' } ) ).toBeVisible();
		} else if ( scenario === OnboardingVisualScenario.SITES ) {
			await expect( page.getByRole( 'heading', { name: 'Choose websites', exact: true } ) ).toBeVisible();
		} else if ( scenario === OnboardingVisualScenario.COMPLETED_LANGUAGE ) {
			await expect( page.locator( '[data-completed-step]' ) ).toHaveCount( 1 );
			await expect( page.getByRole( 'heading', { name: 'Choose your language' } ) ).toBeVisible();
		}
		if ( name.endsWith( '-scrolled' ) ) {
			await page.locator( '.onboarding-layout' ).evaluate( ( element ) => {
				element.scrollTop = element.scrollHeight;
			} );
		}
		// Archived navigation dispatched step events without leaving the pointer over the next action.
		await page.mouse.move( 0, 0 );
		await compareOriginal( page, path, page.locator( '#app' ) );
	} );
}

for ( const [ name, theme, palette, width, height, language ] of [
	[ 'onboarding-sites-step-brown-light', ThemeMode.LIGHT, Palette.BROWN, 1280, 1400, Language.ENGLISH ],
	[ 'onboarding-sites-step-purple-dark-narrow', ThemeMode.DARK, Palette.PURPLE, 420, 2000, Language.ENGLISH ],
	[ 'onboarding-sites-step-spanish-vos-filled', ThemeMode.LIGHT, Palette.BROWN, 420, 2400, Language.SPANISH_VOS ],
	[ 'onboarding-sites-step-spanish-tu-denied', ThemeMode.DARK, Palette.PURPLE, 1280, 1600, Language.SPANISH_TU ],
	[ 'onboarding-sites-step-add-hover-green-light', ThemeMode.LIGHT, Palette.GREEN, 1280, 1400, Language.ENGLISH ],
	[ 'onboarding-sites-step-add-focus-green-light', ThemeMode.LIGHT, Palette.GREEN, 1280, 1400, Language.ENGLISH ],
] as const ) {
	const path = `apps/extension/src/features/onboarding/components/sites-step/__snapshots__/chromium/${ name }.png`;
	originalCase( path, async ( { page } ) => {
		await page.setViewportSize( { width, height } );
		await page.emulateMedia( { colorScheme: theme, reducedMotion: 'reduce' } );
		await page.goto( `${ OriginalFixtureOrigin }/tests/visual/originals/presentation/index.html?sites-step&theme=${ theme }&palette=${ palette }&language=${ language }&width=${ width === 420 ? '100%25' : '62rem' }` );
		for ( const site of [ 'Instagram', 'Reddit' ] ) {
			const suggestion = page.getByRole( 'button', { name: site, exact: true } );
			await suggestion.evaluate( ( button ) => {
				if ( button instanceof HTMLButtonElement ) {
					button.click();
				}
			} );
			await expect( suggestion ).toHaveAttribute( 'aria-pressed', 'true' );
		}
		await page.locator( '.suggestion img' ).evaluateAll( ( images ) => Promise.all(
			images.map( ( image ) => image instanceof HTMLImageElement ? image.decode() : Promise.resolve() ),
		) );
		if ( name.includes( '-filled' ) || name.includes( '-denied' ) || name.includes( '-add-' ) ) {
			await page.evaluate( ( originalLanguage ) =>
				window.prepareOriginalSitesInput( originalLanguage, 'example.com' ), language );
		}
		if ( name.includes( '-hover-' ) ) {
			const position = await page.getByRole( 'button', { name: 'Add site', exact: true } ).evaluate( ( button ) => {
				const bounds = button.getBoundingClientRect();
				return { x: Math.round( bounds.x + bounds.width / 2 ), y: Math.round( bounds.y + bounds.height / 2 ) };
			} );
			await page.mouse.move( position.x, position.y );
		} else if ( name.includes( '-focus-' ) ) {
			await page.keyboard.press( 'Tab' );
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).focus();
		} else if ( name.includes( '-denied' ) ) {
			await page.locator( '.manual-form' ).evaluate( ( form ) => {
				form.dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );
			} );
			await page.locator( '.finish-action' ).evaluate( ( button ) => {
				if ( button instanceof HTMLButtonElement ) {
					button.click();
				}
			} );
			await expect( page.getByRole( 'alert' ).filter( { hasText: /\S/ } ) ).toBeVisible();
		}
		if ( name.includes( '-hover-' ) || name.includes( '-focus-' ) ) {
			await page.getByRole( 'button', { name: 'Add site', exact: true } ).evaluate( ( button ) =>
				Promise.all( button.getAnimations().map( ( animation ) => animation.finished ) ) );
		}
		await compareOriginal( page, path, page.locator( '#app' ) );
	} );
}

const pauseSnapshots = 'apps/extension/src/features/interruption/components/screen/__snapshots__/chromium/';
for ( const [ name, state, theme, mode ] of [
	[ 'interruption-screen-waiting-light', InterruptionScreenState.WAITING, ThemeMode.LIGHT, InterruptionScreenMode.BREATHING ],
	[ 'interruption-screen-waiting-dark', InterruptionScreenState.WAITING, ThemeMode.DARK, InterruptionScreenMode.BREATHING ],
	[ 'interruption-screen-quiet-purple-dark', InterruptionScreenState.WAITING, ThemeMode.DARK, InterruptionScreenMode.QUIET ],
	[ 'interruption-screen-ready', InterruptionScreenState.READY, ThemeMode.LIGHT, InterruptionScreenMode.BREATHING ],
	[ 'interruption-screen-unavailable', InterruptionScreenState.UNAVAILABLE, ThemeMode.LIGHT, InterruptionScreenMode.BREATHING ],
	[ 'interruption-screen-unavailable-dark', InterruptionScreenState.UNAVAILABLE, ThemeMode.DARK, InterruptionScreenMode.BREATHING ],
] as const ) {
	const path = `${ pauseSnapshots }${ name }.png`;
	originalCase( path, async ( { page } ) => {
		const reduced = state !== InterruptionScreenState.WAITING || mode === InterruptionScreenMode.QUIET;
		await page.setViewportSize( { width: 800, height: 600 } );
		await page.emulateMedia( { colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference' } );
		await page.goto( `${ OriginalFixtureOrigin }/apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html` );
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-ready', 'true' );
		await page.evaluate( async ( values ) => {
			const screen = window.pauseFixture.screen;
			document.documentElement.dataset.tocusTheme = values.theme;
			document.documentElement.dataset.tocusPalette = values.palette;
			screen.state = values.state;
			screen.mode = values.mode;
			screen.reducedMotion = values.reduced;
			screen.progressing = false;
			screen.focusedProgressMilliseconds = 2000;
			screen.wellbeingSummary = "Since you started, you've given yourself about 3 hours 24 minutes back and taken 18 minutes for yourself.";
			await screen.updateComplete;
		}, {
			state, theme, mode, reduced,
			palette: mode === InterruptionScreenMode.QUIET ? Palette.PURPLE : Palette.BROWN,
		} );
		await compareOriginal( page, path, page.locator( 'tocus-f-interruption-screen' ) );
	} );
}

for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] ) {
	const path = `apps/extension/src/features/interruption/components/protected-page-layer/__snapshots__/chromium/protected-page-warning-${ theme }.png`;
	originalCase( path, async ( { page } ) => {
		await page.setViewportSize( { width: 800, height: 600 } );
		await page.emulateMedia( { colorScheme: theme, reducedMotion: 'reduce' } );
		await page.goto( `${ OriginalFixtureOrigin }/apps/extension/src/features/interruption/components/screen/__fixtures__/browser.html?warning` );
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'data-ready', 'true' );
		const clip = await page.evaluate( async ( appearance ) => {
			document.body.style.background = appearance === window.pauseFixture.themes.DARK ? '#120c09' : '#fff8f0';
			await document.fonts.ready;
			const root = window.pauseFixture.layer?.getInterruptionScreen().getRootNode();
			if ( ! ( root instanceof ShadowRoot ) ) {
				throw new Error( 'The warning must render inside the production closed shadow boundary.' );
			}
			const warning = root.querySelector( '.warning' );
			if ( ! warning ) {
				throw new Error( 'The original allowance warning was not rendered.' );
			}
			const { x, y, width, height } = warning.getBoundingClientRect();
			return { x, y, width, height };
		}, theme );
		await compareOriginal( page, path, undefined, { clip } );
	} );
}
