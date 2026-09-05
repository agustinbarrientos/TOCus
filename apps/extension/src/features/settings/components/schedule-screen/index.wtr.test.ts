import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import {
	createProtectionConfigurationEditor,
	type ProtectionConfigurationEditResult,
	type ProtectionConfigurationEditor,
	type ProtectionConfigurationMutation,
} from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';
import {
	TestEmptyProtectionConfiguration,
	createTestProtectionMeasurementRevision,
} from '../../../../domains/protection/types/__fixtures__';
import {
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	ScheduleMode,
	Weekday,
} from '../../../../domains/protection/types/protection-schedule';
import {
	DefaultProtectionScopeId,
	ProtectionMeasurementRevisionSchema,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import { ComponentScheduleScreen } from './index';

/**
 * Independent protection scope used by ChatGPT schedule fixtures.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_chatgpt' );

/**
 * Sorts schedule-scope labels in deterministic descending order.
 * @param firstName - First scope label.
 * @param secondName - Second scope label.
 * @return Descending comparison result.
 * @since 0.1.0 Initial implementation.
 */
function compareNamesDescending( firstName: string, secondName: string ): number {
	return secondName.localeCompare( firstName, 'en' );
}

/**
 * ChatGPT site assigned to the independent schedule scope.
 * @since 0.1.0 Initial implementation.
 */
const CHATGPT_SITE: ProtectedSiteConfiguration = {
	identityHost: 'chatgpt.com',
	rule: {
		host: 'chatgpt.com',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};
/**
 * Independent protection scope used by YouTube schedule fixtures.
 * @since 0.1.0 Initial implementation.
 */
const YOUTUBE_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_youtube' );

/**
 * YouTube site assigned to its independent schedule scope.
 * @since 0.1.0 Initial implementation.
 */
const YOUTUBE_SITE: ProtectedSiteConfiguration = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: YOUTUBE_SCOPE_ID,
	},
};
/**
 * Site assigned to the shared protection scope.
 * @since 0.1.0 Initial implementation.
 */
const SHARED_SITE: ProtectedSiteConfiguration = {
	identityHost: 'x.com',
	rule: {
		host: 'x.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};
/**
 * Second site assigned to the ChatGPT schedule scope.
 * @since 0.1.0 Initial implementation.
 */
const SECOND_CHATGPT_SCOPE_SITE: ProtectedSiteConfiguration = {
	identityHost: 'openai.com',
	rule: {
		host: 'openai.com',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};

/**
 * Configuration used to exercise a populated schedule screen.
 * @since 0.1.0 Initial implementation.
 */
const POPULATED_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ CHATGPT_SITE ],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		[ INDEPENDENT_SCOPE_ID ]: {
			mode: ScheduleMode.CUSTOM,
			windows: [ {
				weekday: Weekday.TUESDAY,
				startMinute: 540,
				endMinute: 1_020,
			} ],
		},
	},
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		[ INDEPENDENT_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse( 'revision_chatgpt' ),
	},
};

/**
 * Formats one visibly distinct weekday label for localization assertions.
 * @param weekday - Domain weekday to present.
 * @return Deterministic localized test label.
 * @since 0.1.0 Initial implementation.
 */
function formatLocalizedWeekday( weekday: Weekday ): string {
	return `Localized ${ weekday }`;
}

/**
 * In-memory configuration storage used by Schedule screen tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryScheduleScreenStorage implements ProtectionConfigurationStorageService {
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
	 * @param configuration - Configuration returned by the next load.
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
	 * Stores one complete configuration.
	 * @param input - Configuration to persist.
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
 * In-memory storage that keeps one Schedule screen write pending.
 * @since 0.1.0 Initial implementation.
 */
class DeferredScheduleScreenStorage extends MemoryScheduleScreenStorage {
	/**
	 * Resolver for the pending local configuration write.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolvePendingSave: ( () => void ) | null = null;

	/**
	 * Keeps one complete configuration write pending.
	 * @param input - Configuration waiting to be persisted.
	 * @return Promise resolved after the fixture releases the write.
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
	 * Completes the current pending configuration write.
	 * @since 0.1.0 Initial implementation.
	 */
	completeSave(): void {
		if ( this.resolvePendingSave === null ) {
			throw new Error( 'Expected one pending Schedule write.' );
		}

		this.resolvePendingSave();
		this.resolvePendingSave = null;
	}
}

/**
 * Creates one deterministic independent scope for component fixtures.
 * @return Stable independent scope identifier.
 * @since 0.1.0 Initial implementation.
 */
function createIndependentScopeId(): string {
	return 'scope_unused';
}

/**
 * Runs one component-test mutation immediately inside the current browser context.
 * @param mutation - Deferred local configuration mutation.
 * @return Exact mutation result.
 * @since 0.1.0 Initial implementation.
 */
function coordinateMutationDirectly(
	mutation: ProtectionConfigurationMutation,
): Promise<ProtectionConfigurationEditResult> {
	return mutation();
}

/**
 * Creates one real configuration editor backed by the supplied storage.
 * @param storage - In-memory Schedule screen storage.
 * @return Local configuration editor.
 * @since 0.1.0 Initial implementation.
 */
function createEditor( storage: MemoryScheduleScreenStorage ): ProtectionConfigurationEditor {
	return createProtectionConfigurationEditor( {
		storage,
		createIndependentScopeId,
		createMeasurementRevision: createTestProtectionMeasurementRevision,
		coordinateMutation: coordinateMutationDirectly,
	} );
}

/**
 * Runtime constructor used to validate one queried test element.
 * @since 0.1.0 Initial implementation.
 */
interface ElementConstructor<T extends Element> {
	new(): T;
}

/**
 * Returns one required element from the Schedule screen shadow tree.
 * @param element - Rendered Schedule screen.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<T extends Element>(
	element: ComponentScheduleScreen,
	selector: string,
	expectedType: ElementConstructor<T>,
): T {
	const match = element.shadowRoot?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the Schedule screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Waits for queued work and Lit rendering.
 * @param element - Schedule screen expected to update.
 * @return Promise resolved after the next task and component update.
 * @since 0.1.0 Initial implementation.
 */
async function settleScreen( element: ComponentScheduleScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

/**
 * Creates one connected Schedule screen with local dependencies.
 * @param storage - In-memory local configuration storage.
 * @return Connected Schedule screen.
 * @since 0.1.0 Initial implementation.
 */
async function createScreen(
	storage: MemoryScheduleScreenStorage,
): Promise<ComponentScheduleScreen> {
	const element = await fixture<ComponentScheduleScreen>( html`
		<tocus-f-schedule-screen
			.copy=${ TestEnglishLocalizationBundle.schedule }
			.editor=${ createEditor( storage ) }
		></tocus-f-schedule-screen>
	` );
	await settleScreen( element );

	return element;
}

describe( 'tocus-f-schedule-screen', () => {
	it( 'reports an unavailable editor dependency without leaving the screen busy', async () => {
		const element = await fixture<ComponentScheduleScreen>( html`
			<tocus-f-schedule-screen
			.copy=${ TestEnglishLocalizationBundle.schedule }></tocus-f-schedule-screen>
		` );
		await settleScreen( element );

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'could not load' );
		assert.equal( element.shadowRoot?.querySelector( '[aria-busy="true"]' ), null );
	} );

	it( 'loads the shared Always schedule with accessible native controls', async () => {
		const element = await createScreen(
			new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } ),
		);

		assert.equal( customElements.get( 'tocus-f-schedule-screen' ), ComponentScheduleScreen );
		assert.equal( getRequiredElement( element, 'h1', Element ).textContent.trim(), 'Schedule' );
		assert.include( getRequiredElement( element, '.scope-summary', Element ).textContent, 'Shared timing' );
		assert.isTrue( getRequiredElement(
			element,
			'input[name="schedule-mode"][value="always"]',
			HTMLInputElement,
		).checked );
		assert.equal( element.shadowRoot?.querySelector( '.schedule-windows' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'renders every persisted weekday in its matching native selector', async () => {
		const configuration: ProtectionConfigurationDocument = {
			...TestEmptyProtectionConfiguration,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: ScheduleMode.CUSTOM,
					windows: [
						{ weekday: Weekday.MONDAY, startMinute: 540, endMinute: 1_020 },
						{ weekday: Weekday.FRIDAY, startMinute: 1_080, endMinute: 1_320 },
					],
				},
			},
		};
		const element = await createScreen( new MemoryScheduleScreenStorage( configuration ) );
		const weekdays = element.shadowRoot?.querySelectorAll<HTMLSelectElement>( 'select[name="weekday"]' );

		assert.deepEqual(
			Array.from( weekdays ?? [] ).map( ( weekday ) => weekday.value ),
			[ Weekday.MONDAY, Weekday.FRIDAY ],
		);
		assert.deepEqual(
			Array.from( element.shadowRoot?.querySelectorAll( '.schedule-window' ) ?? [] ).map( ( row ) => ( {
				label: row.getAttribute( 'aria-label' ),
				role: row.getAttribute( 'role' ),
			} ) ),
			[
				{ label: 'Time window 1', role: 'group' },
				{ label: 'Time window 2', role: 'group' },
			],
		);
		assert.deepEqual(
			Array.from(
				element.shadowRoot?.querySelectorAll<HTMLButtonElement>( '.remove-window-action' ) ?? [],
			).map( ( button ) => button.getAttribute( 'aria-label' ) ),
			[ 'Remove time window 1', 'Remove time window 2' ],
		);
		const secondWeekday = weekdays?.item( 1 );
		assert.instanceOf( secondWeekday, HTMLSelectElement );
		if ( ! ( secondWeekday instanceof HTMLSelectElement ) ) {
			throw new TypeError( 'Expected the second persisted weekday selector.' );
		}
		secondWeekday.value = Weekday.SUNDAY;
		secondWeekday.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );
		assert.deepEqual(
			Array.from( weekdays ?? [] ).map( ( weekday ) => weekday.value ),
			[ Weekday.MONDAY, Weekday.SUNDAY ],
		);
	} );

	it( 'uses localizable labels for every weekday option', async () => {
		const element = await createScreen( new MemoryScheduleScreenStorage( POPULATED_CONFIGURATION ) );
		element.copy = {
			...TestEnglishLocalizationBundle.schedule,
			formatWeekday: formatLocalizedWeekday,
		};
		await element.updateComplete;
		const scopeSelect = getRequiredElement( element, '#schedule-scope', HTMLSelectElement );
		scopeSelect.value = INDEPENDENT_SCOPE_ID;
		scopeSelect.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );

		assert.deepEqual(
			Array.from(
				element.shadowRoot?.querySelectorAll<HTMLOptionElement>( 'select[name="weekday"] option' ) ?? [],
			).map( ( option ) => option.textContent.trim() ),
			Object.values( Weekday ).map( ( weekday ) => `Localized ${ weekday }` ),
		);
	} );

	it( 'round-trips a normalized full-day window without changing its duration', async () => {
		const configuration: ProtectionConfigurationDocument = {
			...TestEmptyProtectionConfiguration,
			schedulesByScope: {
				[ DefaultProtectionScopeId ]: {
					mode: ScheduleMode.CUSTOM,
					windows: [ {
						weekday: Weekday.MONDAY,
						startMinute: 0,
						endMinute: 1_440,
					} ],
				},
			},
		};
		const storage = new MemoryScheduleScreenStorage( configuration );
		const element = await createScreen( storage );

		assert.equal( getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement ).value, '00:00' );
		assert.equal( getRequiredElement( element, 'input[name="end-time"]', HTMLInputElement ).value, '00:00' );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 1 );
		assert.deepEqual(
			storage.configuration?.schedulesByScope[ DefaultProtectionScopeId ],
			configuration.schedulesByScope[ DefaultProtectionScopeId ],
		);
	} );

	it( 'labels independent scopes with a readable site identity and loads their schedule', async () => {
		const element = await createScreen( new MemoryScheduleScreenStorage( POPULATED_CONFIGURATION ) );
		const scopeSelect = getRequiredElement( element, '#schedule-scope', HTMLSelectElement );

		assert.deepEqual(
			Array.from( scopeSelect.options ).map( ( option ) => option.textContent.trim() ),
			[ 'Shared timing', 'ChatGPT (chatgpt.com)' ],
		);

		scopeSelect.value = INDEPENDENT_SCOPE_ID;
		scopeSelect.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );

		assert.isTrue( getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).checked );
		assert.equal( getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement ).value, '09:00' );
		assert.equal( getRequiredElement( element, 'input[name="end-time"]', HTMLInputElement ).value, '17:00' );
	} );

	it( 'sorts independent scope labels while omitting shared and duplicate scope entries', async () => {
		const configuration: ProtectionConfigurationDocument = {
			...POPULATED_CONFIGURATION,
			sites: [ YOUTUBE_SITE, SHARED_SITE, CHATGPT_SITE, SECOND_CHATGPT_SCOPE_SITE ],
			schedulesByScope: {
				...POPULATED_CONFIGURATION.schedulesByScope,
				[ YOUTUBE_SCOPE_ID ]: { mode: ScheduleMode.ALWAYS },
			},
			measurementRevisionsByScope: {
				...POPULATED_CONFIGURATION.measurementRevisionsByScope,
				[ YOUTUBE_SCOPE_ID ]: ProtectionMeasurementRevisionSchema.parse( 'revision_youtube' ),
			},
		};
		const element = await createScreen( new MemoryScheduleScreenStorage( configuration ) );
		element.copy = {
			...TestEnglishLocalizationBundle.schedule,
			compareNames: compareNamesDescending,
		};
		await element.updateComplete;
		const options = getRequiredElement( element, '#schedule-scope', HTMLSelectElement ).options;

		assert.deepEqual(
			Array.from( options ).map( ( option ) => option.textContent.trim() ),
			[ 'Shared timing', 'YouTube (youtube.com)', 'ChatGPT (chatgpt.com)' ],
		);
	} );

	it( 'focuses the first incomplete custom time without writing', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		const element = await createScreen( storage );

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		const startInput = getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement );
		assert.equal( startInput.getAttribute( 'aria-invalid' ), 'true' );
		assert.equal( element.shadowRoot?.activeElement, startInput );
		assert.equal( storage.writes, 0 );
	} );

	it( 'preserves unresolved time feedback after an unrelated row change', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		const element = await createScreen( storage );
		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		const weekday = getRequiredElement( element, 'select[name="weekday"]', HTMLSelectElement );
		const endTime = getRequiredElement( element, 'input[name="end-time"]', HTMLInputElement );
		endTime.value = '09:00';
		endTime.dispatchEvent( new Event( 'input' ) );
		await settleScreen( element );
		weekday.value = Weekday.FRIDAY;
		weekday.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );

		assert.include(
			getRequiredElement( element, 'input[name="start-time"] + .field-error', Element ).textContent,
			'Choose a start time',
		);
		assert.equal(
			getRequiredElement( element, 'input[name="end-time"] + .field-error', Element ).textContent,
			'',
		);
	} );

	it( 'renders active time feedback from the latest localized copy', async () => {
		const element = await createScreen(
			new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } ),
		);

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.schedule,
			startTimeRequiredError: 'Localized start-time error.',
			endTimeRequiredError: 'Localized end-time error.',
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, 'input[name="start-time"] + .field-error', Element ).textContent.trim(),
			'Localized start-time error.',
		);
		assert.equal(
			getRequiredElement( element, 'input[name="end-time"] + .field-error', Element ).textContent.trim(),
			'Localized end-time error.',
		);
	} );

	it( 'focuses equal custom end times with a specific validation message', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		const element = await createScreen( storage );

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		const startTime = getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement );
		const endTime = getRequiredElement( element, 'input[name="end-time"]', HTMLInputElement );
		startTime.value = '09:00';
		endTime.value = '09:00';
		startTime.dispatchEvent( new Event( 'input' ) );
		endTime.dispatchEvent( new Event( 'input' ) );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.include( getRequiredElement( element, 'input[name="end-time"] + .field-error', Element ).textContent, 'different' );
		assert.equal( element.shadowRoot?.activeElement, endTime );
		assert.equal( storage.writes, 0 );
	} );

	it( 'normalizes and saves one overnight schedule', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		const element = await createScreen( storage );

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );

		const weekday = getRequiredElement( element, 'select[name="weekday"]', HTMLSelectElement );
		const startTime = getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement );
		const endTime = getRequiredElement( element, 'input[name="end-time"]', HTMLInputElement );
		weekday.value = Weekday.FRIDAY;
		startTime.value = '22:00';
		endTime.value = '02:00';
		weekday.dispatchEvent( new Event( 'change' ) );
		startTime.dispatchEvent( new Event( 'input' ) );
		endTime.dispatchEvent( new Event( 'input' ) );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.deepEqual( storage.configuration?.schedulesByScope[ DefaultProtectionScopeId ], {
			mode: ScheduleMode.CUSTOM,
			windows: [
				{ weekday: Weekday.FRIDAY, startMinute: 1_320, endMinute: 1_440 },
				{ weekday: Weekday.SATURDAY, startMinute: 0, endMinute: 120 },
			],
		} );
		assert.equal( storage.writes, 1 );
		assert.include( getRequiredElement( element, '.announcement', Element ).textContent, 'saved' );
	} );

	it( 'keeps the custom draft when local persistence fails', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		const element = await createScreen( storage );
		storage.rejectSaves = true;

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		const startTime = getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement );
		const endTime = getRequiredElement( element, 'input[name="end-time"]', HTMLInputElement );
		startTime.value = '08:30';
		endTime.value = '09:30';
		startTime.dispatchEvent( new Event( 'input' ) );
		endTime.dispatchEvent( new Event( 'input' ) );
		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.equal( getRequiredElement( element, 'input[name="start-time"]', HTMLInputElement ).value, '08:30' );
		assert.include( getRequiredElement( element, '.save-error', Element ).textContent, 'not changed' );
		assert.equal( storage.writes, 0 );
	} );

	it( 'renders an active schedule persistence error from the latest localized copy', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		storage.rejectSaves = true;
		const element = await createScreen( storage );

		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.schedule,
			saveError: 'Localized schedule persistence error.',
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, '.save-error', Element ).textContent.trim(),
			'Localized schedule persistence error.',
		);
	} );

	it( 'adds and removes time windows while preserving predictable focus', async () => {
		const element = await createScreen(
			new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } ),
		);

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		getRequiredElement( element, '.add-window-action', HTMLButtonElement ).click();
		await settleScreen( element );

		const weekdays = element.shadowRoot?.querySelectorAll<HTMLSelectElement>( 'select[name="weekday"]' );
		assert.equal( weekdays?.length, 2 );
		assert.equal( element.shadowRoot?.activeElement, weekdays?.item( 1 ) );

		const removeActions = element.shadowRoot?.querySelectorAll<HTMLButtonElement>( '.remove-window-action' );
		removeActions?.item( 1 ).click();
		await settleScreen( element );
		assert.equal( element.shadowRoot?.querySelectorAll( '.schedule-window' ).length, 1 );
		assert.equal( element.shadowRoot?.activeElement, element.shadowRoot?.querySelector( '.remove-window-action' ) );

		getRequiredElement( element, '.remove-window-action', HTMLButtonElement ).click();
		await settleScreen( element );
		assert.equal( element.shadowRoot?.querySelectorAll( '.schedule-window' ).length, 1 );
	} );

	it( 'uses an intermediate row layout when the settings sidebar narrows its content', async () => {
		await setViewport( { height: 700, width: 800 } );
		const element = await createScreen( new MemoryScheduleScreenStorage( POPULATED_CONFIGURATION ) );
		element.style.width = '30rem';
		const scopeSelect = getRequiredElement( element, '#schedule-scope', HTMLSelectElement );
		scopeSelect.value = INDEPENDENT_SCOPE_ID;
		scopeSelect.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );
		const row = getRequiredElement( element, '.schedule-window', HTMLElement );

		assert.equal( getComputedStyle( row ).gridTemplateColumns.split( ' ' ).length, 2 );
		assert.isAtMost( row.scrollWidth, row.clientWidth );
	} );

	it( 'locks scope selection until the current changes are discarded', async () => {
		const element = await createScreen( new MemoryScheduleScreenStorage( POPULATED_CONFIGURATION ) );
		const scopeSelect = getRequiredElement( element, '#schedule-scope', HTMLSelectElement );
		scopeSelect.value = INDEPENDENT_SCOPE_ID;
		scopeSelect.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );

		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="always"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );

		assert.isTrue( scopeSelect.disabled );
		assert.include( getRequiredElement( element, '.dirty-notice', Element ).textContent, 'Save or discard' );
		getRequiredElement( element, '.form-actions .secondary-action', HTMLButtonElement ).click();
		await settleScreen( element );
		assert.isFalse( scopeSelect.disabled );
		assert.equal( element.shadowRoot?.activeElement, scopeSelect );
	} );

	it( 'focuses the restored mode after discarding a shared-scope draft', async () => {
		const element = await createScreen(
			new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } ),
		);
		getRequiredElement(
			element,
			'input[name="schedule-mode"][value="custom"]',
			HTMLInputElement,
		).click();
		await settleScreen( element );
		getRequiredElement( element, '.form-actions .secondary-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement(
				element,
				'input[name="schedule-mode"][value="always"]',
				HTMLInputElement,
			),
		);
	} );

	it( 'shows a local recovery message when the selected scope disappears before save', async () => {
		const storage = new MemoryScheduleScreenStorage( POPULATED_CONFIGURATION );
		const element = await createScreen( storage );
		const scopeSelect = getRequiredElement( element, '#schedule-scope', HTMLSelectElement );
		scopeSelect.value = INDEPENDENT_SCOPE_ID;
		scopeSelect.dispatchEvent( new Event( 'change' ) );
		await settleScreen( element );
		storage.configuration = { ...TestEmptyProtectionConfiguration };

		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );

		assert.include( getRequiredElement( element, '.save-error', Element ).textContent, 'no longer available' );
		assert.equal( storage.writes, 0 );
	} );

	it( 'ignores a duplicate submission while one schedule write is pending', async () => {
		const storage = new DeferredScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		const element = await createScreen( storage );
		const form = getRequiredElement( element, '.schedule-form', HTMLFormElement );

		form.requestSubmit();
		form.requestSubmit();
		await settleScreen( element );

		assert.equal( storage.writes, 1 );
		assert.equal( getRequiredElement( element, '.primary-action', HTMLButtonElement ).textContent.trim(), 'Saving...' );
		storage.completeSave();
		await settleScreen( element );
		assert.equal( getRequiredElement( element, '.primary-action', HTMLButtonElement ).textContent.trim(), 'Save schedule' );
	} );

	it( 'preserves malformed data and focuses the form after a successful retry', async () => {
		const storage = new MemoryScheduleScreenStorage( null );
		const element = await createScreen( storage );

		assert.include( getRequiredElement( element, '.load-error', Element ).textContent, 'not replaced' );
		storage.configuration = { ...TestEmptyProtectionConfiguration };
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement(
				element,
				'input[name="schedule-mode"][value="always"]',
				HTMLInputElement,
			),
		);
	} );

	it( 'restores focus to Retry when loading fails again', async () => {
		const storage = new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } );
		storage.rejectLoads = true;
		const element = await createScreen( storage );
		getRequiredElement( element, '.retry-action', HTMLButtonElement ).click();
		await settleScreen( element );

		assert.equal(
			element.shadowRoot?.activeElement,
			getRequiredElement( element, '.retry-action', HTMLButtonElement ),
		);
	} );

	it( 'recreates the success message so identical saves are announced again', async () => {
		const element = await createScreen(
			new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } ),
		);
		const form = getRequiredElement( element, '.schedule-form', HTMLFormElement );

		form.requestSubmit();
		await settleScreen( element );
		const firstMessage = getRequiredElement( element, '.announcement span', HTMLSpanElement );

		form.requestSubmit();
		await settleScreen( element );
		const secondMessage = getRequiredElement( element, '.announcement span', HTMLSpanElement );

		assert.notEqual( firstMessage, secondMessage );
		assert.equal( secondMessage.textContent.trim(), 'Schedule saved.' );
	} );

	it( 'renders the retained save status from the latest localized copy', async () => {
		const element = await createScreen(
			new MemoryScheduleScreenStorage( { ...TestEmptyProtectionConfiguration } ),
		);

		getRequiredElement( element, '.schedule-form', HTMLFormElement ).requestSubmit();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.schedule,
			savedAnnouncement: 'Localized schedule saved status.',
		};
		await element.updateComplete;

		assert.equal(
			getRequiredElement( element, '.announcement', Element ).textContent.trim(),
			'Localized schedule saved status.',
		);
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentScheduleScreen>( html`<tocus-f-schedule-screen></tocus-f-schedule-screen>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
