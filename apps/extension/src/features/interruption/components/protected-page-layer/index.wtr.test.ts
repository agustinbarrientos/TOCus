import { assert, expect, fixture, html, oneEvent } from '@open-wc/testing';
import { ComponentProtectedPageLayer } from './index';
import {
	InterruptionContinueRequestEventName,
	InterruptionScreenState,
} from '../screen/types';
import {
	DefaultProtectedPageLayerCopy,
	ProtectedPageLayerDismissedEventName,
} from './types';

/**
 * Returns the closed shadow root that owns the protected-page presentation.
 * @param element - Rendered protected-page layer.
 * @return Open component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentProtectedPageLayer ): ShadowRoot {
	const shadowRoot = element.getInterruptionScreen().getRootNode();

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the screen to belong to the protected-page shadow root.' );
	}

	return shadowRoot;
}

/**
 * Formats the Spanish allowance warning used to verify complete localized copy.
 * @param remainingSeconds - Whole allowance seconds remaining.
 * @return Complete Spanish warning sentence.
 * @since 0.1.0 Initial implementation.
 */
function formatSpanishAllowanceWarning( remainingSeconds: number ): string {
	return `Tu tiempo termina en ${ String( remainingSeconds ) } s.`;
}

describe( 'tocus-f-protected-page-layer', () => {
	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-protected-page-layer' ), ComponentProtectedPageLayer );
	} );

	it( 'keeps its presentation tree inaccessible to the protected page', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer></tocus-f-protected-page-layer>
		` );

		assert.equal( element.shadowRoot, null );
	} );

	it( 'keeps the quiet warning non-modal and isolated from the host page', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.warningRemainingSeconds=${ 10 }
			></tocus-f-protected-page-layer>
		` );
		const shadowRoot = getShadowRoot( element );
		const warning = shadowRoot.querySelector( '.warning' );
		const announcement = shadowRoot.querySelector( '[role="status"]' );
		const countdown = shadowRoot.querySelector( '[aria-hidden="true"]' );
		const dialog = shadowRoot.querySelector( 'dialog' );

		assert.instanceOf( warning, HTMLElement );
		assert.instanceOf( announcement, HTMLElement );
		assert.instanceOf( countdown, HTMLElement );
		assert.instanceOf( dialog, HTMLDialogElement );
		assert.equal( announcement.textContent.trim(), 'Your visit window is ending soon.' );
		assert.include( countdown.textContent, '10 seconds' );
		assert.equal( dialog.open, false );
		assert.equal( getComputedStyle( element ).getPropertyValue( '--tocus-color-stage-start' ).trim(), '#fff8f0' );
		assert.equal( getComputedStyle( element ).colorScheme, 'light dark' );
		assert.equal( getComputedStyle( warning ).pointerEvents, 'none' );
		await expect( element ).to.be.accessible();
	} );

	it( 'updates visible warning digits without repeatedly changing the live announcement', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.warningRemainingSeconds=${ 10 }
			></tocus-f-protected-page-layer>
		` );
		const shadowRoot = getShadowRoot( element );
		const announcement = shadowRoot.querySelector( '[role="status"]' );
		const countdown = shadowRoot.querySelector( '[aria-hidden="true"]' );

		element.warningRemainingSeconds = 9;
		await element.updateComplete;

		assert.instanceOf( announcement, HTMLElement );
		assert.instanceOf( countdown, HTMLElement );
		assert.equal( announcement.textContent.trim(), 'Your visit window is ending soon.' );
		assert.include( countdown.textContent, '9 seconds' );

		element.warningRemainingSeconds = 1;
		await element.updateComplete;

		assert.include( countdown.textContent, '1 second' );
	} );

	it( 'renders complete injected copy without composing English fragments', async () => {
		const copy = {
			...DefaultProtectedPageLayerCopy,
			allowanceWarningAnnouncement: 'Tu tiempo est\u00e1 por terminar.',
			dialogLabel: 'Pausa de TOCus',
			formatAllowanceWarning: formatSpanishAllowanceWarning,
		};
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.copy=${ copy }
				.warningRemainingSeconds=${ 7 }
			></tocus-f-protected-page-layer>
		` );
		const shadowRoot = getShadowRoot( element );
		const announcement = shadowRoot.querySelector( '[role="status"]' );
		const countdown = shadowRoot.querySelector( '[aria-hidden="true"]' );
		const dialog = shadowRoot.querySelector( 'dialog' );

		assert.instanceOf( announcement, HTMLElement );
		assert.instanceOf( countdown, HTMLElement );
		assert.instanceOf( dialog, HTMLDialogElement );
		assert.equal( announcement.textContent.trim(), 'Tu tiempo est\u00e1 por terminar.' );
		assert.equal( countdown.textContent.trim(), 'Tu tiempo termina en 7 s.' );
		assert.equal( dialog.getAttribute( 'aria-label' ), 'Pausa de TOCus' );
	} );

	it( 'opens a native modal layer and restores the live document focus after dismissal', async () => {
		const field = document.createElement( 'input' );
		field.value = 'Unsaved text';
		document.body.append( field );
		field.focus();
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer></tocus-f-protected-page-layer>
		` );

		element.interruptionLayerPresented = true;
		await element.updateComplete;

		const dialog = getShadowRoot( element ).querySelector( 'dialog' );

		assert.instanceOf( dialog, HTMLDialogElement );
		assert.equal( dialog.open, true );
		assert.equal( dialog.getAttribute( 'aria-modal' ), 'true' );
		assert.equal( element.isInterruptionPresentationVisible(), true );
		await element.waitForInterruptionPresentation();
		assert.equal( getComputedStyle( dialog ).animationName, 'protected-page-layer-enter' );
		assert.equal( field.value, 'Unsaved text' );

		element.interruptionLayerPresented = false;
		await element.updateComplete;

		assert.equal( dialog.open, false );
		assert.equal( document.activeElement, field );
		assert.equal( field.value, 'Unsaved text' );
		field.remove();
	} );

	it( 'rejects presentation readiness while its modal is not requested', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer></tocus-f-protected-page-layer>
		` );
		let rejection: unknown;

		try {
			await element.waitForInterruptionPresentation();
		} catch ( error ) {
			rejection = error;
		}

		assert.instanceOf( rejection, Error );
		assert.equal( element.isInterruptionPresentationVisible(), false );
	} );

	it( 'restores the deeply focused control inside an open shadow root', async () => {
		const host = document.createElement( 'div' );
		const hostShadowRoot = host.attachShadow( { mode: 'open' } );
		const field = document.createElement( 'input' );

		hostShadowRoot.append( field );
		document.body.append( host );
		field.focus();
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer></tocus-f-protected-page-layer>
		` );

		element.interruptionLayerPresented = true;
		await element.updateComplete;
		element.interruptionLayerPresented = false;
		await element.updateComplete;

		assert.equal( document.activeElement, host );
		assert.equal( hostShadowRoot.activeElement, field );
		host.remove();
	} );

	it( 'moves focus to the document when the previous focus owner was removed', async () => {
		const field = document.createElement( 'input' );

		document.body.append( field );
		field.focus();
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer></tocus-f-protected-page-layer>
		` );

		element.interruptionLayerPresented = true;
		await element.updateComplete;
		field.remove();
		element.interruptionLayerPresented = false;
		await element.updateComplete;

		assert.equal( document.activeElement, document.body );
		assert.equal( document.body.hasAttribute( 'tabindex' ), false );
	} );

	it( 'preserves an existing document focus fallback tab index', async () => {
		const graphic = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );

		graphic.setAttribute( 'tabindex', '0' );
		document.body.setAttribute( 'tabindex', '2' );
		document.body.append( graphic );
		graphic.focus();
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer></tocus-f-protected-page-layer>
		` );

		element.interruptionLayerPresented = true;
		await element.updateComplete;
		element.interruptionLayerPresented = false;
		await element.updateComplete;

		assert.equal( document.activeElement, document.body );
		assert.equal( document.body.getAttribute( 'tabindex' ), '2' );
		graphic.remove();
		document.body.removeAttribute( 'tabindex' );
	} );

	it( 'does not capture Space after the injected interruption is dismissed', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		const screen = element.getInterruptionScreen();
		let requestCount = 0;
		/**
		 * Records one unexpected Continue shortcut request.
		 * @since 0.1.0 Initial implementation.
		 */
		function recordContinueRequest(): void {
			requestCount += 1;
		}

		screen.state = InterruptionScreenState.READY;
		screen.addEventListener( InterruptionContinueRequestEventName, recordContinueRequest );
		await screen.updateComplete;
		element.interruptionLayerPresented = false;
		await element.updateComplete;

		const shortcut = new KeyboardEvent( 'keydown', { cancelable: true, code: 'Space' } );

		window.dispatchEvent( shortcut );

		assert.equal( requestCount, 0 );
		assert.equal( shortcut.defaultPrevented, false );
	} );

	it( 'prevents Escape from bypassing the modal interruption', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		const dialog = getShadowRoot( element ).querySelector( 'dialog' );
		const cancelEvent = new Event( 'cancel', { cancelable: true } );

		dialog?.dispatchEvent( cancelEvent );

		assert.equal( cancelEvent.defaultPrevented, true );
		assert.equal( dialog?.open, true );
	} );

	it( 'repairs unexpected native closure without crediting hidden progress', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		const screen = element.getInterruptionScreen();
		const dialog = getShadowRoot( element ).querySelector( 'dialog' );

		assert.instanceOf( dialog, HTMLDialogElement );
		screen.progressing = true;
		const closeEvent = oneEvent( dialog, 'close' );

		dialog.close();
		await closeEvent;

		assert.equal( screen.progressing, false );
		assert.equal( dialog.open, true );
	} );

	it( 'pauses local progress when the host layer is removed', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		const screen = element.getInterruptionScreen();

		screen.progressing = true;
		element.remove();

		assert.equal( screen.progressing, false );
	} );

	it( 'reattaches the guarded host and restores its native modal after removal', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		const screen = element.getInterruptionScreen();
		const dialog = getShadowRoot( element ).querySelector( 'dialog' );

		assert.instanceOf( dialog, HTMLDialogElement );
		element.connectionGuardEnabled = true;
		screen.progressing = true;
		element.remove();
		await Promise.resolve();
		await element.updateComplete;

		assert.equal( element.isConnected, true );
		assert.equal( screen.progressing, false );
		assert.equal( dialog.open, true );

		element.connectionGuardEnabled = false;
		element.remove();
	} );

	it( 'reports native dismissal so the controller can release listeners', async () => {
		const element = await fixture<ComponentProtectedPageLayer>( html`
			<tocus-f-protected-page-layer
				.interruptionLayerPresented=${ true }
			></tocus-f-protected-page-layer>
		` );
		const eventPromise = oneEvent( element, ProtectedPageLayerDismissedEventName );

		element.interruptionLayerPresented = false;
		await element.updateComplete;

		const event = await eventPromise;

		assert.equal( event.bubbles, true );
		assert.equal( event.composed, true );
	} );
} );
