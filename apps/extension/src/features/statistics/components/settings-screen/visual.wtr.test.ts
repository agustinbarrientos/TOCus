import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import './index';
import { type ComponentStatisticsSettingsScreen } from './index';
import { type StatisticsSource } from './types';

/**
 * Populated projection rendered by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const VISUAL_PROJECTION: StatisticsProjection = {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: 12_420_000,
	focusedPauseMilliseconds: 1_620_000,
	reconsideredVisitCount: 18,
	completedWaitCount: 24,
	allowanceGrantedCount: 11,
};

/**
 * Empty projection rendered by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const EMPTY_VISUAL_PROJECTION: StatisticsProjection = {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: null,
	focusedPauseMilliseconds: 0,
	reconsideredVisitCount: 0,
	completedWaitCount: 0,
	allowanceGrantedCount: 0,
};

/**
 * Returns the populated deterministic visual projection.
 * @return Populated all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function readStatistics(): Promise<StatisticsProjection> {
	return Promise.resolve( VISUAL_PROJECTION );
}

/**
 * Returns the unchanged visual projection for the unused reset action.
 * @return Populated all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function resetStatistics(): Promise<StatisticsProjection> {
	return Promise.resolve( VISUAL_PROJECTION );
}

/**
 * Returns the deterministic empty visual projection.
 * @return Empty all-time statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function readEmptyStatistics(): Promise<StatisticsProjection> {
	return Promise.resolve( EMPTY_VISUAL_PROJECTION );
}

/**
 * Returns an unavailable visual projection without fabricated metrics.
 * @return Unavailable statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function readUnavailableStatistics(): Promise<StatisticsProjection> {
	return Promise.resolve( { status: StatisticsProjectionStatus.UNAVAILABLE } );
}

/**
 * Keeps one visual statistics operation pending.
 * @return Pending statistics projection.
 * @since 0.1.0 Initial implementation.
 */
function readPendingStatistics(): Promise<StatisticsProjection> {
	return Promise.withResolvers<StatisticsProjection>().promise;
}

/**
 * Ignores one statistics-change listener in a deterministic visual fixture.
 * @param listener - Unused statistics-change listener.
 * @since 0.1.0 Initial implementation.
 */
function addStatisticsChangeListener( listener: () => void ): void {
	void listener;
}

/**
 * Ignores removal of one statistics-change listener in a deterministic visual fixture.
 * @param listener - Unused statistics-change listener.
 * @since 0.1.0 Initial implementation.
 */
function removeStatisticsChangeListener( listener: () => void ): void {
	void listener;
}

/**
 * Populated source used by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const VISUAL_SOURCE: StatisticsSource = {
	addStatisticsChangeListener,
	readStatistics,
	removeStatisticsChangeListener,
	resetStatistics,
};

/**
 * Empty source used by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const EMPTY_VISUAL_SOURCE: StatisticsSource = {
	addStatisticsChangeListener,
	readStatistics: readEmptyStatistics,
	removeStatisticsChangeListener,
	resetStatistics,
};

/**
 * Unavailable source used by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const UNAVAILABLE_VISUAL_SOURCE: StatisticsSource = {
	addStatisticsChangeListener,
	readStatistics: readUnavailableStatistics,
	removeStatisticsChangeListener,
	resetStatistics,
};

/**
 * Pending-read source used by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const LOADING_VISUAL_SOURCE: StatisticsSource = {
	addStatisticsChangeListener,
	readStatistics: readPendingStatistics,
	removeStatisticsChangeListener,
	resetStatistics,
};

/**
 * Pending-reset source used by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const RESETTING_VISUAL_SOURCE: StatisticsSource = {
	addStatisticsChangeListener,
	readStatistics,
	removeStatisticsChangeListener,
	resetStatistics: readPendingStatistics,
};

/**
 * Failed-reset source used by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const RESET_FAILURE_VISUAL_SOURCE: StatisticsSource = {
	addStatisticsChangeListener,
	readStatistics,
	removeStatisticsChangeListener,
	resetStatistics: readUnavailableStatistics,
};

/**
 * Color schemes covered by statistics visual tests.
 * @since 0.1.0 Initial implementation.
 */
const VISUAL_THEMES = [ 'light', 'dark' ] as const;

/**
 * Renders one settled Statistics screen at the requested content width.
 * @param source - Statistics source that controls the rendered state.
 * @param width - Host width used by the visual case.
 * @return Connected and ready Statistics screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderStatisticsScreen(
	source: StatisticsSource = VISUAL_SOURCE,
	width = '48rem',
): Promise<ComponentStatisticsSettingsScreen> {
	const element = await fixture<ComponentStatisticsSettingsScreen>( html`
		<tocus-f-statistics-settings-screen
			style=${ `width: ${ width };` }
			.source=${ source }
		></tocus-f-statistics-settings-screen>
	` );

	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;

	return element;
}

/**
 * Configures one deterministic explicit visual appearance.
 * @param theme - Explicit light or dark theme.
 * @return Promise resolved after browser media emulation is applied.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance( theme: typeof VISUAL_THEMES[ number ] ): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
	await setViewport( { height: 1_200, width: 1_280 } );
	await emulateMedia( {
		colorScheme: theme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-statistics-settings-screen visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'Statistics' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( async () => {
		document.documentElement.removeAttribute( 'data-tocus-theme' );
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		await emulateMedia( {
			colorScheme: 'light',
			forcedColors: 'none',
			reducedMotion: 'no-preference',
		} );
	} );

	for ( const theme of VISUAL_THEMES ) {
		it( `matches the populated ${ theme } appearance`, async () => {
			await configureAppearance( theme );
			const element = await renderStatisticsScreen();

			await visualDiff( element, `statistics-settings-screen-populated-${ theme }` );
		} );
	}

	it( 'matches the empty light appearance', async () => {
		await configureAppearance( 'light' );
		const element = await renderStatisticsScreen( EMPTY_VISUAL_SOURCE );

		await visualDiff( element, 'statistics-settings-screen-empty-light' );
	} );

	it( 'matches the unavailable dark appearance', async () => {
		await configureAppearance( 'dark' );
		const element = await renderStatisticsScreen( UNAVAILABLE_VISUAL_SOURCE );

		await visualDiff( element, 'statistics-settings-screen-unavailable-dark' );
	} );

	it( 'matches the loading light appearance', async () => {
		await configureAppearance( 'light' );
		const element = await renderStatisticsScreen( LOADING_VISUAL_SOURCE );

		await visualDiff( element, 'statistics-settings-screen-loading-light' );
	} );

	it( 'matches the unavailable reset confirmation appearance', async () => {
		await configureAppearance( 'dark' );
		const element = await renderStatisticsScreen( UNAVAILABLE_VISUAL_SOURCE );
		const resetAction = element.shadowRoot?.querySelector( '.reset-action' );

		assert.instanceOf( resetAction, HTMLButtonElement );
		resetAction.click();
		await element.updateComplete;

		await visualDiff( element, 'statistics-settings-screen-unavailable-reset-confirmation-dark' );
	} );

	it( 'matches the reset confirmation appearance', async () => {
		await configureAppearance( 'light' );
		const element = await renderStatisticsScreen();
		const resetAction = element.shadowRoot?.querySelector( '.reset-action' );

		assert.instanceOf( resetAction, HTMLButtonElement );
		resetAction.click();
		await element.updateComplete;

		await visualDiff( element, 'statistics-settings-screen-reset-confirmation-light' );
	} );

	it( 'matches the resetting light appearance', async () => {
		await configureAppearance( 'light' );
		const element = await renderStatisticsScreen( RESETTING_VISUAL_SOURCE );
		const resetAction = element.shadowRoot?.querySelector( '.reset-action' );

		assert.instanceOf( resetAction, HTMLButtonElement );
		resetAction.click();
		await element.updateComplete;
		const confirmAction = element.shadowRoot?.querySelector( '.confirm-reset-action' );
		assert.instanceOf( confirmAction, HTMLButtonElement );
		confirmAction.click();
		await element.updateComplete;

		await visualDiff( element, 'statistics-settings-screen-resetting-light' );
	} );

	it( 'matches the reset-failure dark appearance', async () => {
		await configureAppearance( 'dark' );
		const element = await renderStatisticsScreen( RESET_FAILURE_VISUAL_SOURCE );
		const resetAction = element.shadowRoot?.querySelector( '.reset-action' );

		assert.instanceOf( resetAction, HTMLButtonElement );
		resetAction.click();
		await element.updateComplete;
		const confirmAction = element.shadowRoot?.querySelector( '.confirm-reset-action' );
		assert.instanceOf( confirmAction, HTMLButtonElement );
		confirmAction.click();
		await new Promise<void>( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
		await element.updateComplete;

		await visualDiff( element, 'statistics-settings-screen-reset-failure-dark' );
	} );

	it( 'matches the narrow responsive appearance', async () => {
		await configureAppearance( 'light' );
		await setViewport( { height: 1_200, width: 420 } );
		const element = await renderStatisticsScreen( VISUAL_SOURCE, '100%' );

		await visualDiff( element, 'statistics-settings-screen-narrow-light' );
	} );
} );
