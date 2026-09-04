import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html, oneEvent } from '@open-wc/testing';
import { emulateMedia, sendKeys, setViewport } from '@web/test-runner-commands';
import { Palette, ThemeMode } from '../../../../domains/preferences/types';
import { ComponentInterruptionScreen } from './index';
import {
	InterruptionContinueRequestEventName,
	InterruptionRetryRequestEventName,
	InterruptionScreenMode,
	InterruptionScreenState,
} from './types';

/**
 * Returns the open shadow root owned by a screen fixture.
 * @param element - Rendered interruption screen.
 * @return Open component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentInterruptionScreen ): ShadowRoot {
	const shadowRoot = element.shadowRoot;

	assert.notEqual( shadowRoot, null );
	if ( shadowRoot === null ) {
		throw new Error( 'Expected the interruption screen to render an open shadow root.' );
	}

	return shadowRoot;
}

/**
 * Returns one required HTML element from the screen shadow tree.
 * @param element - Rendered interruption screen.
 * @param selector - Selector for the required element.
 * @return Matching HTML element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement( element: ComponentInterruptionScreen, selector: string ): HTMLElement {
	const match = getShadowRoot( element ).querySelector( selector );

	assert.instanceOf( match, HTMLElement );
	if ( ! ( match instanceof HTMLElement ) ) {
		throw new Error( `Expected the interruption screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Returns the rendered Continue button.
 * @param element - Ready interruption screen.
 * @return Continue button.
 * @since 0.1.0 Initial implementation.
 */
function getContinueButton( element: ComponentInterruptionScreen ): HTMLButtonElement {
	const button = getShadowRoot( element ).querySelector( 'button' );

	assert.instanceOf( button, HTMLButtonElement );
	if ( ! ( button instanceof HTMLButtonElement ) ) {
		throw new Error( 'Expected the Ready screen to render a Continue button.' );
	}

	return button;
}

/**
 * Returns the rendered recovery button.
 * @param element - Unavailable interruption screen.
 * @return Recovery button.
 * @since 0.1.0 Initial implementation.
 */
function getRetryButton( element: ComponentInterruptionScreen ): HTMLButtonElement {
	const button = getShadowRoot( element ).querySelector( '.retry-button' );

	assert.instanceOf( button, HTMLButtonElement );
	if ( ! ( button instanceof HTMLButtonElement ) ) {
		throw new Error( 'Expected the Unavailable screen to render a retry button.' );
	}

	return button;
}

/**
 * Waits for the next browser animation frame.
 * @return Promise resolved after one frame.
 * @since 0.1.0 Initial implementation.
 */
function nextFrame(): Promise<void> {
	return new Promise( ( resolve ) => {
		requestAnimationFrame( () => {
			resolve();
		} );
	} );
}

/**
 * Formats the German remaining-time fixture.
 * @param remainingSeconds - Whole remaining seconds.
 * @return Complete German remaining-time label.
 * @since 0.1.0 Initial implementation.
 */
function formatGermanRemainingTime( remainingSeconds: number ): string {
	return `Noch ${ String( remainingSeconds ) } Sekunden`;
}

/**
 * Parses one resolved browser RGB color.
 * @param color - Resolved CSS color.
 * @return Red, green, and blue channels.
 * @since 0.1.0 Initial implementation.
 */
function parseRgbColor( color: string ): readonly [ number, number, number ] {
	const channels = color.match( /\d+(?:\.\d+)?/gu )?.slice( 0, 3 ).map( Number ) ?? [];

	if ( channels.length !== 3 ) {
		throw new Error( `Expected an RGB color, received ${ color }.` );
	}

	return [ channels.at( 0 ) ?? 0, channels.at( 1 ) ?? 0, channels.at( 2 ) ?? 0 ];
}

/**
 * Calculates relative luminance for one resolved browser RGB color.
 * @param color - Resolved CSS color.
 * @return Relative luminance from zero to one.
 * @since 0.1.0 Initial implementation.
 */
function getRelativeLuminance( color: string ): number {
	const channels = parseRgbColor( color ).map( ( channel ) => {
		const normalizedChannel = channel / 255;

		return normalizedChannel <= 0.04045
			? normalizedChannel / 12.92
			: ( ( normalizedChannel + 0.055 ) / 1.055 ) ** 2.4;
	} );

	return ( channels.at( 0 ) ?? 0 ) * 0.2126 +
		( channels.at( 1 ) ?? 0 ) * 0.7152 +
		( channels.at( 2 ) ?? 0 ) * 0.0722;
}

/**
 * Calculates the contrast ratio between two resolved browser colors.
 * @param firstColor - First resolved CSS color.
 * @param secondColor - Second resolved CSS color.
 * @return WCAG contrast ratio.
 * @since 0.1.0 Initial implementation.
 */
function getContrastRatio( firstColor: string, secondColor: string ): number {
	const firstLuminance = getRelativeLuminance( firstColor );
	const secondLuminance = getRelativeLuminance( secondColor );
	const lighterLuminance = Math.max( firstLuminance, secondLuminance );
	const darkerLuminance = Math.min( firstLuminance, secondLuminance );

	return ( lighterLuminance + 0.05 ) / ( darkerLuminance + 0.05 );
}

describe( 'tocus-f-interruption-screen', () => {
	beforeEach( async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
		await emulateMedia( { colorScheme: 'light', forcedColors: 'none', reducedMotion: 'no-preference' } );
	} );

	afterEach( () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
	} );

	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-interruption-screen' ), ComponentInterruptionScreen );
	} );

	it( 'renders the complete default Waiting scene without a bypass', async () => {
		const element = await fixture<ComponentInterruptionScreen>(
			html`<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }></tocus-f-interruption-screen>`,
		);
		const shadowRoot = getShadowRoot( element );
		const scene = getRequiredElement( element, '.scene' );
		const directRegions = Array.from( scene.children ).map( ( child ) => child.tagName );
		const sphere = shadowRoot.querySelector( 'tocus-f-breathing-sphere' );
		const brandIcon = shadowRoot.querySelector( '.brand svg' );
		const remaining = getRequiredElement( element, '.remaining' );
		const bounds = element.getBoundingClientRect();
		const sceneBounds = scene.getBoundingClientRect();
		const bloomStyle = getComputedStyle( scene, '::before' );
		const radialGradientCount = ( bloomStyle.backgroundImage.match( /radial-gradient/gu ) ?? [] ).length;

		assert.deepEqual( directRegions, [ 'HEADER', 'MAIN', 'FOOTER' ] );
		for ( const region of scene.children ) {
			assert.equal( getComputedStyle( region ).backgroundColor, 'rgba(0, 0, 0, 0)' );
			assert.equal( getComputedStyle( region ).backgroundImage, 'none' );
		}
		assert.equal( bounds.left, 0 );
		assert.equal( bounds.top, 0 );
		assert.equal( bounds.width, window.innerWidth );
		assert.equal( bounds.height, window.innerHeight );
		assert.equal( sceneBounds.left, 0 );
		assert.equal( sceneBounds.top, 0 );
		assert.equal( sceneBounds.width, window.innerWidth );
		assert.equal( sceneBounds.height, window.innerHeight );
		assert.equal( scene.getAttribute( 'tabindex' ), '0' );
		assert.instanceOf( sphere, HTMLElement );
		assert.instanceOf( brandIcon, SVGElement );
		assert.equal( brandIcon.getAttribute( 'viewBox' ), '0 0 64 64' );
		assert.equal( getRequiredElement( element, '.wordmark' ).textContent.trim(), 'TOCus' );
		assert.equal( remaining.textContent.trim(), '10s remaining' );
		assert.equal( remaining.getAttribute( 'aria-live' ), null );
		assert.equal( getRequiredElement( element, '.cue' ).textContent.trim(), 'Breathe in' );
		assert.include( getRequiredElement( element, '.sphere-alternative' ).textContent, 'soft clay sphere' );
		assert.equal( getRequiredElement( element, 'footer' ).textContent.trim(), '' );
		assert.equal( shadowRoot.querySelector( 'button' ), null );
		assert.equal( shadowRoot.querySelector( '[data-design-control]' ), null );
		assert.include( getComputedStyle( scene ).backgroundImage, 'gradient' );
		assert.equal( radialGradientCount, 1 );
		assert.equal( bloomStyle.backgroundRepeat, 'no-repeat' );
		await expect( element ).to.be.accessible();
	} );

	it( 'drives the full-screen bloom from the breathing progress', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }></tocus-f-interruption-screen>
		` );
		const scene = getRequiredElement( element, '.scene' );
		const sphere = getShadowRoot( element ).querySelector( 'tocus-f-breathing-sphere' );
		const restingStyle = getComputedStyle( scene, '::before' );
		const restingOpacity = restingStyle.opacity;
		const restingTransform = restingStyle.transform;

		assert.notEqual( sphere, null );
		if ( sphere === null ) {
			throw new Error( 'Expected the Waiting screen to render a Breathing Sphere.' );
		}

		assert.equal( Number( getComputedStyle( scene ).getPropertyValue( '--tocus-breath-progress' ) ), sphere.breathProgress );

		element.focusedProgressMilliseconds = 2_000;
		await element.updateComplete;

		const breathingStyle = getComputedStyle( scene, '::before' );

		assert.approximately( sphere.breathProgress, 0.5, 1e-12 );
		assert.approximately(
			Number( getComputedStyle( scene ).getPropertyValue( '--tocus-breath-progress' ) ),
			sphere.breathProgress,
			1e-12,
		);
		assert.notEqual( breathingStyle.opacity, restingOpacity );
		assert.notEqual( breathingStyle.transform, restingTransform );
	} );

	it( 'renders Quiet pause and complete localized strings without shortening the wait', async () => {
		const copy = {
			...TestEnglishLocalizationBundle.interruption,
			formatRemainingTime: formatGermanRemainingTime,
			takeAMoment: 'Nimm dir einen ruhigen Moment, bevor du dich entscheidest',
		};
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				lang="de"
				.mode=${ InterruptionScreenMode.QUIET }
				.copy=${ copy }
				.wellbeingSummary=${ 'Seit du begonnen hast, hast du dir drei Stunden fuer dich genommen.' }
				.focusedProgressMilliseconds=${ 4_000 }
			></tocus-f-interruption-screen>
		` );
		const sphere = getShadowRoot( element ).querySelector( 'tocus-f-breathing-sphere' );
		const scene = getRequiredElement( element, '.scene' );

		assert.notEqual( sphere, null );
		if ( sphere === null ) {
			throw new Error( 'Expected the Quiet screen to render a Breathing Sphere.' );
		}

		assert.equal( getRequiredElement( element, '.cue' ).textContent.trim(), copy.takeAMoment );
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), 'Noch 6 Sekunden' );
		assert.equal( getRequiredElement( element, 'footer' ).textContent.trim(), 'Seit du begonnen hast, hast du dir drei Stunden fuer dich genommen.' );
		assert.equal( getRequiredElement( element, '.sphere-alternative' ).textContent.trim(), copy.stillSphereAlternative );
		assert.equal(
			getRequiredElement( element, '[aria-live]' ).textContent.trim(),
			TestEnglishLocalizationBundle.interruption.waitingStartedAnnouncement,
		);
		assert.notInclude( getRequiredElement( element, '[aria-live]' ).textContent.toLowerCase(), 'breath' );
		assert.equal( sphere.hasAttribute( 'still' ), true );
		assert.equal( sphere.breathProgress, 0 );
		assert.equal( Number( getComputedStyle( scene ).getPropertyValue( '--tocus-breath-progress' ) ), sphere.breathProgress );
		element.state = InterruptionScreenState.READY_EXPIRED;
		await element.updateComplete;
		assert.notInclude( getRequiredElement( element, '.status-message' ).textContent.toLowerCase(), 'breath' );
		await expect( element ).to.be.accessible();
	} );

	it( 'keeps the sphere and scene transitions still for an explicit reduced-motion input', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption } reduced-motion></tocus-f-interruption-screen>
		` );
		const sphere = getRequiredElement( element, 'tocus-f-breathing-sphere' );
		const sphereShell = getRequiredElement( element, '.sphere-shell' );

		assert.equal( sphere.hasAttribute( 'still' ), true );
		assert.equal(
			getRequiredElement( element, '.sphere-alternative' ).textContent.trim(),
			TestEnglishLocalizationBundle.interruption.stillSphereAlternative,
		);
		assert.equal( getComputedStyle( sphereShell ).transitionDuration, '0s' );

		element.state = InterruptionScreenState.UNAVAILABLE;
		await element.updateComplete;

		assert.equal( getComputedStyle( getRetryButton( element ) ).transitionDuration, '0s' );
	} );

	it( 'keeps authoritative Waiting at zero without revealing Continue', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.focusedProgressMilliseconds=${ 10_000 }
				.progressing=${ true }
			></tocus-f-interruption-screen>
		` );

		assert.equal( element.state, InterruptionScreenState.WAITING );
		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '0s remaining' );
		assert.equal( getShadowRoot( element ).querySelector( 'button' ), null );
	} );

	it( 'normalizes non-finite authoritative progress to the start of Waiting', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.focusedProgressMilliseconds=${ Number.NaN }
			></tocus-f-interruption-screen>
		` );

		assert.equal( getRequiredElement( element, '.remaining' ).textContent.trim(), '10s remaining' );
		assert.equal( getRequiredElement( element, '.cue' ).textContent.trim(), 'Breathe in' );
	} );

	it( 'centers and focuses Continue only in the authoritative Ready state', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption } .state=${ InterruptionScreenState.READY }></tocus-f-interruption-screen>
		` );
		const shadowRoot = getShadowRoot( element );
		const button = getContinueButton( element );
		const action = getRequiredElement( element, '.ready-action' );

		await element.updateComplete;
		assert.equal( shadowRoot.activeElement, button );
		assert.equal( button.textContent.trim(), 'Continue' );
		assert.equal( getRequiredElement( element, 'kbd' ).textContent.trim(), 'Space' );
		assert.include( getRequiredElement( element, '.shortcut' ).textContent, 'Or press' );
		assert.equal( shadowRoot.querySelector( '.remaining' ), null );
		assert.equal( shadowRoot.querySelector( '.cue' ), null );
		assert.equal( getRequiredElement( element, '.scene' ).getAttribute( 'tabindex' ), null );
		assert.approximately( action.getBoundingClientRect().left + action.offsetWidth / 2, window.innerWidth / 2, 1 );
		await expect( element ).to.be.accessible();
	} );

	it( 'emits one plain bubbling Continue request from the button', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption } .state=${ InterruptionScreenState.READY }></tocus-f-interruption-screen>
		` );
		const eventPromise = oneEvent( element, InterruptionContinueRequestEventName );

		getContinueButton( element ).click();
		const event = await eventPromise;

		assert.equal( event.bubbles, true );
		assert.equal( event.composed, true );
		assert.equal( event.constructor, Event );
	} );

	it( 'uses native Enter and Space button activation without duplicate requests', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption } .state=${ InterruptionScreenState.READY }></tocus-f-interruption-screen>
		` );
		let requestCount = 0;

		element.addEventListener( InterruptionContinueRequestEventName, () => {
			requestCount += 1;
		} );
		getContinueButton( element ).focus();
		await sendKeys( { press: 'Enter' } );
		await sendKeys( { press: 'Space' } );

		assert.equal( requestCount, 2 );
	} );

	it( 'supports one guarded global Space shortcut in Ready', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption } .state=${ InterruptionScreenState.READY }></tocus-f-interruption-screen>
		` );
		let requestCount = 0;

		element.addEventListener( InterruptionContinueRequestEventName, () => {
			requestCount += 1;
		} );
		getContinueButton( element ).blur();

		const validShortcut = new KeyboardEvent( 'keydown', { cancelable: true, code: 'Space' } );
		window.dispatchEvent( validShortcut );
		window.dispatchEvent( new KeyboardEvent( 'keydown', { code: 'Space', repeat: true } ) );
		window.dispatchEvent( new KeyboardEvent( 'keydown', { code: 'Space', ctrlKey: true } ) );
		window.dispatchEvent( new KeyboardEvent( 'keydown', { code: 'Enter' } ) );

		const preventedShortcut = new KeyboardEvent( 'keydown', { cancelable: true, code: 'Space' } );
		preventedShortcut.preventDefault();
		window.dispatchEvent( preventedShortcut );

		const input = document.createElement( 'input' );
		document.body.append( input );
		input.dispatchEvent( new KeyboardEvent( 'keydown', { bubbles: true, code: 'Space' } ) );
		input.remove();

		getContinueButton( element ).dispatchEvent(
			new KeyboardEvent( 'keydown', { bubbles: true, code: 'Space' } ),
		);

		assert.equal( requestCount, 1 );
		assert.isTrue( validShortcut.defaultPrevented );
	} );

	it( 'removes Continue and focuses stable status after authoritative expiry', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption } .state=${ InterruptionScreenState.READY }></tocus-f-interruption-screen>
		` );
		let requestCount = 0;

		element.addEventListener( InterruptionContinueRequestEventName, () => {
			requestCount += 1;
		} );
		const staleButton = getContinueButton( element );

		element.state = InterruptionScreenState.READY_EXPIRED;
		await element.updateComplete;

		const status = getRequiredElement( element, '.status-message' );

		assert.equal( getShadowRoot( element ).querySelector( 'button' ), null );
		assert.equal( getShadowRoot( element ).activeElement, status );
		assert.equal( status.getAttribute( 'tabindex' ), '-1' );
		assert.equal( status.textContent.trim(), TestEnglishLocalizationBundle.interruption.readyExpiredMessage );
		assert.equal( getRequiredElement( element, '[aria-live]' ).textContent.trim(), '' );
		staleButton.click();
		window.dispatchEvent( new KeyboardEvent( 'keydown', { code: 'Space' } ) );
		assert.equal( requestCount, 0 );
	} );

	it( 'shows a compact branded recovery action when automatic recovery is unavailable', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.state=${ InterruptionScreenState.UNAVAILABLE }
			></tocus-f-interruption-screen>
		` );
		const shadowRoot = getShadowRoot( element );
		const card = getRequiredElement( element, '.recovery-card' );
		const stage = getRequiredElement( element, '.stage' );
		const button = getRetryButton( element );
		const brandIcon = card.querySelector( 'svg' );
		const sphereShell = getRequiredElement( element, '.sphere-shell' );
		const cardBounds = card.getBoundingClientRect();
		const stageBounds = stage.getBoundingClientRect();

		await element.updateComplete;
		assert.equal( shadowRoot.activeElement, button );
		assert.equal( shadowRoot.querySelector( '.continue-button' ), null );
		assert.instanceOf( brandIcon, SVGElement );
		assert.equal( brandIcon.getAttribute( 'viewBox' ), '0 0 64 64' );
		assert.equal( getRequiredElement( element, '.recovery-title' ).textContent.trim(), "Let's try that again" );
		assert.equal( getRequiredElement( element, '.recovery-message' ).textContent.trim(), 'TOCus could not restore this pause.' );
		assert.equal( button.textContent.trim(), 'Try again' );
		assert.isFalse( button.disabled );
		assert.equal( card.getAttribute( 'aria-busy' ), null );
		assert.isBelow( cardBounds.width, stageBounds.width );
		assert.isBelow( cardBounds.height, stageBounds.height );
		assert.notEqual( getComputedStyle( card ).backgroundColor, 'rgba(0, 0, 0, 0)' );
		assert.notEqual( getComputedStyle( card ).borderTopStyle, 'none' );
		assert.equal( getComputedStyle( sphereShell ).opacity, '0' );
		assert.equal(
			getRequiredElement( element, '[aria-live]' ).textContent.trim(),
			'TOCus could not restore this pause.',
		);
		await expect( element ).to.be.accessible();
	} );

	it( 'emits one plain bubbling recovery request from the retry button', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.state=${ InterruptionScreenState.UNAVAILABLE }
			></tocus-f-interruption-screen>
		` );
		const eventPromise = oneEvent( element, InterruptionRetryRequestEventName );

		getRetryButton( element ).click();
		const event = await eventPromise;

		assert.equal( event.bubbles, true );
		assert.equal( event.composed, true );
		assert.equal( event.constructor, Event );
	} );

	it( 'disables repeated recovery requests while recovery is pending', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.state=${ InterruptionScreenState.UNAVAILABLE }
			></tocus-f-interruption-screen>
		` );
		let requestCount = 0;

		element.addEventListener( InterruptionRetryRequestEventName, () => {
			requestCount += 1;
			element.recovering = true;
		} );
		const button = getRetryButton( element );

		button.click();
		await element.updateComplete;
		button.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );

		assert.equal( requestCount, 1 );
		assert.equal( getShadowRoot( element ).activeElement?.className, 'scene' );
		assert.isTrue( button.disabled );
		assert.equal( button.textContent.trim(), 'Trying again...' );
		assert.equal( getRequiredElement( element, '.recovery-card' ).getAttribute( 'aria-busy' ), 'true' );
		assert.equal( getRequiredElement( element, '.scene' ).getAttribute( 'tabindex' ), '0' );
		await expect( element ).to.be.accessible();
	} );

	it( 'restores retry focus after recovery remains unavailable', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.state=${ InterruptionScreenState.UNAVAILABLE }
				.recovering=${ true }
			></tocus-f-interruption-screen>
		` );

		element.recovering = false;
		await element.updateComplete;

		assert.equal( getShadowRoot( element ).activeElement, getRetryButton( element ) );
	} );

	it( 'moves focus to the Waiting scene after recovery succeeds', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.state=${ InterruptionScreenState.UNAVAILABLE }
			></tocus-f-interruption-screen>
		` );

		await element.updateComplete;
		element.state = InterruptionScreenState.WAITING;
		await element.updateComplete;

		assert.equal( getShadowRoot( element ).activeElement?.className, 'scene' );
	} );

	it( 'announces recovery progress and a recoverable failure', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }
				.state=${ InterruptionScreenState.UNAVAILABLE }
			></tocus-f-interruption-screen>
		` );
		const liveRegion = getRequiredElement( element, '[aria-live]' );

		element.recovering = true;
		await element.updateComplete;
		assert.equal( liveRegion.textContent.trim(), 'Trying to restore your pause.' );

		element.recovering = false;
		await element.updateComplete;
		assert.equal( liveRegion.textContent.trim(), 'TOCus still could not restore this pause.' );
	} );

	it( 'places the localized Space key inside a complete shortcut template', async () => {
		const copy = {
			...TestEnglishLocalizationBundle.interruption,
			continueShortcut: 'Oder druecke {key}, wenn du bereit bist',
			spaceKeyLabel: 'Leertaste',
		};
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				.state=${ InterruptionScreenState.READY }
				.copy=${ copy }
			></tocus-f-interruption-screen>
		` );

		assert.equal( getRequiredElement( element, '.shortcut' ).textContent.trim(), 'Oder druecke Leertaste, wenn du bereit bist' );
		assert.equal( getRequiredElement( element, 'kbd' ).textContent.trim(), 'Leertaste' );
	} );

	it( 'keeps a complete shortcut sentence when its key placeholder is omitted', async () => {
		const copy = {
			...TestEnglishLocalizationBundle.interruption,
			continueShortcut: 'Press the shortcut when you are ready',
		};
		const element = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
				.state=${ InterruptionScreenState.READY }
				.copy=${ copy }
			></tocus-f-interruption-screen>
		` );

		assert.equal(
			getRequiredElement( element, '.shortcut' ).textContent.trim(),
			'Press the shortcut when you are ready Space',
		);
	} );

	it( 'maintains brand contrast across every palette and appearance', async () => {
		const themes = [ ThemeMode.LIGHT, ThemeMode.DARK ];

		for ( const theme of themes ) {
			for ( const palette of Object.values( Palette ) ) {
				document.documentElement.setAttribute( 'data-tocus-palette', palette );
				document.documentElement.setAttribute( 'data-tocus-theme', theme );
				await emulateMedia( { colorScheme: theme, forcedColors: 'none' } );
				const element = await fixture<ComponentInterruptionScreen>( html`
					<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }></tocus-f-interruption-screen>
				` );
				const shadowRoot = getShadowRoot( element );
				const scene = getRequiredElement( element, '.scene' );
				const brand = getRequiredElement( element, '.brand' );
				const stageColorProbe = document.createElement( 'span' );

				stageColorProbe.style.backgroundColor = 'var(--tocus-color-stage-start)';
				shadowRoot.append( stageColorProbe );
				assert.include( getComputedStyle( scene ).backgroundImage, 'gradient' );
				assert.isAtLeast(
					getContrastRatio(
						getComputedStyle( brand ).color,
						getComputedStyle( stageColorProbe ).backgroundColor,
					),
					3,
					`${ palette } ${ theme } brand contrast`,
				);
				stageColorProbe.remove();
				element.remove();
			}
		}
	} );

	it( 'keeps long localized content reachable in a short viewport', async () => {
		await setViewport( { height: 320, width: 568 } );

		try {
			const copy = {
				...TestEnglishLocalizationBundle.interruption,
				breatheIn: 'Nimm dir einen langsamen und freundlichen Atemzug, bevor du dich entscheidest',
			};
			const element = await fixture<ComponentInterruptionScreen>( html`
				<tocus-f-interruption-screen
					.copy=${ copy }
					.wellbeingSummary=${ 'Seit du begonnen hast, hast du dir drei Stunden und vierundzwanzig Minuten fuer dich genommen.' }
				></tocus-f-interruption-screen>
			` );
			const scene = getRequiredElement( element, '.scene' );
			const footer = getRequiredElement( element, 'footer' );

			assert.equal( getComputedStyle( scene ).overflowY, 'auto' );
			assert.isAbove( scene.scrollHeight, scene.clientHeight );
			scene.scrollTop = scene.scrollHeight;
			await nextFrame();
			assert.isAbove( scene.scrollTop, 0 );
			assert.isAtMost( footer.getBoundingClientRect().bottom, scene.getBoundingClientRect().bottom + 1 );
			await expect( element ).to.be.accessible();
		} finally {
			await setViewport( { height: 600, width: 800 } );
		}
	} );

	it( 'keeps localized recovery controls reachable in a short viewport', async () => {
		await setViewport( { height: 320, width: 320 } );

		try {
			const copy = {
				...TestEnglishLocalizationBundle.interruption,
				retryLabel: 'Versuche es bitte noch einmal',
				unavailableMessage: 'TOCus konnte diese ruhige Pause gerade nicht wiederherstellen.',
				unavailableTitle: 'Lass es uns noch einmal ganz in Ruhe versuchen',
			};
			const element = await fixture<ComponentInterruptionScreen>( html`
				<tocus-f-interruption-screen
					.state=${ InterruptionScreenState.UNAVAILABLE }
					.copy=${ copy }
				></tocus-f-interruption-screen>
			` );
			const scene = getRequiredElement( element, '.scene' );
			const card = getRequiredElement( element, '.recovery-card' );

			assert.isAbove( scene.scrollHeight, scene.clientHeight );
			assert.isAtMost( card.getBoundingClientRect().width, getRequiredElement( element, '.stage' ).getBoundingClientRect().width );
			scene.scrollTop = scene.scrollHeight;
			await nextFrame();
			assert.isAtMost( card.getBoundingClientRect().bottom, scene.getBoundingClientRect().bottom + 1 );
			assert.equal( getComputedStyle( getRequiredElement( element, '.recovery-title' ) ).overflowWrap, 'anywhere' );
			await expect( element ).to.be.accessible();
		} finally {
			await setViewport( { height: 600, width: 800 } );
		}
	} );

	it( 'retains Waiting meaning and focus visibility in forced colors', async () => {
		await emulateMedia( { colorScheme: 'light', forcedColors: 'active' } );
		const waitingElement = await fixture<ComponentInterruptionScreen>( html`
			<tocus-f-interruption-screen
			.copy=${ TestEnglishLocalizationBundle.interruption }></tocus-f-interruption-screen>
		` );
		const sphereAlternative = getRequiredElement( waitingElement, '.sphere-alternative' );

		assert.notEqual( getComputedStyle( getRequiredElement( waitingElement, '.sphere-shell' ) ).display, 'none' );
		assert.equal( getComputedStyle( getRequiredElement( waitingElement, 'tocus-f-breathing-sphere' ) ).display, 'none' );
		assert.equal(
			sphereAlternative.textContent.trim(),
			TestEnglishLocalizationBundle.interruption.sphereAlternative,
		);
		await expect( waitingElement ).to.be.accessible();

		waitingElement.state = InterruptionScreenState.READY;
		await waitingElement.updateComplete;

		await nextFrame();
		assert.equal( getComputedStyle( getContinueButton( waitingElement ) ).borderStyle, 'solid' );
		await expect( waitingElement ).to.be.accessible();

		waitingElement.state = InterruptionScreenState.UNAVAILABLE;
		await waitingElement.updateComplete;

		assert.equal( getComputedStyle( getRetryButton( waitingElement ) ).borderStyle, 'solid' );
		assert.equal( getComputedStyle( getRequiredElement( waitingElement, '.recovery-icon' ) ).borderStyle, 'solid' );
		await expect( waitingElement ).to.be.accessible();
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentInterruptionScreen>( html`<tocus-f-interruption-screen></tocus-f-interruption-screen>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
