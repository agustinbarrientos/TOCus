import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import { createTestI18n } from '../../../../localization/__fixtures__';
import { createPrivacyScreenCopy } from '../../../../localization/utils/create-privacy-screen-copy';
import { type ComponentPrivacyScreen } from './index';
import { type PrivacyDataActions } from './types';
import './index';

/**
 * Successful local actions for deterministic visual states.
 * @since 0.1.0 Initial implementation.
 */
const VISUAL_ACTIONS: PrivacyDataActions = {
	/**
	 * Completes a statistics reset successfully.
	 * @return Successful completion.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics: () => Promise.resolve( true ),
	/**
	 * Completes a full reset successfully.
	 * @return Successful completion.
	 * @since 0.1.0 Initial implementation.
	 */
	resetAllData: () => Promise.resolve( true ),
};

/**
 * Renders the screen inside a neutral full-page settings surface.
 * @param actions - Operations used by interactive visual states.
 * @param width - Width of the surrounding surface.
 * @return Visual surface and rendered privacy screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderScreen( actions: PrivacyDataActions | null = VISUAL_ACTIONS, width = '768px' ) {
	const wrapper = await fixture<HTMLElement>( html`
		<div style="box-sizing: border-box; width: ${ width }; padding: 24px; background: var(--tocus-color-surface-lowest)">
			<tocus-f-privacy-screen
				.copy=${ createPrivacyScreenCopy( createTestI18n() ) }
				.actions=${ actions }
				.supportsCachedFavicons=${ true }
			></tocus-f-privacy-screen>
		</div>
	` );
	const screen = wrapper.querySelector( 'tocus-f-privacy-screen' );
	assert.exists( screen );
	await screen.updateComplete;
	await document.fonts.ready;
	return { wrapper, screen };
}

/**
 * Clicks one rendered privacy action and waits for its visible result.
 * @param screen - Screen containing the action.
 * @param id - Action identifier.
 * @return Completion of reactive operation updates.
 * @since 0.1.0 Initial implementation.
 */
async function clickAction( screen: ComponentPrivacyScreen, id: string ): Promise<void> {
	const button = screen.shadowRoot?.querySelector( `#${ id }` );
	assert.instanceOf( button, HTMLButtonElement );
	button.click();
	await screen.updateComplete;
	await screen.updateComplete;
}

describe( 'tocus-f-privacy-screen visual', () => {
	beforeEach( async () => {
		await setViewport( { width: 900, height: 1_200 } );
		await emulateMedia( { colorScheme: 'light', reducedMotion: 'reduce' } );
		document.documentElement.setAttribute( 'data-tocus-theme', 'light' );
	} );

	afterEach( async () => {
		document.documentElement.removeAttribute( 'data-tocus-theme' );
		await emulateMedia( { colorScheme: 'light', reducedMotion: 'no-preference' } );
		await setViewport( { width: 800, height: 600 } );
	} );

	for ( const theme of [ 'light', 'dark' ] ) {
		it( `matches the ${ theme } appearance`, async () => {
			document.documentElement.setAttribute( 'data-tocus-theme', theme );
			const { wrapper } = await renderScreen();
			await visualDiff( wrapper, `privacy-screen-${ theme }` );
		} );
	}

	it( 'matches expanded browser permission explanations', async () => {
		const { wrapper, screen } = await renderScreen();
		const details = screen.shadowRoot?.querySelector( 'details' );
		assert.instanceOf( details, HTMLDetailsElement );
		details.open = true;
		await visualDiff( wrapper, 'privacy-screen-permissions-light' );
	} );

	it( 'matches statistics reset confirmation', async () => {
		const { wrapper, screen } = await renderScreen();
		await clickAction( screen, 'reset-statistics' );
		await visualDiff( wrapper, 'privacy-screen-statistics-confirmation-light' );
	} );

	it( 'matches full reset confirmation', async () => {
		const { wrapper, screen } = await renderScreen();
		await clickAction( screen, 'reset-all' );
		await visualDiff( wrapper, 'privacy-screen-all-confirmation-light' );
	} );

	it( 'matches a pending full reset', async () => {
		const pending = Promise.withResolvers<boolean>();
		const { wrapper, screen } = await renderScreen( {
			...VISUAL_ACTIONS,
			/**
			 * Keeps the reset pending during screenshot capture.
			 * @return Deferred completion.
			 * @since 0.1.0 Initial implementation.
			 */
			resetAllData: () => pending.promise,
		} );
		await clickAction( screen, 'reset-all' );
		await clickAction( screen, 'confirm-reset' );
		await visualDiff( wrapper, 'privacy-screen-pending-light' );
		pending.resolve( true );
		await screen.updateComplete;
	} );

	it( 'matches a failed full reset', async () => {
		document.documentElement.setAttribute( 'data-tocus-theme', 'dark' );
		const { wrapper, screen } = await renderScreen( {
			...VISUAL_ACTIONS,
			/**
			 * Returns an unsuccessful reset result.
			 * @return Failed completion.
			 * @since 0.1.0 Initial implementation.
			 */
			resetAllData: () => Promise.resolve( false ),
		} );
		await clickAction( screen, 'reset-all' );
		await clickAction( screen, 'confirm-reset' );
		await visualDiff( wrapper, 'privacy-screen-failed-dark' );
	} );

	it( 'matches a successful statistics reset', async () => {
		const { wrapper, screen } = await renderScreen();
		await clickAction( screen, 'reset-statistics' );
		await clickAction( screen, 'confirm-reset' );
		await visualDiff( wrapper, 'privacy-screen-success-light' );
	} );

	it( 'matches unavailable controls', async () => {
		const { wrapper } = await renderScreen( null );
		await visualDiff( wrapper, 'privacy-screen-unavailable-light' );
	} );

	it( 'matches narrow full reset confirmation', async () => {
		await setViewport( { width: 380, height: 1_200 } );
		const { wrapper, screen } = await renderScreen( VISUAL_ACTIONS, '100%' );
		await clickAction( screen, 'reset-all' );
		await visualDiff( wrapper, 'privacy-screen-narrow-light' );
	} );
} );
