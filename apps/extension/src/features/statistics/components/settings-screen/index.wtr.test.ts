import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import { ComponentStatisticsSettingsScreen } from './index';
import {
	type StatisticsSource,
} from './types';

/**
 * Populated statistics projection used by component tests.
 * @since 0.1.0 Initial implementation.
 */
const POPULATED_PROJECTION: StatisticsProjection = {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: 5_400_000,
	focusedPauseMilliseconds: 7_200_000,
	reconsideredVisitCount: 12,
	completedWaitCount: 8,
	allowanceGrantedCount: 5,
};

/**
 * Empty statistics projection used by component tests.
 * @since 0.1.0 Initial implementation.
 */
const EMPTY_PROJECTION: StatisticsProjection = {
	status: StatisticsProjectionStatus.AVAILABLE,
	estimatedReclaimedMilliseconds: null,
	focusedPauseMilliseconds: 0,
	reconsideredVisitCount: 0,
	completedWaitCount: 0,
	allowanceGrantedCount: 0,
};

/**
 * In-memory source with controllable statistics read and reset outcomes.
 * @since 0.1.0 Initial implementation.
 */
class MemoryStatisticsSource implements StatisticsSource {
	/**
	 * Statistics-change listeners registered with the source.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly listeners = new Set<() => void>();

	reads = 0;

	resets = 0;

	rejectReads = false;

	rejectResets = false;

	/**
	 * Creates a source around independently controllable responses.
	 * @param readResult - Value returned by statistics reads.
	 * @param resetResult - Value returned by statistics resets.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor(
		public readResult: unknown,
		public resetResult: unknown = readResult,
	) {}

	/**
	 * Returns or rejects the configured statistics read.
	 * @return Configured statistics projection candidate.
	 * @since 0.1.0 Initial implementation.
	 */
	readStatistics(): Promise<StatisticsProjection> {
		this.reads += 1;

		if ( this.rejectReads ) {
			return Promise.reject( new Error( 'Statistics read unavailable.' ) );
		}

		return Promise.resolve( this.readResult as StatisticsProjection );
	}

	/**
	 * Returns or rejects the configured reset response.
	 * @return Configured post-reset projection candidate.
	 * @since 0.1.0 Initial implementation.
	 */
	resetStatistics(): Promise<StatisticsProjection> {
		this.resets += 1;

		if ( this.rejectResets ) {
			return Promise.reject( new Error( 'Statistics reset unavailable.' ) );
		}

		return Promise.resolve( this.resetResult as StatisticsProjection );
	}

	/**
	 * Begins notifying one statistics-change listener.
	 * @param listener - Listener notified after a local statistics change.
	 * @since 0.1.0 Initial implementation.
	 */
	addStatisticsChangeListener( listener: () => void ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops notifying one statistics-change listener.
	 * @param listener - Previously subscribed listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removeStatisticsChangeListener( listener: () => void ): void {
		this.listeners.delete( listener );
	}

	/**
	 * Notifies active listeners that authoritative statistics changed.
	 * @since 0.1.0 Initial implementation.
	 */
	emitChange(): void {
		for ( const listener of this.listeners ) {
			listener();
		}
	}
}

/**
 * In-memory source that keeps its initial statistics read pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredReadStatisticsSource extends MemoryStatisticsSource {
	private resolvePendingRead: ( ( projection: StatisticsProjection ) => void ) | null = null;

	/**
	 * Keeps the current statistics read pending.
	 * @return Promise settled after the fixture releases the read.
	 * @since 0.1.0 Initial implementation.
	 */
	override readStatistics(): Promise<StatisticsProjection> {
		this.reads += 1;

		return new Promise<StatisticsProjection>( ( resolve ) => {
			this.resolvePendingRead = resolve;
		} );
	}

	/**
	 * Completes the pending statistics read.
	 * @param projection - Projection returned to the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	completeRead( projection: StatisticsProjection ): void {
		if ( this.resolvePendingRead === null ) {
			throw new Error( 'Expected one pending Statistics screen read.' );
		}

		this.resolvePendingRead( projection );
		this.resolvePendingRead = null;
	}
}

/**
 * In-memory source that keeps one reset request pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredResetStatisticsSource extends MemoryStatisticsSource {
	private resolvePendingReset: ( ( projection: StatisticsProjection ) => void ) | null = null;

	/**
	 * Keeps one statistics reset pending.
	 * @return Promise settled after the fixture releases the reset.
	 * @since 0.1.0 Initial implementation.
	 */
	override resetStatistics(): Promise<StatisticsProjection> {
		this.resets += 1;

		return new Promise<StatisticsProjection>( ( resolve ) => {
			this.resolvePendingReset = resolve;
		} );
	}

	/**
	 * Completes the pending reset with its authoritative projection.
	 * @param projection - Projection returned after reset.
	 * @since 0.1.0 Initial implementation.
	 */
	completeReset( projection: StatisticsProjection ): void {
		if ( this.resolvePendingReset === null ) {
			throw new Error( 'Expected one pending Statistics screen reset.' );
		}

		this.resolvePendingReset( projection );
		this.resolvePendingReset = null;
	}
}

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Returns one required element from the Statistics screen shadow tree.
 * @param element - Rendered Statistics settings screen.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<T extends Element>(
	element: ComponentStatisticsSettingsScreen,
	selector: string,
	expectedType: ElementConstructor<T>,
): T {
	const match = element.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the Statistics screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Waits for one asynchronous source operation and Lit update.
 * @param element - Statistics screen expected to update.
 * @return Promise resolved after asynchronous rendering settles.
 * @since 0.1.0 Initial implementation.
 */
async function settleScreen( element: ComponentStatisticsSettingsScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

/**
 * Renders one Statistics screen around the supplied source.
 * @param source - Authoritative statistics source.
 * @return Settled Statistics screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderScreen( source: StatisticsSource ): Promise<ComponentStatisticsSettingsScreen> {
	const element = await fixture<ComponentStatisticsSettingsScreen>( html`
		<tocus-f-statistics-settings-screen
			.copy=${ TestEnglishLocalizationBundle.statistics }
			.source=${ source }
		></tocus-f-statistics-settings-screen>
	` );
	await settleScreen( element );

	return element;
}

/**
 * Formats a duration as a deterministic estimated fixture value.
 * @param milliseconds - Duration supplied by the screen.
 * @return Test-only estimated duration.
 * @since 0.1.0 Initial implementation.
 */
function formatTestEstimatedDuration( milliseconds: number ): string {
	return `estimated:${ String( milliseconds ) }`;
}

/**
 * Formats a duration as a deterministic fixture value.
 * @param milliseconds - Duration supplied by the screen.
 * @return Test-only duration.
 * @since 0.1.0 Initial implementation.
 */
function formatTestDuration( milliseconds: number ): string {
	return `duration:${ String( milliseconds ) }`;
}

/**
 * Formats a count as a deterministic fixture value.
 * @param count - Count supplied by the screen.
 * @return Test-only count.
 * @since 0.1.0 Initial implementation.
 */
function formatTestCount( count: number ): string {
	return `count:${ String( count ) }`;
}

describe( 'tocus-f-statistics-settings-screen', () => {
	it( 'shows recovery without fabricating metrics when no source is available', async () => {
		const element = await fixture<ComponentStatisticsSettingsScreen>( html`
			<tocus-f-statistics-settings-screen
			.copy=${ TestEnglishLocalizationBundle.statistics }></tocus-f-statistics-settings-screen>
		` );
		await settleScreen( element );

		assert.instanceOf( element.shadowRoot?.querySelector( '.load-error' ), HTMLElement );
		assert.equal( getRequiredElement( element, 'main', HTMLElement ).querySelectorAll( 'dd' ).length, 0 );
	} );

	it( 'keeps metrics hidden and marks the screen busy while statistics load', async () => {
		const source = new DeferredReadStatisticsSource( POPULATED_PROJECTION );
		const element = await fixture<ComponentStatisticsSettingsScreen>( html`
			<tocus-f-statistics-settings-screen
			.copy=${ TestEnglishLocalizationBundle.statistics }
				.source=${ source }
			></tocus-f-statistics-settings-screen>
		` );
		await element.updateComplete;
		await Promise.resolve();

		assert.equal( getRequiredElement( element, 'main', HTMLElement ).getAttribute( 'aria-busy' ), 'true' );
		assert.equal( getRequiredElement( element, '.loading-status', HTMLParagraphElement ).getAttribute( 'role' ), 'status' );
		assert.equal( element.shadowRoot?.querySelectorAll( 'dd' ).length, 0 );

		source.completeRead( POPULATED_PROJECTION );
		await settleScreen( element );

		assert.equal( getRequiredElement( element, 'main', HTMLElement ).getAttribute( 'aria-busy' ), 'false' );
		assert.equal( element.shadowRoot?.querySelectorAll( 'dd' ).length, 5 );
	} );

	it( 'loads a source assigned after first render and ignores the older pending read', async () => {
		const oldSource = new DeferredReadStatisticsSource( POPULATED_PROJECTION );
		const currentProjection: StatisticsProjection = {
			...POPULATED_PROJECTION,
			reconsideredVisitCount: 42,
		};
		const element = await fixture<ComponentStatisticsSettingsScreen>( html`
			<tocus-f-statistics-settings-screen
			.copy=${ TestEnglishLocalizationBundle.statistics }
				.source=${ oldSource }
			></tocus-f-statistics-settings-screen>
		` );
		await element.updateComplete;
		await Promise.resolve();

		element.source = new MemoryStatisticsSource( currentProjection );
		await settleScreen( element );
		assert.equal( Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [] )[ 2 ]?.textContent.trim(), '42' );

		oldSource.completeRead( POPULATED_PROJECTION );
		await settleScreen( element );

		assert.equal( Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [] )[ 2 ]?.textContent.trim(), '42' );
	} );

	it( 'refreshes the authoritative projection after reconnecting', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );
		const fixtureParent = element.parentElement;
		assert.instanceOf( fixtureParent, HTMLElement );
		if ( ! ( fixtureParent instanceof HTMLElement ) ) {
			throw new TypeError( 'Expected the Statistics screen fixture wrapper.' );
		}

		element.remove();
		source.readResult = {
			...POPULATED_PROJECTION,
			completedWaitCount: 99,
		};
		fixtureParent.append( element );
		await settleScreen( element );

		assert.equal( source.reads, 2 );
		assert.equal(
			Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [] )[ 3 ]?.textContent.trim(),
			'99',
		);
	} );

	it( 'refreshes an open screen after authoritative local statistics change', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );

		source.readResult = {
			...POPULATED_PROJECTION,
			reconsideredVisitCount: 99,
		};
		source.emitChange();
		await settleScreen( element );

		assert.equal( source.reads, 2 );
		assert.equal( Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [] )[ 2 ]?.textContent.trim(), '99' );
	} );

	it( 'keeps an open reset confirmation while refreshing changed statistics', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );

		getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
		await element.updateComplete;
		source.readResult = {
			...POPULATED_PROJECTION,
			completedWaitCount: 99,
		};
		source.emitChange();
		await settleScreen( element );

		assert.instanceOf( element.shadowRoot?.querySelector( '.reset-confirmation' ), HTMLElement );
		assert.equal( Array.from( element.shadowRoot.querySelectorAll( 'dd' ) )[ 3 ]?.textContent.trim(), '99' );
	} );

	it( 'moves focus to retry when a background refresh closes reset confirmation', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );

		getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
		await element.updateComplete;
		assert.equal(
			element.shadowRoot?.activeElement?.className,
			'confirm-reset-action',
		);

		source.rejectReads = true;
		source.emitChange();
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement?.className,
			'retry-action',
		);
	} );

	it( 'renders exactly the five approved all-time metrics in their approved order', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );
		const terms = element.shadowRoot?.querySelectorAll( 'dt' );
		const values = element.shadowRoot?.querySelectorAll( 'dd' );

		assert.equal( customElements.get( 'tocus-f-statistics-settings-screen' ), ComponentStatisticsSettingsScreen );
		assert.equal( source.reads, 1 );
		assert.deepEqual(
			Array.from( terms ?? [], ( term ) => term.textContent.trim() ),
			[
				'Estimated time reclaimed',
				'Time you took to pause',
				'Reconsidered visits',
				'Completed waits',
				'Allowances granted',
			],
		);
		assert.deepEqual(
			Array.from( values ?? [], ( value ) => value.textContent.trim() ),
			[
				TestEnglishLocalizationBundle.statistics.formatEstimatedDuration( 5_400_000 ),
				TestEnglishLocalizationBundle.statistics.formatDuration( 7_200_000 ),
				TestEnglishLocalizationBundle.statistics.formatCount( 12 ),
				TestEnglishLocalizationBundle.statistics.formatCount( 8 ),
				TestEnglishLocalizationBundle.statistics.formatCount( 5 ),
			],
		);
		assert.notInclude( getRequiredElement( element, 'main', HTMLElement ).textContent, 'at least' );
		assert.include(
			getRequiredElement( element, '.method-note', HTMLParagraphElement ).textContent,
			'Estimated browsing time avoided on your selected websites, based on your prior focused use.',
		);
	} );

	it( 'renders injected copy and delegates every displayed value to injected formatters', async () => {
		const element = await fixture<ComponentStatisticsSettingsScreen>( html`
			<tocus-f-statistics-settings-screen
				.source=${ new MemoryStatisticsSource( POPULATED_PROJECTION ) }
				.copy=${ {
					...TestEnglishLocalizationBundle.statistics,
					title: 'Local wellbeing',
					formatEstimatedDuration: formatTestEstimatedDuration,
					formatDuration: formatTestDuration,
					formatCount: formatTestCount,
				} }
			></tocus-f-statistics-settings-screen>
		` );
		await settleScreen( element );

		assert.equal( getRequiredElement( element, 'h1', HTMLHeadingElement ).textContent.trim(), 'Local wellbeing' );
		assert.deepEqual(
			Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [], ( value ) => value.textContent.trim() ),
			[
				'estimated:5400000',
				'duration:7200000',
				'count:12',
				'count:8',
				'count:5',
			],
		);
	} );

	it( 'collapses the metric grid without horizontal overflow at narrow settings widths', async () => {
		await setViewport( { height: 900, width: 1_000 } );
		const element = await renderScreen( new MemoryStatisticsSource( POPULATED_PROJECTION ) );
		const metrics = getRequiredElement( element, '.metrics', HTMLDListElement );

		assert.equal( getComputedStyle( metrics ).display, 'grid' );
		assert.equal( getComputedStyle( metrics ).gridTemplateColumns.split( ' ' ).length, 2 );

		await setViewport( { height: 900, width: 420 } );
		await element.updateComplete;

		const main = getRequiredElement( element, 'main', HTMLElement );
		assert.equal( getComputedStyle( metrics ).gridTemplateColumns.split( ' ' ).length, 1 );
		assert.isAtMost( main.scrollWidth, main.clientWidth );
		assert.isAtMost( main.getBoundingClientRect().width, 420 );

		await setViewport( { height: 600, width: 800 } );
	} );

	it( 'keeps an absent reclaimed-time baseline distinct from measured zero', async () => {
		const element = await renderScreen( new MemoryStatisticsSource( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: null,
			focusedPauseMilliseconds: 60_000,
			reconsideredVisitCount: 1,
			completedWaitCount: 2,
			allowanceGrantedCount: 3,
		} ) );
		const values = element.shadowRoot?.querySelectorAll( 'dd' );

		assert.deepEqual(
			Array.from( values ?? [], ( value ) => value.textContent.trim() ),
			[ 'Not enough history yet', '1 minute', '1', '2', '3' ],
		);
		assert.isNull( element.shadowRoot?.querySelector( '.empty-message' ) ?? null );
	} );

	it( 'keeps a nonzero sub-minute focused pause visible', async () => {
		const element = await renderScreen( new MemoryStatisticsSource( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: null,
			focusedPauseMilliseconds: 8_000,
			reconsideredVisitCount: 0,
			completedWaitCount: 1,
			allowanceGrantedCount: 0,
		} ) );
		const values = element.shadowRoot?.querySelectorAll( 'dd' );

		assert.deepEqual(
			Array.from( values ?? [], ( value ) => value.textContent.trim() ),
			[ 'Not enough history yet', 'Less than 1 minute', '0', '1', '0' ],
		);
	} );

	it( 'keeps a nonzero sub-minute reclaimed-time estimate natural', async () => {
		const element = await renderScreen( new MemoryStatisticsSource( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 8_000,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 1,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		} ) );
		const values = element.shadowRoot?.querySelectorAll( 'dd' );

		assert.equal( values?.item( 0 ).textContent.trim(), 'Less than 1 minute' );
	} );

	it( 'shows every measured zero with a neutral empty-state message', async () => {
		const element = await renderScreen( new MemoryStatisticsSource( {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 0,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		} ) );
		const values = element.shadowRoot?.querySelectorAll( 'dd' );

		assert.deepEqual(
			Array.from( values ?? [], ( value ) => value.textContent.trim() ),
			[ 'About 0 minutes', '0 minutes', '0', '0', '0' ],
		);
		assert.equal(
			getRequiredElement( element, '.empty-message', HTMLParagraphElement ).textContent.trim(),
			'This is a moment just for you.',
		);
	} );

	for ( const scenario of [ 'unavailable', 'malformed', 'rejected' ] as const ) {
		it( `hides every metric and offers recovery when a read is ${ scenario }`, async () => {
			const readResult: unknown = scenario === 'unavailable'
				? { status: StatisticsProjectionStatus.UNAVAILABLE }
				: { ...POPULATED_PROJECTION, completedWaitCount: -1 };
			const source = new MemoryStatisticsSource( readResult );
			source.rejectReads = scenario === 'rejected';
			const element = await renderScreen( source );
			const alert = getRequiredElement( element, '.load-error', HTMLElement );

			assert.equal( alert.getAttribute( 'role' ), 'alert' );
			assert.include( alert.textContent, 'Statistics are unavailable' );
			assert.equal( element.shadowRoot?.querySelectorAll( 'dt' ).length, 0 );
			assert.equal( element.shadowRoot?.querySelectorAll( 'dd' ).length, 0 );
			assert.instanceOf( element.shadowRoot?.querySelector( '.retry-action' ), HTMLButtonElement );
			assert.equal( getRequiredElement( element, 'main', HTMLElement ).getAttribute( 'aria-busy' ), 'false' );
		} );
	}

	it( 'restores useful focus after failed and successful read retries', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		source.rejectReads = true;
		const element = await renderScreen( source );

		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );
		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '.retry-action', HTMLButtonElement ),
		);

		source.rejectReads = false;
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal( source.reads, 3 );
		assert.equal( element.shadowRoot?.querySelectorAll( 'dd' ).length, 5 );
		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, 'h1', HTMLHeadingElement ),
		);
		assert.equal( getRequiredElement( element, 'h1', HTMLHeadingElement ).getAttribute( 'tabindex' ), '-1' );
	} );

	it( 'recovers unavailable statistics through the confirmed reset flow', async () => {
		const source = new MemoryStatisticsSource(
			{ status: StatisticsProjectionStatus.UNAVAILABLE },
			EMPTY_PROJECTION,
		);
		const element = await renderScreen( source );
		const resetAction = getRequiredElement( element, '.reset-action', HTMLButtonElement );

		resetAction.click();
		await element.updateComplete;

		assert.instanceOf( element.shadowRoot?.querySelector( '.retry-action' ), HTMLButtonElement );
		assert.instanceOf( element.shadowRoot.querySelector( '.reset-confirmation' ), HTMLElement );
		assert.equal(
			element.shadowRoot.activeElement,
			getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement ),
		);
		assert.equal( source.resets, 0 );
		await expect( element ).to.be.accessible();

		getRequiredElement( element, '.cancel-reset-action', HTMLButtonElement ).click();
		await element.updateComplete;

		assert.isNull( element.shadowRoot.querySelector( '.reset-confirmation' ) );
		assert.equal( element.shadowRoot.activeElement, resetAction );
		assert.equal( source.resets, 0 );

		resetAction.click();
		await element.updateComplete;
		getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal( source.resets, 1 );
		assert.isNull( element.shadowRoot.querySelector( '.load-error' ) );
		assert.deepEqual(
			Array.from( element.shadowRoot.querySelectorAll( 'dd' ), ( value ) => value.textContent.trim() ),
			[ 'Not enough history yet', '0 minutes', '0', '0', '0' ],
		);
		assert.equal(
			element.shadowRoot.activeElement,
			getRequiredElement( element, '.reset-action', HTMLButtonElement ),
		);
	} );

	it( 'requires inline confirmation and explains what a reset preserves', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );
		const resetAction = getRequiredElement( element, '.reset-action', HTMLButtonElement );

		resetAction.focus();
		resetAction.click();
		await element.updateComplete;

		const confirmation = getRequiredElement( element, '.reset-confirmation', HTMLElement );
		const confirmationDescription = getRequiredElement(
			element,
			'#reset-confirmation-description',
			HTMLParagraphElement,
		);
		assert.include( confirmation.textContent, 'Reset statistics?' );
		assert.equal( confirmation.getAttribute( 'role' ), 'group' );
		assert.equal( confirmation.getAttribute( 'aria-labelledby' ), 'reset-confirmation-title' );
		assert.equal( confirmation.getAttribute( 'aria-describedby' ), confirmationDescription.id );
		const confirmationText = confirmation.textContent.toLowerCase();
		for ( const preservedSetting of [ 'websites', 'schedules', 'timing', 'appearance' ] ) {
			assert.include( confirmationText, preservedSetting );
		}
		assert.equal( source.resets, 0 );
		assert.equal( resetAction.getAttribute( 'aria-expanded' ), 'true' );

		getRequiredElement( element, '.cancel-reset-action', HTMLButtonElement ).click();
		await element.updateComplete;

		assert.isNull( element.shadowRoot?.querySelector( '.reset-confirmation' ) ?? null );
		assert.equal( source.resets, 0 );
		assert.equal( element.shadowRoot?.activeElement, resetAction );
	} );

	it( 'does not submit after its source is withdrawn during confirmation', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );

		getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
		await element.updateComplete;
		element.source = null;
		getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal( source.resets, 0 );
		assert.equal( element.shadowRoot?.querySelectorAll( 'dd' ).length, 0 );
		assert.instanceOf( element.shadowRoot?.querySelector( '.load-error' ), HTMLElement );
	} );

	it( 'submits reset once and adopts the authoritative zero projection', async () => {
		const source = new DeferredResetStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( source );

		getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
		await element.updateComplete;
		const confirmAction = getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement );
		confirmAction.click();
		confirmAction.click();
		await element.updateComplete;

		assert.equal( source.resets, 1 );
		assert.isTrue( confirmAction.disabled );
		assert.equal( confirmAction.textContent.trim(), 'Resetting...' );

		source.completeReset( EMPTY_PROJECTION );
		await settleScreen( element );

		assert.deepEqual(
			Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [], ( value ) => value.textContent.trim() ),
			[ 'Not enough history yet', '0 minutes', '0', '0', '0' ],
		);
		assert.equal(
			getRequiredElement( element, '.empty-message', HTMLParagraphElement ).textContent.trim(),
			'This is a moment just for you.',
		);
		const announcement = getRequiredElement( element, '.announcement', HTMLParagraphElement );
		assert.equal( announcement.getAttribute( 'role' ), 'status' );
		assert.equal( announcement.getAttribute( 'aria-live' ), 'polite' );
		assert.include( announcement.textContent, 'Statistics were reset' );
		assert.isNull( element.shadowRoot?.querySelector( '.reset-confirmation' ) ?? null );
		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '.reset-action', HTMLButtonElement ),
		);
	} );

	it( 'renders the retained reset status from the latest localized copy', async () => {
		const source = new MemoryStatisticsSource( POPULATED_PROJECTION, EMPTY_PROJECTION );
		const element = await renderScreen( source );

		getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement ).click();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.statistics,
			resetSuccess: 'Localized reset status.',
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, '.announcement', HTMLParagraphElement ).textContent.trim(),
			'Localized reset status.',
		);
	} );

	it( 'ignores a pending reset after the shell replaces its source', async () => {
		const oldSource = new DeferredResetStatisticsSource( POPULATED_PROJECTION );
		const element = await renderScreen( oldSource );

		getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
		await element.updateComplete;
		getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement ).click();
		await element.updateComplete;

		element.source = new MemoryStatisticsSource( {
			...POPULATED_PROJECTION,
			reconsideredVisitCount: 42,
		} );
		await settleScreen( element );

		oldSource.completeReset( EMPTY_PROJECTION );
		await settleScreen( element );

		assert.equal( Array.from( element.shadowRoot?.querySelectorAll( 'dd' ) ?? [] )[ 2 ]?.textContent.trim(), '42' );
		assert.isNull( element.shadowRoot?.querySelector( '.reset-confirmation' ) ?? null );
		assert.notInclude(
			getRequiredElement( element, '.announcement', HTMLParagraphElement ).textContent,
			'Statistics were reset',
		);
	} );

	for ( const scenario of [ 'unavailable', 'malformed', 'rejected' ] as const ) {
		it( `hides stale metrics and announces when reset is ${ scenario }`, async () => {
			const resetResult: unknown = scenario === 'unavailable'
				? { status: StatisticsProjectionStatus.UNAVAILABLE }
				: { ...EMPTY_PROJECTION, allowanceGrantedCount: -1 };
			const source = new MemoryStatisticsSource( POPULATED_PROJECTION, resetResult );
			source.rejectResets = scenario === 'rejected';
			const element = await renderScreen( source );

			getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
			await element.updateComplete;
			getRequiredElement( element, '.confirm-reset-action', HTMLButtonElement ).click();
			await settleScreen( element );

			const alert = getRequiredElement( element, '.load-error', HTMLElement );
			assert.equal( source.resets, 1 );
			assert.equal( alert.getAttribute( 'role' ), 'alert' );
			assert.include( alert.textContent, 'Statistics could not be reset' );
			assert.equal( element.shadowRoot?.querySelectorAll( 'dt' ).length, 0 );
			assert.equal( element.shadowRoot?.querySelectorAll( 'dd' ).length, 0 );
			assert.notInclude( getRequiredElement( element, 'main', HTMLElement ).textContent, 'About 1 hour' );
			assert.notInclude(
				getRequiredElement( element, '.announcement', HTMLParagraphElement ).textContent,
				'Statistics were reset',
			);
			assert.equal(
				element.shadowRoot?.activeElement,
				getRequiredElement( element, '.retry-action', HTMLButtonElement ),
			);
		} );
	}

	it( 'has no automatically detectable violations in ready, confirmation, or unavailable states', async () => {
		const ready = await renderScreen( new MemoryStatisticsSource( POPULATED_PROJECTION ) );
		await expect( ready ).to.be.accessible();

		getRequiredElement( ready, '.reset-action', HTMLButtonElement ).click();
		await ready.updateComplete;
		await expect( ready ).to.be.accessible();
		ready.remove();

		const unavailable = await renderScreen( new MemoryStatisticsSource( {
			status: StatisticsProjectionStatus.UNAVAILABLE,
		} ) );
		await expect( unavailable ).to.be.accessible();
	} );

	it( 'keeps metric and confirmation boundaries visible in forced colors', async () => {
		document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
		document.documentElement.setAttribute( 'data-tocus-theme', 'dark' );
		await emulateMedia( { colorScheme: 'dark', forcedColors: 'active' } );

		try {
			const element = await renderScreen( new MemoryStatisticsSource( POPULATED_PROJECTION ) );
			const featuredMetric = getRequiredElement( element, '.metric-featured', HTMLElement );

			assert.equal( getComputedStyle( featuredMetric ).forcedColorAdjust, 'auto' );
			assert.equal( getComputedStyle( featuredMetric ).borderTopWidth, '1px' );
			getRequiredElement( element, '.reset-action', HTMLButtonElement ).click();
			await element.updateComplete;
			assert.equal(
				getComputedStyle( getRequiredElement( element, '.reset-confirmation', HTMLElement ) ).borderTopWidth,
				'1px',
			);
		} finally {
			document.documentElement.removeAttribute( 'data-tocus-palette' );
			document.documentElement.removeAttribute( 'data-tocus-theme' );
			await emulateMedia( { colorScheme: 'light', forcedColors: 'none' } );
		}
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentStatisticsSettingsScreen>( html`<tocus-f-statistics-settings-screen></tocus-f-statistics-settings-screen>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
