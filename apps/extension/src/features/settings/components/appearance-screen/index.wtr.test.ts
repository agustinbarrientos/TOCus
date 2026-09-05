import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import {
	DefaultPreferencesDocument,
	Palette,
	PauseMode,
	PreferencesDocumentSchema,
	ThemeMode,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
} from '../../../../domains/preferences/services/preferences-editor';
import {
	AppearanceControlsChangeEventName,
	ComponentAppearanceControls,
} from '../../../preferences/components/appearance-controls';
import './index';
import { ComponentAppearanceScreen } from './index';
import {
	type AppearancePreferencesChangeListener,
	type PreferencesPreview,
	type PreferencesSource,
} from './types';

/**
 * In-memory preferences editor with controllable local read and write outcomes.
 * @since 0.1.0 Initial implementation.
 */
class MemoryAppearanceEditor implements PreferencesEditor {
	rejectLoads = false;

	rejectSaves = false;

	readonly writes: PreferencesDocument[] = [];

	/**
	 * Creates an editor with one initial preferences result.
	 * @param preferences - Preferences returned by local reads.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public preferences: PreferencesDocument | null ) {}

	/**
	 * Loads current in-memory preferences.
	 * @return Current preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument | null> {
		if ( this.rejectLoads ) {
			return Promise.reject( new Error( 'Local read unavailable.' ) );
		}

		return Promise.resolve( this.preferences );
	}

	/**
	 * Merges one preferences update into the latest in-memory document.
	 * @param input - Preference update candidate.
	 * @return Updated preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	update( input: unknown ): Promise<PreferencesDocument | null> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		if ( this.preferences === null ) {
			return Promise.resolve( null );
		}

		const update = PreferencesUpdateSchema.parse( input );
		const preferences = PreferencesDocumentSchema.parse( {
			...this.preferences,
			...update,
		} );

		this.writes.push( preferences );
		this.preferences = preferences;

		return Promise.resolve( preferences );
	}

	/**
	 * Restores validated default preferences regardless of malformed in-memory data.
	 * @return Restored default preferences.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		this.preferences = DefaultPreferencesDocument;
		this.writes.push( DefaultPreferencesDocument );

		return Promise.resolve( DefaultPreferencesDocument );
	}
}

/**
 * In-memory editor that keeps one preference update pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredAppearanceEditor extends MemoryAppearanceEditor {
	private resolvePendingSave: ( ( preferences: PreferencesDocument ) => void ) | null = null;

	/**
	 * Records one preference update and keeps it pending.
	 * @param input - Preference update candidate.
	 * @return Promise settled with updated preferences after the fixture releases the write.
	 * @since 0.1.0 Initial implementation.
	 */
	override update( input: unknown ): Promise<PreferencesDocument | null> {
		if ( this.preferences === null ) {
			return Promise.resolve( null );
		}

		const update = PreferencesUpdateSchema.parse( input );
		const preferences = PreferencesDocumentSchema.parse( {
			...this.preferences,
			...update,
		} );

		this.writes.push( preferences );
		this.preferences = preferences;

		return new Promise<PreferencesDocument>( ( resolve ) => {
			this.resolvePendingSave = resolve;
		} );
	}

	/**
	 * Completes the pending preference write.
	 * @since 0.1.0 Initial implementation.
	 */
	completeSave(): void {
		if ( this.resolvePendingSave === null ) {
			throw new Error( 'Expected one pending appearance preference write.' );
		}

		const preferences = this.preferences;

		if ( preferences === null ) {
			throw new Error( 'Expected complete in-memory appearance preferences.' );
		}

		this.resolvePendingSave( preferences );
		this.resolvePendingSave = null;
	}
}

/**
 * In-memory editor that keeps its initial local read pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredAppearanceLoadEditor extends MemoryAppearanceEditor {
	private readonly pendingLoadResolutions: Array<(
		preferences: PreferencesDocument | null,
	) => void> = [];

	private readonly pendingLoadRejections: Array<( reason?: unknown ) => void> = [];

	/**
	 * Keeps the local preferences read pending.
	 * @return Promise settled with preferences after the fixture releases the read.
	 * @since 0.1.0 Initial implementation.
	 */
	override load(): Promise<PreferencesDocument | null> {
		return new Promise<PreferencesDocument | null>( ( resolve, reject ) => {
			this.pendingLoadResolutions.push( resolve );
			this.pendingLoadRejections.push( reject );
		} );
	}

	/**
	 * Completes one pending local preferences read.
	 * @param index - Zero-based pending read index.
	 * @param preferences - Preferences or malformed-data marker returned by the read.
	 * @since 0.1.0 Initial implementation.
	 */
	completeLoad( index: number, preferences: PreferencesDocument | null ): void {
		const resolvePendingLoad = this.pendingLoadResolutions[ index ];

		if ( resolvePendingLoad === undefined ) {
			throw new Error( `Expected pending appearance preferences read ${ String( index ) }.` );
		}

		resolvePendingLoad( preferences );
	}

	/**
	 * Rejects one pending local preferences read.
	 * @param index - Zero-based pending read index.
	 * @since 0.1.0 Initial implementation.
	 */
	rejectLoad( index: number ): void {
		const rejectPendingLoad = this.pendingLoadRejections[ index ];

		if ( rejectPendingLoad === undefined ) {
			throw new Error( `Expected pending appearance preferences read ${ String( index ) }.` );
		}

		rejectPendingLoad( new Error( 'Local read unavailable.' ) );
	}
}

/**
 * In-memory editor that keeps malformed-data recovery pending until released.
 * @since 0.1.0 Initial implementation.
 */
class DeferredAppearanceRestoreEditor extends MemoryAppearanceEditor {
	private resolvePendingRestore: (
		( preferences: PreferencesDocument ) => void
	) | null = null;

	/**
	 * Keeps malformed-data recovery pending.
	 * @return Promise settled with authoritative preferences after the fixture releases recovery.
	 * @since 0.1.0 Initial implementation.
	 */
	override restoreDefaults(): Promise<PreferencesDocument> {
		return new Promise<PreferencesDocument>( ( resolve ) => {
			this.resolvePendingRestore = resolve;
		} );
	}

	/**
	 * Completes pending malformed-data recovery.
	 * @param preferences - Preferences returned by recovery.
	 * @since 0.1.0 Initial implementation.
	 */
	completeRestore( preferences: PreferencesDocument ): void {
		if ( this.resolvePendingRestore === null ) {
			throw new Error( 'Expected pending appearance preferences recovery.' );
		}

		this.resolvePendingRestore( preferences );
		this.resolvePendingRestore = null;
	}
}

/**
 * In-memory preview that records each projected preferences document.
 * @since 0.1.0 Initial implementation.
 */
class MemoryPreferencesPreview implements PreferencesPreview {
	readonly projections: PreferencesDocument[] = [];

	/**
	 * Records one projected preferences document.
	 * @param preferences - Preferences projected by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void {
		this.projections.push( preferences );
	}
}

/**
 * In-memory source that emits validated preferences or malformed-data markers from another extension context.
 * @since 0.1.0 Initial implementation.
 */
class MemoryPreferencesSource implements PreferencesSource {
	private readonly listeners = new Set<AppearancePreferencesChangeListener>();

	/**
	 * Begins observing complete preferences projections.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: AppearancePreferencesChangeListener ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops observing complete preferences projections.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: AppearancePreferencesChangeListener ): void {
		this.listeners.delete( listener );
	}

	/**
	 * Emits one complete preferences projection or malformed-data marker to active listeners.
	 * @param preferences - Complete preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	emit( preferences: PreferencesDocument | null ): void {
		for ( const listener of this.listeners ) {
			listener( preferences );
		}
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
 * Returns one required element from the Appearance screen shadow tree.
 * @param element - Rendered Appearance screen.
 * @param selector - Required selector.
 * @param expectedType - Runtime element constructor.
 * @return Matching element.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<T extends Element>(
	element: ComponentAppearanceScreen,
	selector: string,
	expectedType: ElementConstructor<T>,
): T {
	const match = element.shadowRoot?.querySelector( selector ) ??
		element.shadowRoot
			?.querySelector( 'tocus-f-appearance-controls' )
			?.shadowRoot
			?.querySelector( selector );

	assert.instanceOf( match, expectedType );
	if ( ! ( match instanceof expectedType ) ) {
		throw new TypeError( `Expected the Appearance screen to render ${ selector }.` );
	}

	return match;
}

/**
 * Returns the shared appearance controls rendered by the Settings screen.
 * @param element - Rendered Appearance screen.
 * @return Connected shared appearance controls.
 * @since 0.1.0 Initial implementation.
 */
function getAppearanceControls(
	element: ComponentAppearanceScreen,
): ComponentAppearanceControls {
	const controls = element.shadowRoot?.querySelector( 'tocus-f-appearance-controls' );

	assert.instanceOf( controls, ComponentAppearanceControls );
	if ( ! ( controls instanceof ComponentAppearanceControls ) ) {
		throw new TypeError( 'Expected the Appearance screen to render shared appearance controls.' );
	}

	return controls;
}

/**
 * Returns the rendered shadow root owned by the shared appearance controls.
 * @param element - Rendered Appearance screen.
 * @return Shared appearance-controls shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getAppearanceControlsRoot( element: ComponentAppearanceScreen ): ShadowRoot {
	const shadowRoot = getAppearanceControls( element ).shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the shared appearance controls to render a shadow root.' );
	}

	return shadowRoot;
}

/**
 * Verifies focus across either the Settings or shared appearance-control shadow boundary.
 * @param element - Rendered Appearance screen.
 * @param input - Preference control expected to own focus.
 * @since 0.1.0 Initial implementation.
 */
function assertPreferenceControlFocused(
	element: ComponentAppearanceScreen,
	input: HTMLInputElement,
): void {
	const controls = element.shadowRoot?.querySelector( 'tocus-f-appearance-controls' );

	if ( controls instanceof ComponentAppearanceControls && controls.shadowRoot?.contains( input ) ) {
		assert.equal( element.shadowRoot?.activeElement, controls );
		assert.equal( controls.shadowRoot.activeElement, input );
		return;
	}

	assert.equal( element.shadowRoot?.activeElement, input );
}

/**
 * Waits for the screen's initial local read and Lit update.
 * @param element - Appearance screen expected to update.
 * @return Promise resolved after asynchronous loading settles.
 * @since 0.1.0 Initial implementation.
 */
async function settleScreen( element: ComponentAppearanceScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
	const controls = element.shadowRoot?.querySelector( 'tocus-f-appearance-controls' );

	if ( controls instanceof ComponentAppearanceControls ) {
		await controls.updateComplete;
	}
}

/**
 * Renders one ready Appearance screen around the supplied editor.
 * @param editor - Coordinated local preferences editor.
 * @param preview - Optional live appearance preview.
 * @param source - Optional validated preferences projection source.
 * @return Ready Appearance screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderScreen(
	editor: MemoryAppearanceEditor,
	preview: PreferencesPreview | null = null,
	source: PreferencesSource | null = null,
): Promise<ComponentAppearanceScreen> {
	const element = await fixture<ComponentAppearanceScreen>( html`
		<tocus-f-appearance-screen
			.copy=${ TestEnglishLocalizationBundle.appearance }
			.editor=${ editor }
			.preview=${ preview }
			.source=${ source }
		></tocus-f-appearance-screen>
	` );

	await settleScreen( element );

	return element;
}

describe( 'tocus-f-appearance-screen', () => {
	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-appearance-screen' ), ComponentAppearanceScreen );
	} );

	it( 'loads every approved preference into semantic native controls', async () => {
		const preferences: PreferencesDocument = {
			...DefaultPreferencesDocument,
			theme: ThemeMode.DARK,
			palette: Palette.PURPLE,
			pauseMode: PauseMode.QUIET,
			reducedMotion: true,
		};
		const element = await renderScreen( new MemoryAppearanceEditor( preferences ) );
		const sharedControls = getAppearanceControls( element );
		const sharedRoot = getAppearanceControlsRoot( element );
		const themeInputs = sharedRoot.querySelectorAll<HTMLInputElement>( 'input[name="theme"]' );
		const paletteInputs = sharedRoot.querySelectorAll<HTMLInputElement>( 'input[name="palette"]' );
		const pauseInputs = element.shadowRoot?.querySelectorAll<HTMLInputElement>( 'input[name="pause-mode"]' );
		const reducedMotion = getRequiredElement( element, '#reduced-motion', HTMLInputElement );

		assert.equal( sharedControls.theme, ThemeMode.DARK );
		assert.equal( sharedControls.palette, Palette.PURPLE );
		assert.strictEqual( sharedControls.copy, element.copy );
		assert.isFalse( sharedControls.disabled );
		assert.equal( themeInputs.length, 3 );
		assert.equal( paletteInputs.length, 6 );
		assert.equal( pauseInputs?.length, 2 );
		assert.isTrue( getRequiredElement( element, '#theme-dark', HTMLInputElement ).checked );
		assert.isTrue( getRequiredElement( element, '#palette-purple', HTMLInputElement ).checked );
		assert.isTrue( getRequiredElement( element, '#pause-mode-quiet', HTMLInputElement ).checked );
		assert.isTrue( reducedMotion.checked );
		await expect( element ).to.be.accessible();
	} );

	it( 'keeps Settings-only controls full width without an enclosing settings box', async () => {
		const element = await renderScreen( new MemoryAppearanceEditor( {
			...DefaultPreferencesDocument,
		} ) );
		const form = getRequiredElement( element, '.appearance-form', HTMLFormElement );
		const pauseOptions = getRequiredElement( element, '.options--pause', HTMLDivElement );
		const pauseRows = [ ...pauseOptions.querySelectorAll<HTMLElement>( '.option' ) ];
		const pauseSelections = [ ...pauseOptions.querySelectorAll<HTMLElement>( '.selection' ) ];
		const motionOption = getRequiredElement( element, '.motion-option', HTMLLabelElement );
		const formStyle = getComputedStyle( form );
		const pauseBounds = pauseOptions.getBoundingClientRect();

		assert.equal( formStyle.borderTopWidth, '0px' );
		assert.equal( formStyle.paddingTop, '0px' );
		assert.equal( formStyle.backgroundColor, 'rgba(0, 0, 0, 0)' );
		assert.lengthOf( pauseRows, 2 );
		assert.lengthOf( pauseSelections, 2 );
		assert.closeTo( pauseRows[ 0 ]?.getBoundingClientRect().width ?? 0, pauseBounds.width, 0.5 );
		assert.closeTo( pauseRows[ 1 ]?.getBoundingClientRect().width ?? 0, pauseBounds.width, 0.5 );
		assert.closeTo(
			pauseRows[ 0 ]?.getBoundingClientRect().height ?? 0,
			pauseRows[ 1 ]?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY,
			0.5,
		);
		for ( const selection of pauseSelections ) {
			assert.equal( getComputedStyle( selection ).borderTopWidth, '1px' );
			assert.notEqual( getComputedStyle( selection ).borderTopColor, 'rgba(0, 0, 0, 0)' );
		}
		assert.isAtLeast(
			pauseRows[ 1 ]?.getBoundingClientRect().top ?? 0,
			pauseRows[ 0 ]?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
		);
		assert.closeTo(
			motionOption.getBoundingClientRect().width,
			motionOption.parentElement?.getBoundingClientRect().width ?? 0,
			0.5,
		);
	} );

	it( 'projects loaded preferences without writing them', async () => {
		const preferences: PreferencesDocument = {
			...DefaultPreferencesDocument,
			palette: Palette.BLUE,
		};
		const storage = new MemoryAppearanceEditor( preferences );
		const preview = new MemoryPreferencesPreview();

		await renderScreen( storage, preview );

		assert.deepEqual( preview.projections, [ preferences ] );
		assert.deepEqual( storage.writes, [] );
	} );

	it( 'tracks external preference changes after disconnecting and reconnecting', async () => {
		const source = new MemoryPreferencesSource();
		const editor = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen(
			editor,
			null,
			source,
		);

		source.emit( {
			...DefaultPreferencesDocument,
			palette: Palette.PURPLE,
			theme: ThemeMode.DARK,
		} );
		await element.updateComplete;
		assert.isTrue( getRequiredElement( element, '#theme-dark', HTMLInputElement ).checked );
		assert.isTrue( getRequiredElement( element, '#palette-purple', HTMLInputElement ).checked );

		element.remove();
		const disconnectedPreferences = {
			...DefaultPreferencesDocument,
			palette: Palette.GREEN,
		};

		editor.preferences = disconnectedPreferences;
		source.emit( disconnectedPreferences );
		document.body.append( element );
		await settleScreen( element );
		assert.isTrue( getRequiredElement( element, '#palette-green', HTMLInputElement ).checked );

		source.emit( { ...DefaultPreferencesDocument, palette: Palette.ORANGE } );
		await element.updateComplete;

		assert.isTrue( getRequiredElement( element, '#palette-orange', HTMLInputElement ).checked );
	} );

	it( 'stops observing a replaced preferences source', async () => {
		const originalSource = new MemoryPreferencesSource();
		const replacementSource = new MemoryPreferencesSource();
		const element = await renderScreen(
			new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } ),
			null,
			originalSource,
		);

		element.source = replacementSource;
		await element.updateComplete;
		originalSource.emit( { ...DefaultPreferencesDocument, palette: Palette.PURPLE } );
		replacementSource.emit( { ...DefaultPreferencesDocument, palette: Palette.GREEN } );
		await element.updateComplete;

		assert.isTrue( getRequiredElement( element, '#palette-green', HTMLInputElement ).checked );
	} );

	it( 'shows recovery when another context reports malformed preferences', async () => {
		const source = new MemoryPreferencesSource();
		const element = await renderScreen(
			new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } ),
			null,
			source,
		);

		source.emit( null );
		await element.updateComplete;
		assert.instanceOf(
			element.shadowRoot?.querySelector( '.restore-action' ),
			HTMLButtonElement,
		);

		source.emit( { ...DefaultPreferencesDocument, palette: Palette.GREEN } );
		await element.updateComplete;
		assert.isTrue( getRequiredElement( element, '#palette-green', HTMLInputElement ).checked );
	} );

	it( 'does not let a stale initial read replace a newer malformed-data event', async () => {
		const editor = new DeferredAppearanceLoadEditor( { ...DefaultPreferencesDocument } );
		const source = new MemoryPreferencesSource();
		const element = await fixture<ComponentAppearanceScreen>( html`
			<tocus-f-appearance-screen
			.copy=${ TestEnglishLocalizationBundle.appearance }
				.editor=${ editor }
				.source=${ source }
			></tocus-f-appearance-screen>
		` );

		source.emit( null );
		editor.completeLoad( 0, DefaultPreferencesDocument );
		await settleScreen( element );

		assert.instanceOf(
			element.shadowRoot?.querySelector( '.restore-action' ),
			HTMLButtonElement,
		);
	} );

	it( 'ignores an old local read that settles after a reconnect read', async () => {
		const oldPreferences = { ...DefaultPreferencesDocument, palette: Palette.BLUE };
		const currentPreferences = { ...DefaultPreferencesDocument, palette: Palette.GREEN };
		const editor = new DeferredAppearanceLoadEditor( oldPreferences );
		const preview = new MemoryPreferencesPreview();
		const element = await fixture<ComponentAppearanceScreen>( html`
			<tocus-f-appearance-screen
			.copy=${ TestEnglishLocalizationBundle.appearance }
				.editor=${ editor }
				.preview=${ preview }
			></tocus-f-appearance-screen>
		` );

		element.remove();
		document.body.append( element );
		editor.completeLoad( 1, currentPreferences );
		await settleScreen( element );
		assert.isTrue( getRequiredElement( element, '#palette-green', HTMLInputElement ).checked );

		editor.completeLoad( 0, oldPreferences );
		await settleScreen( element );

		assert.isTrue( getRequiredElement( element, '#palette-green', HTMLInputElement ).checked );
		assert.deepEqual( preview.projections, [ currentPreferences ] );
	} );

	it( 'ignores an old local read failure after a reconnect read succeeds', async () => {
		const currentPreferences = { ...DefaultPreferencesDocument, palette: Palette.PINK };
		const editor = new DeferredAppearanceLoadEditor( DefaultPreferencesDocument );
		const element = await fixture<ComponentAppearanceScreen>( html`
			<tocus-f-appearance-screen
			.copy=${ TestEnglishLocalizationBundle.appearance } .editor=${ editor }></tocus-f-appearance-screen>
		` );

		element.remove();
		document.body.append( element );
		editor.completeLoad( 1, currentPreferences );
		await settleScreen( element );
		editor.rejectLoad( 0 );
		await settleScreen( element );

		assert.isTrue( getRequiredElement( element, '#palette-pink', HTMLInputElement ).checked );
	} );

	const preferenceChanges = [
		{ selector: '#theme-light', field: 'theme', value: ThemeMode.LIGHT },
		{ selector: '#palette-green', field: 'palette', value: Palette.GREEN },
		{ selector: '#pause-mode-quiet', field: 'pauseMode', value: PauseMode.QUIET },
	];

	for ( const preferenceChange of preferenceChanges ) {
		it( `saves and previews a changed ${ preferenceChange.field } immediately`, async () => {
			const storage = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
			const preview = new MemoryPreferencesPreview();
			const element = await renderScreen( storage, preview );
			const input = getRequiredElement( element, preferenceChange.selector, HTMLInputElement );

			input.focus();
			input.click();
			await settleScreen( element );

			assert.lengthOf( storage.writes, 1 );
			assert.deepInclude( storage.writes[ 0 ] ?? {}, {
				[ preferenceChange.field ]: preferenceChange.value,
			} );
			assert.deepInclude( preview.projections.at( -1 ) ?? {}, {
				[ preferenceChange.field ]: preferenceChange.value,
			} );
			assertPreferenceControlFocused( element, input );
			assert.include( element.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '', 'saved' );
		} );
	}

	it( 'saves the explicit reduced-motion setting without resolving the operating system', async () => {
		const storage = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const preview = new MemoryPreferencesPreview();
		const element = await renderScreen( storage, preview );
		const input = getRequiredElement( element, '#reduced-motion', HTMLInputElement );

		input.click();
		await settleScreen( element );

		assert.isTrue( storage.writes.at( -1 )?.reducedMotion );
		assert.isTrue( preview.projections.at( -1 )?.reducedMotion );
	} );

	it( 'keeps a failed choice visible and returns focus to its control', async () => {
		const storage = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen( storage );
		const input = getRequiredElement( element, '#palette-orange', HTMLInputElement );

		storage.rejectSaves = true;
		input.focus();
		input.click();
		await settleScreen( element );

		assert.isTrue( input.checked );
		assertPreferenceControlFocused( element, input );
		assert.include(
			element.shadowRoot?.querySelector( '[role="alert"]' )?.textContent ?? '',
			'could not be saved',
		);
	} );

	it( 'returns keyboard focus after an asynchronous preference save', async () => {
		const storage = new DeferredAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen( storage );
		const input = getRequiredElement( element, '#palette-blue', HTMLInputElement );

		input.focus();
		input.click();
		await element.updateComplete;
		storage.completeSave();
		await settleScreen( element );

		assertPreferenceControlFocused( element, input );
	} );

	it( 'keeps a newer external projection when an older save settles', async () => {
		const editor = new DeferredAppearanceEditor( { ...DefaultPreferencesDocument } );
		const source = new MemoryPreferencesSource();
		const element = await renderScreen( editor, null, source );
		const input = getRequiredElement( element, '#palette-green', HTMLInputElement );

		input.click();
		await element.updateComplete;
		source.emit( {
			...DefaultPreferencesDocument,
			palette: Palette.ORANGE,
			theme: ThemeMode.DARK,
		} );
		await element.updateComplete;
		editor.completeSave();
		await settleScreen( element );

		assert.isTrue( getRequiredElement( element, '#palette-orange', HTMLInputElement ).checked );
		assert.isTrue( getRequiredElement( element, '#theme-dark', HTMLInputElement ).checked );
		assert.notInclude(
			element.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '',
			'saved',
		);
	} );

	it( 'offers recovery when stored data becomes malformed before a save', async () => {
		const editor = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen( editor );

		editor.preferences = null;
		getRequiredElement( element, '#palette-blue', HTMLInputElement ).click();
		await settleScreen( element );

		assert.instanceOf(
			element.shadowRoot?.querySelector( '.restore-action' ),
			HTMLButtonElement,
		);
	} );

	it( 'removes an earlier success announcement when a later save fails', async () => {
		const storage = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen( storage );

		getRequiredElement( element, '#palette-blue', HTMLInputElement ).click();
		await settleScreen( element );
		storage.rejectSaves = true;
		getRequiredElement( element, '#palette-pink', HTMLInputElement ).click();
		await settleScreen( element );

		assert.notInclude(
			element.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '',
			'Appearance saved',
		);
		assert.include(
			element.shadowRoot?.querySelector( '[role="alert"]' )?.textContent ?? '',
			'could not be saved',
		);
	} );

	it( 'renders a pending save error with the latest localized copy', async () => {
		const storage = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen( storage );

		storage.rejectSaves = true;
		getRequiredElement( element, '#palette-blue', HTMLInputElement ).click();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.appearance,
			saveError: 'Localized save error.',
		};
		await element.updateComplete;

		assert.include( element.shadowRoot?.textContent ?? '', 'Localized save error.' );
		assert.notInclude( element.shadowRoot?.textContent ?? '', 'Your appearance could not be saved.' );
	} );

	it( 'renders a success announcement with the latest localized copy', async () => {
		const element = await renderScreen( new MemoryAppearanceEditor( {
			...DefaultPreferencesDocument,
		} ) );

		getRequiredElement( element, '#palette-blue', HTMLInputElement ).click();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.appearance,
			savedAnnouncement: 'Localized appearance saved.',
		};
		await element.updateComplete;

		assert.include( element.shadowRoot?.textContent ?? '', 'Localized appearance saved.' );
		assert.notInclude( element.shadowRoot?.textContent ?? '', 'Appearance saved.' );
	} );

	it( 'ignores unavailable, pending, unchecked, unsupported, and invalid changes', async () => {
		const storage = new DeferredAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await renderScreen( storage );
		const controls = getAppearanceControls( element );
		const themeInput = getRequiredElement( element, '#theme-light', HTMLInputElement );

		themeInput.click();
		await element.updateComplete;

		const pendingInput = getRequiredElement( element, '#palette-green', HTMLInputElement );
		assert.isTrue( pendingInput.dispatchEvent( new Event( 'change' ) ) );
		controls.dispatchEvent( new CustomEvent( AppearanceControlsChangeEventName, {
			bubbles: true,
			composed: true,
			detail: { update: { palette: Palette.GREEN } },
		} ) );
		storage.completeSave();
		await settleScreen( element );
		assert.lengthOf( storage.writes, 1 );

		const uncheckedInput = getRequiredElement( element, '#pause-mode-quiet', HTMLInputElement );
		assert.isTrue( uncheckedInput.dispatchEvent( new Event( 'change' ) ) );

		const unsupportedInput = getRequiredElement( element, '#pause-mode-quiet', HTMLInputElement );
		unsupportedInput.name = 'unsupported';
		unsupportedInput.checked = true;
		assert.isTrue( unsupportedInput.dispatchEvent( new Event( 'change' ) ) );

		const invalidInput = getRequiredElement( element, '#pause-mode-breathing', HTMLInputElement );
		invalidInput.value = 'instant';
		invalidInput.checked = true;
		assert.isTrue( invalidInput.dispatchEvent( new Event( 'change' ) ) );
		controls.dispatchEvent( new CustomEvent( AppearanceControlsChangeEventName, {
			bubbles: true,
			composed: true,
			detail: { update: { theme: 'sepia' } },
		} ) );
		controls.dispatchEvent( new CustomEvent( AppearanceControlsChangeEventName, {
			bubbles: true,
			composed: true,
			detail: { update: { pauseMode: PauseMode.QUIET } },
		} ) );

		element.editor = null;
		const unavailableInput = getRequiredElement( element, '#reduced-motion', HTMLInputElement );
		unavailableInput.checked = true;
		assert.isTrue( unavailableInput.dispatchEvent( new Event( 'change' ) ) );
		await settleScreen( element );

		assert.lengthOf( storage.writes, 1 );
	} );

	it( 'keeps the retry action focused when no storage dependency is available', async () => {
		const element = await fixture<ComponentAppearanceScreen>( html`
			<tocus-f-appearance-screen
			.copy=${ TestEnglishLocalizationBundle.appearance }></tocus-f-appearance-screen>
		` );

		await settleScreen( element );
		const retry = getRequiredElement( element, '.retry-action', HTMLButtonElement );

		retry.click();
		await settleScreen( element );

		assert.equal( element.shadowRoot?.activeElement, retry );
	} );

	it( 'restores invalid local personalization data to defaults only after confirmation', async () => {
		const storage = new MemoryAppearanceEditor( null );
		const preview = new MemoryPreferencesPreview();
		const element = await renderScreen( storage, preview );
		const restore = getRequiredElement( element, '.restore-action', HTMLButtonElement );

		assert.include( element.shadowRoot?.textContent ?? '', 'Personalization settings need your attention' );
		assert.include( element.shadowRoot?.textContent ?? '', 'appearance, pause, motion, and language preferences' );
		assert.include( restore.textContent, 'Restore personalization defaults' );
		restore.click();
		await settleScreen( element );

		assert.deepEqual( storage.writes, [ DefaultPreferencesDocument ] );
		assert.deepEqual( preview.projections, [ DefaultPreferencesDocument ] );
		assert.isNull( element.shadowRoot?.querySelector( '[role="alert"]' ) ?? null );
		assert.include(
			element.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '',
			'Personalization defaults restored.',
		);
		assertPreferenceControlFocused(
			element,
			getRequiredElement( element, '#theme-system', HTMLInputElement ),
		);
	} );

	it( 'keeps a newer external projection when older recovery settles', async () => {
		const editor = new DeferredAppearanceRestoreEditor( null );
		const source = new MemoryPreferencesSource();
		const element = await renderScreen( editor, null, source );
		const restore = getRequiredElement( element, '.restore-action', HTMLButtonElement );
		const externalPreferences = {
			...DefaultPreferencesDocument,
			palette: Palette.PURPLE,
			theme: ThemeMode.DARK,
		};

		restore.click();
		await element.updateComplete;
		source.emit( externalPreferences );
		await element.updateComplete;
		editor.completeRestore( DefaultPreferencesDocument );
		await settleScreen( element );

		assert.isTrue( getRequiredElement( element, '#palette-purple', HTMLInputElement ).checked );
		assert.isTrue( getRequiredElement( element, '#theme-dark', HTMLInputElement ).checked );
		assert.notInclude(
			element.shadowRoot?.querySelector( '[role="status"]' )?.textContent ?? '',
			'saved',
		);
	} );

	it( 'ignores duplicate or unavailable recovery requests', async () => {
		const deferredEditor = new DeferredAppearanceRestoreEditor( null );
		const pendingElement = await renderScreen( deferredEditor );
		const pendingRestore = getRequiredElement(
			pendingElement,
			'.restore-action',
			HTMLButtonElement,
		);

		pendingRestore.dispatchEvent( new Event( 'click' ) );
		pendingRestore.dispatchEvent( new Event( 'click' ) );
		deferredEditor.completeRestore( DefaultPreferencesDocument );
		await settleScreen( pendingElement );

		const unavailableEditor = new MemoryAppearanceEditor( null );
		const unavailableElement = await renderScreen( unavailableEditor );
		const unavailableRestore = getRequiredElement(
			unavailableElement,
			'.restore-action',
			HTMLButtonElement,
		);

		unavailableElement.editor = null;
		unavailableRestore.dispatchEvent( new Event( 'click' ) );
		await settleScreen( unavailableElement );

		assert.deepEqual( unavailableEditor.writes, [] );
	} );

	it( 'keeps invalid local appearance data recoverable when restoring defaults fails', async () => {
		const storage = new MemoryAppearanceEditor( null );

		storage.rejectSaves = true;
		const element = await renderScreen( storage );
		const restore = getRequiredElement( element, '.restore-action', HTMLButtonElement );

		restore.click();
		await settleScreen( element );

		assert.include(
			element.shadowRoot?.querySelector( '[role="alert"]' )?.textContent ?? '',
			'could not restore',
		);
		assert.equal( element.shadowRoot?.activeElement, restore );
	} );

	it( 'renders a recovery error with the latest localized copy', async () => {
		const storage = new MemoryAppearanceEditor( null );

		storage.rejectSaves = true;
		const element = await renderScreen( storage );
		getRequiredElement( element, '.restore-action', HTMLButtonElement ).click();
		await settleScreen( element );
		element.copy = {
			...TestEnglishLocalizationBundle.appearance,
			restoreDefaultsError: 'Localized recovery error.',
		};
		await element.updateComplete;

		assert.include( element.shadowRoot?.textContent ?? '', 'Localized recovery error.' );
		assert.notInclude( element.shadowRoot?.textContent ?? '', 'TOCus could not restore' );
	} );

	it( 'retries a failed local appearance read', async () => {
		const storage = new MemoryAppearanceEditor( {
			...DefaultPreferencesDocument,
			theme: ThemeMode.DARK,
		} );

		storage.rejectLoads = true;
		const element = await renderScreen( storage );
		const alert = element.shadowRoot?.querySelector( '[role="alert"]' );
		const retry = getRequiredElement( element, '.retry-action', HTMLButtonElement );

		assert.isNotNull( alert );
		storage.rejectLoads = false;
		retry.click();
		await settleScreen( element );

		assert.isNull( element.shadowRoot?.querySelector( '[role="alert"]' ) ?? null );
		assertPreferenceControlFocused(
			element,
			getRequiredElement( element, '#theme-dark', HTMLInputElement ),
		);
	} );

	it( 'lets system colors control the selected-card surface in forced colors', async () => {
		await emulateMedia( { colorScheme: 'dark', forcedColors: 'active' } );

		try {
			const element = await renderScreen( new MemoryAppearanceEditor( {
				...DefaultPreferencesDocument,
				pauseMode: PauseMode.QUIET,
			} ) );
			const selectedSurface = getRequiredElement(
				element,
				'#pause-mode-quiet + .selection',
				HTMLSpanElement,
			);

			assert.equal( getComputedStyle( selectedSurface ).forcedColorAdjust, 'auto' );
		} finally {
			await emulateMedia( { colorScheme: 'light', forcedColors: 'none' } );
		}
	} );

	it( 'renders injected copy without changing the preference contract', async () => {
		const storage = new MemoryAppearanceEditor( { ...DefaultPreferencesDocument } );
		const element = await fixture<ComponentAppearanceScreen>( html`
			<tocus-f-appearance-screen
				.editor=${ storage }
				.copy=${ {
					...TestEnglishLocalizationBundle.appearance,
					title: 'Apariencia',
					themeLegend: 'Tema',
				} }
			></tocus-f-appearance-screen>
		` );

		await settleScreen( element );
		const controls = getAppearanceControls( element );

		await controls.updateComplete;

		assert.include( element.shadowRoot?.querySelector( 'h1' )?.textContent ?? '', 'Apariencia' );
		assert.include( controls.shadowRoot?.querySelector( 'legend' )?.textContent ?? '', 'Tema' );
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentAppearanceScreen>( html`<tocus-f-appearance-screen></tocus-f-appearance-screen>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
