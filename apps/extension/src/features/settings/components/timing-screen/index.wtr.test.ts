import { assert, expect, fixture, html } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import {
	createProtectionConfigurationEditor,
	ProtectionConfigurationEditStatus,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
	type ProtectionConfigurationMutationCoordinator,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	TestEmptyProtectionConfiguration,
	createTestProtectionMeasurementRevision,
} from '../../../../domains/protection/types/__fixtures__';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
} from '../../../../domains/protection/types/protection-value';
import { ComponentTimingScreen } from './index';

/**
 * Persisted timing configuration loaded by component fixtures.
 * @since 0.1.0 Initial implementation.
 */
const LOADED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	timingConfiguration: {
		initialWaitMilliseconds: 15_000,
		ladderIncreaseMilliseconds: 10_000,
		maximumWaitMilliseconds: 45_000,
		allowanceMilliseconds: 12 * 60_000,
		completionAction: CompletionAction.OPEN_AUTOMATICALLY,
	},
};

/**
 * In-memory timing-screen storage with controllable local read and write outcomes.
 * @since 0.1.0 Initial implementation.
 */
class MemoryTimingScreenStorage implements ProtectionConfigurationStorageService {
	/**
	 * Whether local configuration reads should fail.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectLoads = false;

	/**
	 * Whether local configuration writes should fail.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectSaves = false;

	/**
	 * Number of local configuration writes accepted by the fixture.
	 * @since 0.1.0 Initial implementation.
	 */
	writes = 0;

	/**
	 * Creates storage with one initial configuration result.
	 * @param configuration - Configuration returned by local reads.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public configuration: ProtectionConfigurationDocument | null ) {}

	/**
	 * Loads the current in-memory configuration.
	 * @return Current configuration or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<ProtectionConfigurationDocument | null> {
		if ( this.rejectLoads ) {
			return Promise.reject( new Error( 'Local read unavailable.' ) );
		}

		return Promise.resolve( this.configuration );
	}

	/**
	 * Stores one complete configuration in memory.
	 * @param input - Complete configuration candidate.
	 * @return Promise resolved after the write.
	 * @since 0.1.0 Initial implementation.
	 */
	save( input: unknown ): Promise<void> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		this.writes += 1;
		this.configuration = input as ProtectionConfigurationDocument;

		return Promise.resolve();
	}
}

/**
 * In-memory storage that keeps the initial local read pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredTimingScreenStorage extends MemoryTimingScreenStorage {
	/**
	 * Resolver for the pending local configuration read.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolvePendingLoad: ( ( configuration: ProtectionConfigurationDocument | null ) => void ) | null = null;

	/**
	 * Keeps the current configuration read pending.
	 * @return Promise settled after the fixture releases the read.
	 * @since 0.1.0 Initial implementation.
	 */
	override load(): Promise<ProtectionConfigurationDocument | null> {
		return new Promise<ProtectionConfigurationDocument | null>( ( resolve ) => {
			this.resolvePendingLoad = resolve;
		} );
	}

	/**
	 * Completes the pending configuration read.
	 * @since 0.1.0 Initial implementation.
	 */
	completeLoad(): void {
		if ( this.resolvePendingLoad === null ) {
			throw new Error( 'Expected one pending timing-screen read.' );
		}

		this.resolvePendingLoad( this.configuration );
		this.resolvePendingLoad = null;
	}
}

/**
 * In-memory storage that keeps one timing write pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredTimingScreenSaveStorage extends MemoryTimingScreenStorage {
	/**
	 * Resolver for the pending local configuration write.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolvePendingSave: ( () => void ) | null = null;

	/**
	 * Keeps one complete configuration write pending.
	 * @param input - Complete configuration waiting to be persisted.
	 * @return Promise settled after the fixture releases the write.
	 * @since 0.1.0 Initial implementation.
	 */
	override save( input: unknown ): Promise<void> {
		this.writes += 1;
		this.configuration = input as ProtectionConfigurationDocument;

		return new Promise<void>( ( resolve ) => {
			this.resolvePendingSave = resolve;
		} );
	}

	/**
	 * Completes the pending configuration write.
	 * @since 0.1.0 Initial implementation.
	 */
	completeSave(): void {
		if ( this.resolvePendingSave === null ) {
			throw new Error( 'Expected one pending timing-screen write.' );
		}

		this.resolvePendingSave();
		this.resolvePendingSave = null;
	}
}

/**
 * Runs one component-test mutation immediately inside the current browser context.
 * @param mutation - Deferred configuration mutation.
 * @return Exact mutation result.
 * @since 0.1.0 Initial implementation.
 */
function coordinateMutationDirectly(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return mutation();
}

/**
 * Creates one deterministic independent protection scope for editor fixtures.
 * @return Stable independent scope identifier.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_timing_screen';
}

/**
 * Creates one real editor backed by the supplied timing-screen storage.
 * @param storage - In-memory local configuration storage.
 * @param coordinateMutation - Authority coordinating each editor mutation.
 * @return Timing-screen configuration editor.
 * @since 0.1.0 Initial implementation.
 */
function createEditor(
	storage: MemoryTimingScreenStorage,
	coordinateMutation: ProtectionConfigurationMutationCoordinator = coordinateMutationDirectly,
): ProtectionConfigurationEditor {
	return createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		createMeasurementRevision: createTestProtectionMeasurementRevision,
		coordinateMutation,
	} );
}

/**
 * Creates a coordinator that returns one authoritative configuration after a real mutation.
 * @param configuration - Full configuration returned to the component after persistence.
 * @return Mutation coordinator with a divergent authoritative result.
 * @since 0.1.0 Initial implementation.
 */
function createReturnedConfigurationCoordinator(
	configuration: ProtectionConfigurationDocument,
): ProtectionConfigurationMutationCoordinator {
	/**
	 * Runs one real mutation before replacing its successful result configuration.
	 * @param mutation - Deferred configuration mutation.
	 * @return Rejection or successful authoritative configuration.
	 * @since 0.1.0 Initial implementation.
	 */
	async function coordinateMutationWithReturnedConfiguration(
		mutation: ProtectionConfigurationMutation,
	): Promise<ProtectionConfigurationEditResult> {
		const result = await mutation();

		if ( result.status === ProtectionConfigurationEditStatus.REJECTED ) {
			return result;
		}

		return {
			status: ProtectionConfigurationEditStatus.UPDATED,
			configuration,
		};
	}

	return coordinateMutationWithReturnedConfiguration;
}

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Returns one required element from the Timing screen shadow tree.
 * @param element - Rendered Timing screen.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<T extends Element>(
	element: ComponentTimingScreen,
	selector: string,
	expectedType: ElementConstructor<T>,
): T {
	const match = element.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the Timing screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Waits for queued loading and Lit rendering.
 * @param element - Timing screen expected to update.
 * @return Promise resolved after the next task and component update.
 * @since 0.1.0 Initial implementation.
 */
async function settleScreen( element: ComponentTimingScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

/**
 * Creates one connected Timing screen with a real local editor.
 * @param storage - In-memory local configuration storage.
 * @return Ready or recovered Timing screen fixture.
 * @since 0.1.0 Initial implementation.
 */
async function createScreen(
	storage: MemoryTimingScreenStorage,
): Promise<ComponentTimingScreen> {
	const element = await fixture<ComponentTimingScreen>( html`
		<tocus-f-timing-screen .editor=${ createEditor( storage ) }></tocus-f-timing-screen>
	` );
	await settleScreen( element );

	return element;
}

/**
 * Selects one native timing option and emits its user-facing change event.
 * @param element - Rendered Timing screen.
 * @param selector - Required select selector.
 * @param value - Native option value to select.
 * @since 0.1.0 Initial implementation.
 */
function chooseSelectValue(
	element: ComponentTimingScreen,
	selector: string,
	value: string,
): void {
	const select = getRequiredElement( element, selector, HTMLSelectElement );
	select.value = value;
	select.dispatchEvent( new Event( 'change', { bubbles: true } ) );
}

/**
 * Returns every native option value from one required Timing select.
 * @param element - Rendered Timing screen.
 * @param selector - Required select selector.
 * @return Native option values in presentation order.
 * @since 0.1.0 Initial implementation.
 */
function getOptionValues(
	element: ComponentTimingScreen,
	selector: string,
): string[] {
	return Array.from(
		getRequiredElement( element, selector, HTMLSelectElement ).options,
		( option ) => option.value,
	);
}

describe( 'tocus-f-timing-screen', () => {
	it( 'reports an unavailable editor dependency without leaving the screen busy', async () => {
		const element = await fixture<ComponentTimingScreen>( html`
			<tocus-f-timing-screen></tocus-f-timing-screen>
		` );
		await settleScreen( element );

		assert.include( getRequiredElement( element, '.load-error', HTMLElement ).textContent, 'could not load' );
		assert.isFalse( element.shadowRoot?.querySelector( '.timing-form' ) instanceof HTMLFormElement );
		assert.equal( getRequiredElement( element, 'main', HTMLElement ).getAttribute( 'aria-busy' ), 'false' );
	} );

	it( 'shows loading until the editor returns the persisted global timing values', async () => {
		const storage = new DeferredTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await fixture<ComponentTimingScreen>( html`
			<tocus-f-timing-screen .editor=${ createEditor( storage ) }></tocus-f-timing-screen>
		` );

		assert.equal( customElements.get( 'tocus-f-timing-screen' ), ComponentTimingScreen );
		assert.equal( getRequiredElement( element, 'main', HTMLElement ).getAttribute( 'aria-busy' ), 'true' );
		assert.include( getRequiredElement( element, '.loading-status', HTMLParagraphElement ).textContent, 'Loading' );
		const formRenderedWhileLoading =
			element.shadowRoot?.querySelector( '.timing-form' ) instanceof HTMLFormElement;

		storage.completeLoad();
		await settleScreen( element );

		assert.isFalse( formRenderedWhileLoading );
		assert.instanceOf( element.shadowRoot?.querySelector( '.timing-form' ), HTMLFormElement );
		assert.equal( getRequiredElement( element, '#initial-wait', HTMLSelectElement ).value, '15' );
		assert.equal( getRequiredElement( element, '#wait-increase', HTMLSelectElement ).value, '10' );
		assert.equal( getRequiredElement( element, '#maximum-wait', HTMLSelectElement ).value, '45' );
		assert.equal( getRequiredElement( element, '#allowance', HTMLSelectElement ).value, '12' );
		assert.isTrue(
			getRequiredElement(
				element,
				`input[value="${ CompletionAction.OPEN_AUTOMATICALLY }"]`,
				HTMLInputElement,
			).checked,
		);
		assert.equal( getRequiredElement( element, 'main', HTMLElement ).getAttribute( 'aria-busy' ), 'false' );
		await expect( element ).to.be.accessible();
	} );

	it( 'preserves malformed local data and focuses timing after a successful retry', async () => {
		const storage = new MemoryTimingScreenStorage( null );
		const element = await createScreen( storage );

		assert.include( getRequiredElement( element, '.load-error', HTMLElement ).textContent, 'not valid' );
		assert.equal( getRequiredElement( element, '.load-error', HTMLElement ).getAttribute( 'role' ), 'alert' );
		assert.isFalse( element.shadowRoot?.querySelector( '.timing-form' ) instanceof HTMLFormElement );
		assert.equal( storage.writes, 0 );
		await expect( element ).to.be.accessible();

		storage.configuration = LOADED_CONFIGURATION;
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '#initial-wait', HTMLSelectElement ),
		);
	} );

	it( 'restores focus to retry after another read failure and to timing after recovery', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		storage.rejectLoads = true;
		const element = await createScreen( storage );

		assert.include( getRequiredElement( element, '.load-error', HTMLElement ).textContent, 'could not load' );
		assert.isFalse( element.shadowRoot?.querySelector( '.timing-form' ) instanceof HTMLFormElement );
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.isFalse( element.shadowRoot?.querySelector( '.timing-form' ) instanceof HTMLFormElement );
		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '.retry-action', HTMLButtonElement ),
		);

		storage.rejectLoads = false;
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '#initial-wait', HTMLSelectElement ),
		);
	} );

	it( 'offers only allowed native values and persists one complete global timing update', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );

		assert.deepEqual( getOptionValues( element, '#initial-wait' ), [
			'10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60',
		] );
		assert.deepEqual( getOptionValues( element, '#wait-increase' ), [
			'5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60',
		] );
		assert.deepEqual( getOptionValues( element, '#maximum-wait' ), [
			'10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60',
		] );
		assert.deepEqual( getOptionValues( element, '#allowance' ), Array.from(
			{ length: 60 },
			( _, index ) => String( index + 1 ),
		) );

		chooseSelectValue( element, '#initial-wait', '55' );
		chooseSelectValue( element, '#wait-increase', '60' );
		chooseSelectValue( element, '#maximum-wait', '60' );
		chooseSelectValue( element, '#allowance', '1' );
		getRequiredElement(
			element,
			`input[value="${ CompletionAction.SHOW_CONTINUE }"]`,
			HTMLInputElement,
		).click();
		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 1 );
		assert.deepEqual( storage.configuration, {
			...LOADED_CONFIGURATION,
			timingConfiguration: {
				initialWaitMilliseconds: 55_000,
				ladderIncreaseMilliseconds: 60_000,
				maximumWaitMilliseconds: 60_000,
				allowanceMilliseconds: 60_000,
				completionAction: CompletionAction.SHOW_CONTINUE,
			},
			measurementRevisionsByScope: {
				[ DefaultProtectionScopeId ]: ProtectionMeasurementRevisionSchema.parse(
					'revision_test_next',
				),
			},
		} );
		assert.equal( getRequiredElement( element, '.save-action', HTMLButtonElement ).textContent.trim(), 'Save timing' );
	} );

	it( 'adopts the full authoritative configuration returned after persistence', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const returnedConfiguration: ProtectionConfigurationDocument = {
			...LOADED_CONFIGURATION,
			timingConfiguration: {
				initialWaitMilliseconds: 25_000,
				ladderIncreaseMilliseconds: 20_000,
				maximumWaitMilliseconds: 50_000,
				allowanceMilliseconds: 9 * 60_000,
				completionAction: CompletionAction.SHOW_CONTINUE,
			},
			measurementRevisionsByScope: {
				[ DefaultProtectionScopeId ]: ProtectionMeasurementRevisionSchema.parse(
					'revision_authoritative',
				),
			},
		};
		const editor = createEditor(
			storage,
			createReturnedConfigurationCoordinator( returnedConfiguration ),
		);
		const element = await fixture<ComponentTimingScreen>( html`
			<tocus-f-timing-screen .editor=${ editor }></tocus-f-timing-screen>
		` );
		await settleScreen( element );

		chooseSelectValue( element, '#initial-wait', '20' );
		chooseSelectValue( element, '#wait-increase', '15' );
		chooseSelectValue( element, '#maximum-wait', '30' );
		chooseSelectValue( element, '#allowance', '7' );
		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 1 );
		assert.equal( getRequiredElement( element, '#initial-wait', HTMLSelectElement ).value, '25' );
		assert.equal( getRequiredElement( element, '#wait-increase', HTMLSelectElement ).value, '20' );
		assert.equal( getRequiredElement( element, '#maximum-wait', HTMLSelectElement ).value, '50' );
		assert.equal( getRequiredElement( element, '#allowance', HTMLSelectElement ).value, '9' );
		assert.isTrue(
			getRequiredElement(
				element,
				`input[value="${ CompletionAction.SHOW_CONTINUE }"]`,
				HTMLInputElement,
			).checked,
		);
		const summary = getRequiredElement( element, '.timing-summary', HTMLElement );
		assert.include( summary.textContent, '25 seconds' );
		assert.include( summary.textContent, 'allowance for 9 minutes and shows a Continue button' );
	} );

	it( 'associates an invalid maximum with its select and moves focus without writing', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );

		chooseSelectValue( element, '#initial-wait', '60' );
		chooseSelectValue( element, '#maximum-wait', '55' );
		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		const maximumWait = getRequiredElement( element, '#maximum-wait', HTMLSelectElement );
		const maximumError = getRequiredElement( element, '#maximum-wait-error', HTMLParagraphElement );
		assert.equal( storage.writes, 0 );
		assert.equal( getRequiredElement( element, '#initial-wait', HTMLSelectElement ).value, '60' );
		assert.equal( maximumWait.value, '55' );
		assert.equal( maximumWait.getAttribute( 'aria-invalid' ), 'true' );
		assert.include( maximumWait.getAttribute( 'aria-describedby' ), 'maximum-wait-error' );
		assert.include( maximumError.textContent, 'Maximum wait' );
		assert.equal( maximumError.getAttribute( 'role' ), 'alert' );
		assert.equal( element.shadowRoot?.activeElement, maximumWait );
		await expect( element ).to.be.accessible();
	} );

	it( 'keeps the maximum error when only the allowance changes', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );

		chooseSelectValue( element, '#initial-wait', '60' );
		chooseSelectValue( element, '#maximum-wait', '55' );
		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		chooseSelectValue( element, '#allowance', '8' );
		await element.updateComplete;

		const maximumWait = getRequiredElement( element, '#maximum-wait', HTMLSelectElement );
		assert.equal( maximumWait.getAttribute( 'aria-invalid' ), 'true' );
		assert.include(
			getRequiredElement( element, '#maximum-wait-error', HTMLParagraphElement ).textContent,
			'Maximum wait',
		);
		assert.equal( storage.writes, 0 );
	} );

	it( 'keeps every timing choice available when the local write fails', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		storage.rejectSaves = true;
		const element = await createScreen( storage );

		chooseSelectValue( element, '#initial-wait', '20' );
		chooseSelectValue( element, '#wait-increase', '15' );
		chooseSelectValue( element, '#maximum-wait', '30' );
		chooseSelectValue( element, '#allowance', '7' );
		getRequiredElement(
			element,
			`input[value="${ CompletionAction.SHOW_CONTINUE }"]`,
			HTMLInputElement,
		).click();
		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 0 );
		assert.equal( storage.configuration, LOADED_CONFIGURATION );
		assert.equal( getRequiredElement( element, '#initial-wait', HTMLSelectElement ).value, '20' );
		assert.equal( getRequiredElement( element, '#wait-increase', HTMLSelectElement ).value, '15' );
		assert.equal( getRequiredElement( element, '#maximum-wait', HTMLSelectElement ).value, '30' );
		assert.equal( getRequiredElement( element, '#allowance', HTMLSelectElement ).value, '7' );
		assert.isTrue(
			getRequiredElement(
				element,
				`input[value="${ CompletionAction.SHOW_CONTINUE }"]`,
				HTMLInputElement,
			).checked,
		);
		assert.include( getRequiredElement( element, '.form-error', HTMLParagraphElement ).textContent, 'still here' );
		assert.equal( getRequiredElement( element, '.form-error', HTMLParagraphElement ).getAttribute( 'role' ), 'alert' );
		assert.isFalse( getRequiredElement( element, '.save-action', HTMLButtonElement ).disabled );
		await expect( element ).to.be.accessible();
	} );

	it( 'keeps one timing write pending and ignores a duplicate submission', async () => {
		const storage = new DeferredTimingScreenSaveStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );
		const form = getRequiredElement( element, '.timing-form', HTMLFormElement );

		form.requestSubmit();
		form.requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 1 );
		assert.equal( getRequiredElement( element, '.save-action', HTMLButtonElement ).textContent.trim(), 'Saving...' );
		assert.isTrue( getRequiredElement( element, '#initial-wait', HTMLSelectElement ).disabled );

		storage.completeSave();
		await settleScreen( element );
		assert.equal( storage.writes, 1 );
	} );

	it( 'preserves choices when the stored configuration changes before saving', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );

		chooseSelectValue( element, '#initial-wait', '20' );
		storage.configuration = null;
		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 0 );
		assert.equal( getRequiredElement( element, '#initial-wait', HTMLSelectElement ).value, '20' );
		assert.include( getRequiredElement( element, '.form-error', HTMLParagraphElement ).textContent, 'data changed' );
	} );

	it( 'reports a domain-rejected timing candidate without writing', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );
		const waitIncrease = getRequiredElement( element, '#wait-increase', HTMLSelectElement );
		waitIncrease.value = '';

		getRequiredElement( element, '.timing-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 0 );
		assert.include( getRequiredElement( element, '.form-error', HTMLParagraphElement ).textContent, 'not valid' );
	} );

	it( 'replaces the polite success announcement when the same save repeats', async () => {
		const storage = new MemoryTimingScreenStorage( LOADED_CONFIGURATION );
		const element = await createScreen( storage );
		const form = getRequiredElement( element, '.timing-form', HTMLFormElement );

		form.requestSubmit();
		await settleScreen( element );

		const announcement = getRequiredElement( element, '.announcement', HTMLParagraphElement );
		assert.include( announcement.textContent, 'Timing settings were saved' );
		assert.equal( announcement.getAttribute( 'role' ), 'status' );
		assert.equal( announcement.getAttribute( 'aria-live' ), 'polite' );

		const mutations: MutationRecord[] = [];
		const observer = new MutationObserver( ( records ) => mutations.push( ...records ) );
		observer.observe( announcement, { childList: true, subtree: true } );

		form.requestSubmit();
		await settleScreen( element );
		observer.disconnect();

		assert.equal( storage.writes, 2 );
		assert.isAbove( mutations.length, 0 );
		assert.include( announcement.textContent, 'Timing settings were saved' );
	} );

	it( 'uses one native accessible form and keeps its draft summary non-live', async () => {
		const element = await createScreen( new MemoryTimingScreenStorage( LOADED_CONFIGURATION ) );
		const shadowRoot = element.shadowRoot;

		assert.instanceOf( shadowRoot, ShadowRoot );
		if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
			throw new TypeError( 'Expected the Timing screen to render a shadow root.' );
		}

		assert.equal( shadowRoot.querySelectorAll( 'form' ).length, 1 );
		assert.equal( getRequiredElement( element, '.timing-form', HTMLFormElement ).getAttribute( 'aria-label' ), 'Global timing' );

		for ( const [ selector, label ] of [
			[ '#initial-wait', 'Initial wait' ],
			[ '#wait-increase', 'Wait increase' ],
			[ '#maximum-wait', 'Maximum wait' ],
			[ '#allowance', 'Allowance' ],
		] as const ) {
			const select = getRequiredElement( element, selector, HTMLSelectElement );
			assert.include( select.labels.item( 0 ).textContent, label );
			assert.isNotEmpty( select.getAttribute( 'aria-describedby' ) );
		}

		const completionFieldset = getRequiredElement( element, '.completion-action', HTMLFieldSetElement );
		assert.equal( completionFieldset.querySelector( 'legend' )?.textContent.trim(), 'When the wait finishes' );
		assert.deepEqual(
			Array.from( completionFieldset.querySelectorAll<HTMLInputElement>( 'input[type="radio"]' ), ( input ) => ( {
				name: input.name,
				value: input.value,
			} ) ),
			[
				{ name: 'completion-action', value: CompletionAction.SHOW_CONTINUE },
				{ name: 'completion-action', value: CompletionAction.OPEN_AUTOMATICALLY },
			],
		);

		const summary = getRequiredElement( element, '.timing-summary', HTMLElement );
		assert.equal( summary.getAttribute( 'role' ), null );
		assert.equal( summary.getAttribute( 'aria-live' ), null );
		assert.include( summary.textContent, '15 seconds' );
		assert.include( summary.textContent, '10 seconds' );
		assert.include( summary.textContent, '45 seconds' );
		assert.include( summary.textContent, 'Each completed wait adds' );
		assert.include(
			summary.textContent,
			'Completing a wait starts an allowance for 12 minutes and opens the site automatically.',
		);
		assert.include(
			getRequiredElement( element, '#wait-increase-help', HTMLParagraphElement ).textContent,
			'completed wait',
		);

		chooseSelectValue( element, '#initial-wait', '20' );
		await element.updateComplete;
		assert.include( summary.textContent, '20 seconds' );
		await expect( element ).to.be.accessible();
	} );

	it( 'collapses timing fields and completion choices into one narrow column', async () => {
		await setViewport( { height: 800, width: 420 } );
		const element = await createScreen( new MemoryTimingScreenStorage( LOADED_CONFIGURATION ) );
		const timingFields = getRequiredElement( element, '.timing-fields', HTMLElement );
		const completionOptions = getRequiredElement( element, '.completion-options', HTMLElement );

		assert.equal( getComputedStyle( timingFields ).gridTemplateColumns.split( ' ' ).length, 1 );
		assert.equal( getComputedStyle( completionOptions ).gridTemplateColumns.split( ' ' ).length, 1 );
		assert.isAtMost( getRequiredElement( element, 'main', HTMLElement ).getBoundingClientRect().width, 420 );

		await setViewport( { height: 800, width: 1_000 } );
	} );
} );
