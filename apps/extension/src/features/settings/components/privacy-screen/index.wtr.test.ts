import { assert, expect, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { createTestI18n } from '../../../../localization/__fixtures__';
import { createPrivacyScreenCopy } from '../../../../localization/utils/create-privacy-screen-copy';
import { ComponentPrivacyScreen } from './index';
import { type PrivacyDataActions } from './types';
import './index';

/**
 * Creates successful injected data actions with independent call counters.
 * @return Observable data actions.
 * @since 0.1.0 Initial implementation.
 */
function createActions() {
	return {
		statisticsCalls: 0,
		allCalls: 0,
		/**
		 * Records one statistics reset.
		 * @return Successful completion.
		 * @since 0.1.0 Initial implementation.
		 */
		resetStatistics(): Promise<boolean> {
			this.statisticsCalls += 1;
			return Promise.resolve( true );
		},
		/**
		 * Records one full reset.
		 * @return Successful completion.
		 * @since 0.1.0 Initial implementation.
		 */
		resetAllData(): Promise<boolean> {
			this.allCalls += 1;
			return Promise.resolve( true );
		},
	};
}

/**
 * Renders the localized privacy screen with injected operations.
 * @param actions - Local data actions or an unavailable service.
 * @return Rendered settings screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderScreen( actions: PrivacyDataActions | null = createActions() ): Promise<ComponentPrivacyScreen> {
	return fixture<ComponentPrivacyScreen>( html`
		<tocus-f-privacy-screen .copy=${ createPrivacyScreenCopy( createTestI18n() ) } .actions=${ actions }></tocus-f-privacy-screen>
	` );
}

/**
 * Gets a required action by its stable identifier.
 * @param screen - Rendered screen.
 * @param id - Button identifier.
 * @return Required native button.
 * @since 0.1.0 Initial implementation.
 */
function getButton( screen: ComponentPrivacyScreen, id: string ): HTMLButtonElement {
	const button = screen.shadowRoot?.querySelector( `#${ id }` );
	assert.instanceOf( button, HTMLButtonElement );
	return button;
}

/**
 * Flushes promise completion and its resulting rendered focus change.
 * @param screen - Screen with pending reactive work.
 * @return Completion of the reactive update.
 * @since 0.1.0 Initial implementation.
 */
async function settle( screen: ComponentPrivacyScreen ): Promise<void> {
	await screen.updateComplete;
	await screen.updateComplete;
}

describe( 'tocus-f-privacy-screen', () => {
	it( 'renders nothing until localized copy is ready', async () => {
		const screen = await fixture<ComponentPrivacyScreen>( html`<tocus-f-privacy-screen></tocus-f-privacy-screen>` );
		assert.equal( screen.shadowRoot?.childElementCount, 0 );
	} );

	it( 'explains actual stored data and limits cached favicons to supported browsers', async () => {
		const screen = await renderScreen();
		assert.include( screen.shadowRoot?.textContent ?? '', 'An active pause may temporarily keep its destination address' );
		assert.include( screen.shadowRoot?.textContent ?? '', 'not your saved browsing history' );
		assert.isNull( screen.shadowRoot?.querySelector( '#favicon-permission' ) );
		screen.supportsCachedFavicons = true;
		await screen.updateComplete;
		assert.include( screen.shadowRoot.querySelector( '#favicon-permission' )?.textContent ?? '', 'cached website icons' );
	} );

	it( 'disables both reset actions when their service is unavailable', async () => {
		const screen = await renderScreen( null );
		assert.isTrue( getButton( screen, 'reset-statistics' ).disabled );
		assert.isTrue( getButton( screen, 'reset-all' ).disabled );
		getButton( screen, 'reset-all' ).dispatchEvent( new Event( 'click' ) );
		await screen.updateComplete;
		assert.isNull( screen.shadowRoot?.querySelector( '[role="group"]' ) );
	} );

	for ( const action of [ 'statistics', 'all' ] ) {
		it( `requires confirmation for ${ action } and restores focus on cancellation`, async () => {
			const actions = createActions();
			const screen = await renderScreen( actions );
			const trigger = getButton( screen, `reset-${ action }` );
			trigger.click();
			await settle( screen );
			assert.equal( actions.statisticsCalls + actions.allCalls, 0 );
			assert.equal( screen.shadowRoot?.activeElement, getButton( screen, 'cancel-reset' ) );
			assert.equal( trigger.getAttribute( 'aria-expanded' ), 'true' );
			await expect( screen ).to.be.accessible();
			getButton( screen, 'cancel-reset' ).click();
			await settle( screen );
			assert.isNull( screen.shadowRoot?.querySelector( '[role="group"]' ) );
			assert.equal( screen.shadowRoot.activeElement, trigger );
			assert.equal( actions.statisticsCalls + actions.allCalls, 0 );
		} );

		it( `runs only the confirmed ${ action } operation and announces success`, async () => {
			const actions = createActions();
			const screen = await renderScreen( actions );
			getButton( screen, `reset-${ action }` ).click();
			await settle( screen );
			getButton( screen, 'confirm-reset' ).click();
			await settle( screen );
			assert.equal( actions.statisticsCalls, action === 'statistics' ? 1 : 0 );
			assert.equal( actions.allCalls, action === 'all' ? 1 : 0 );
			assert.include( screen.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '', action === 'statistics' ? 'Statistics reset.' : 'All TOCus data reset.' );
			assert.equal( screen.shadowRoot?.activeElement, getButton( screen, `reset-${ action }` ) );
		} );
	}

	it( 'serializes operations and disables all confirmation controls while pending', async () => {
		let finish!: ( success: boolean ) => void;
		const actions = createActions();
		actions.resetAllData = () => {
			actions.allCalls += 1;
			return new Promise( ( resolve ) => {
				finish = resolve;
			} );
		};
		const screen = await renderScreen( actions );
		getButton( screen, 'reset-all' ).click();
		await settle( screen );
		const confirm = getButton( screen, 'confirm-reset' );
		confirm.dispatchEvent( new Event( 'click' ) );
		confirm.dispatchEvent( new Event( 'click' ) );
		getButton( screen, 'reset-statistics' ).dispatchEvent( new Event( 'click' ) );
		getButton( screen, 'cancel-reset' ).dispatchEvent( new Event( 'click' ) );
		await settle( screen );
		assert.equal( actions.allCalls, 1 );
		assert.equal( actions.statisticsCalls, 0 );
		for ( const button of screen.shadowRoot?.querySelectorAll( 'button' ) ?? [] ) {
			assert.isTrue( button.disabled );
		}
		assert.equal( screen.shadowRoot?.querySelector( 'main' )?.getAttribute( 'aria-busy' ), 'true' );
		finish( true );
		await settle( screen );
		assert.isFalse( getButton( screen, 'reset-statistics' ).disabled );
	} );

	for ( const failure of [ false, new Error( 'Reset unavailable.' ) ] ) {
		it( `keeps a ${ typeof failure === 'boolean' ? 'failed' : 'rejected' } full reset retryable without claiming success`, async () => {
			const actions = createActions();
			actions.resetAllData = () => failure instanceof Error
				? Promise.reject( failure )
				: Promise.resolve( failure );
			const screen = await renderScreen( actions );
			getButton( screen, 'reset-all' ).click();
			await settle( screen );
			getButton( screen, 'confirm-reset' ).click();
			await settle( screen );
			assert.include( screen.shadowRoot?.querySelector( '[role="alert"]' )?.textContent ?? '', 'could not finish' );
			assert.equal( screen.shadowRoot?.querySelector( '[role="status"]' )?.textContent.trim(), '' );
			assert.equal( screen.shadowRoot?.activeElement, getButton( screen, 'confirm-reset' ) );
			assert.include( getButton( screen, 'confirm-reset' ).textContent, 'Try again' );
			actions.resetAllData = () => Promise.resolve( true );
			getButton( screen, 'confirm-reset' ).click();
			await settle( screen );
			assert.include( screen.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '', 'All TOCus data reset.' );
		} );
	}

	it( 'does not reset after its action service disappears before confirmation', async () => {
		const actions = createActions();
		const screen = await renderScreen( actions );
		getButton( screen, 'reset-all' ).click();
		await settle( screen );
		screen.actions = null;
		getButton( screen, 'confirm-reset' ).dispatchEvent( new Event( 'click' ) );
		await settle( screen );
		assert.equal( actions.allCalls, 0 );
	} );

	it( 'ignores events from a dismissed confirmation', async () => {
		const actions = createActions();
		const screen = await renderScreen( actions );
		getButton( screen, 'reset-all' ).click();
		await settle( screen );
		const confirm = getButton( screen, 'confirm-reset' );
		const cancel = getButton( screen, 'cancel-reset' );
		cancel.click();
		await settle( screen );
		confirm.dispatchEvent( new Event( 'click' ) );
		cancel.dispatchEvent( new Event( 'click' ) );
		await settle( screen );
		assert.equal( actions.allCalls, 0 );
		assert.isNull( screen.shadowRoot?.querySelector( '[role="group"]' ) );
	} );

	it( 'updates visible confirmation and status copy without reloading or losing the choice', async () => {
		const screen = await renderScreen();
		getButton( screen, 'reset-statistics' ).click();
		await settle( screen );
		screen.copy = { ...screen.copy, title: 'Localized privacy', statisticsConfirmation: 'Localized confirmation' };
		await screen.updateComplete;
		assert.include( screen.shadowRoot?.querySelector( 'h1' )?.textContent ?? '', 'Localized privacy' );
		assert.include( screen.shadowRoot?.querySelector( '[role="group"]' )?.textContent ?? '', 'Localized confirmation' );
	} );

	it( 'stays accessible and within a narrow container', async () => {
		const screen = await renderScreen();
		screen.style.width = '320px';
		await screen.updateComplete;
		await expect( screen ).to.be.accessible();
		assert.isAtMost( screen.scrollWidth, screen.clientWidth );
	} );

	it( 'keeps confirmation boundaries visible in forced colors', async () => {
		await emulateMedia( { forcedColors: 'active' } );
		try {
			const screen = await renderScreen();
			getButton( screen, 'reset-all' ).click();
			await settle( screen );
			const group = screen.shadowRoot?.querySelector( '[role="group"]' );
			assert.instanceOf( group, HTMLElement );
			assert.equal( getComputedStyle( group ).borderTopStyle, 'solid' );
			assert.equal( getComputedStyle( group ).borderTopWidth, '1px' );
			await expect( screen ).to.be.accessible();
		} finally {
			await emulateMedia( { forcedColors: 'none' } );
		}
	} );
} );
