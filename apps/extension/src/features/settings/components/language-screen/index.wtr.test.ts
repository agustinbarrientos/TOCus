import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	DefaultPreferencesDocument,
	Language,
	PreferencesDocumentSchema,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import {
	PreferencesUpdateSchema,
	type PreferencesEditor,
} from '../../../../domains/preferences/services/preferences-editor';
import './index';
import { ComponentLanguageScreen } from './index';
import {
	type LanguagePreferencesChangeListener,
	type LanguagePreferencesPreview,
	type LanguagePreferencesSource,
} from './types';

/**
 * In-memory preferences editor used by Language screen behavior tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryLanguageEditor implements PreferencesEditor {
	rejectLoads = false;

	rejectSaves = false;

	readonly updates: unknown[] = [];

	/**
	 * Creates an editor with one initial preferences result.
	 * @param preferences - Preferences returned by local reads.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( public preferences: PreferencesDocument | null ) {}

	/**
	 * Loads the current in-memory preferences or rejects when configured.
	 * @return Current preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument | null> {
		return this.rejectLoads
			? Promise.reject( new Error( 'Local read unavailable.' ) )
			: Promise.resolve( this.preferences );
	}

	/**
	 * Applies one validated language update or rejects when configured.
	 * @param input - Unknown preferences update.
	 * @return Updated preferences or malformed-data marker.
	 * @since 0.1.0 Initial implementation.
	 */
	update( input: unknown ): Promise<PreferencesDocument | null> {
		const update = PreferencesUpdateSchema.parse( input );

		this.updates.push( update );

		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		if ( this.preferences === null ) {
			return Promise.resolve( null );
		}

		this.preferences = PreferencesDocumentSchema.parse( {
			...this.preferences,
			...update,
		} );

		return Promise.resolve( this.preferences );
	}

	/**
	 * Restores safe defaults for the complete preferences document.
	 * @return Default preferences document.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		if ( this.rejectSaves ) {
			return Promise.reject( new Error( 'Local write unavailable.' ) );
		}

		this.preferences = { ...DefaultPreferencesDocument };

		return Promise.resolve( this.preferences );
	}
}

/**
 * In-memory preferences editor that publishes the persisted document before its update promise resolves.
 * @since 0.1.0 Initial implementation.
 */
class EchoingLanguageEditor extends MemoryLanguageEditor {
	/**
	 * Creates an editor with one current document and its production-shaped storage projection.
	 * @param preferences - Preferences returned by local reads.
	 * @param source - Projection that receives the persisted document.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor(
		preferences: PreferencesDocument,
		private readonly source: MemoryLanguageSource,
	) {
		super( preferences );
	}

	/**
	 * Persists one language update and publishes its storage echo before resolving.
	 * @param input - Unknown preferences update.
	 * @return Updated preferences document.
	 * @since 0.1.0 Initial implementation.
	 */
	override async update( input: unknown ): Promise<PreferencesDocument | null> {
		const preferences = await super.update( input );

		this.source.emit( preferences );

		return preferences;
	}
}

/**
 * Deferred preferences editor used to verify stale Language screen operations.
 * @since 0.1.0 Initial implementation.
 */
class DeferredLanguageEditor implements PreferencesEditor {
	updateCalls = 0;

	restoreCalls = 0;

	private readonly loadResolvers: Array<( preferences: PreferencesDocument | null ) => void> = [];

	private readonly updateResolvers: Array<( preferences: PreferencesDocument | null ) => void> = [];

	private readonly restoreResolvers: Array<( preferences: PreferencesDocument ) => void> = [];

	/**
	 * Defers one preferences read until its matching test resolves it.
	 * @return Pending preferences result.
	 * @since 0.1.0 Initial implementation.
	 */
	load(): Promise<PreferencesDocument | null> {
		return new Promise( ( resolve ) => {
			this.loadResolvers.push( resolve );
		} );
	}

	/**
	 * Defers one preferences update until its matching test resolves it.
	 * @param input - Unknown preferences update retained only for contract compatibility.
	 * @return Pending preferences result.
	 * @since 0.1.0 Initial implementation.
	 */
	update( input: unknown ): Promise<PreferencesDocument | null> {
		PreferencesUpdateSchema.parse( input );
		this.updateCalls += 1;

		return new Promise( ( resolve ) => {
			this.updateResolvers.push( resolve );
		} );
	}

	/**
	 * Defers one preferences recovery until its matching test resolves it.
	 * @return Pending restored preferences document.
	 * @since 0.1.0 Initial implementation.
	 */
	restoreDefaults(): Promise<PreferencesDocument> {
		this.restoreCalls += 1;

		return new Promise( ( resolve ) => {
			this.restoreResolvers.push( resolve );
		} );
	}

	/**
	 * Resolves one pending preferences read.
	 * @param index - Zero-based read index.
	 * @param preferences - Preferences result delivered to the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	completeLoad( index: number, preferences: PreferencesDocument | null ): void {
		this.loadResolvers[ index ]?.( preferences );
	}

	/**
	 * Resolves one pending preferences update.
	 * @param index - Zero-based update index.
	 * @param preferences - Preferences result delivered to the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	completeUpdate( index: number, preferences: PreferencesDocument | null ): void {
		this.updateResolvers[ index ]?.( preferences );
	}

	/**
	 * Resolves one pending preferences recovery.
	 * @param index - Zero-based recovery index.
	 * @param preferences - Authoritative preferences returned by recovery.
	 * @since 0.1.0 Initial implementation.
	 */
	completeRestore( index: number, preferences: PreferencesDocument ): void {
		this.restoreResolvers[ index ]?.( preferences );
	}
}

/**
 * In-memory preferences preview used by Language screen behavior tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryLanguagePreview implements LanguagePreferencesPreview {
	readonly projections: PreferencesDocument[] = [];

	/**
	 * Records one complete in-memory preferences projection.
	 * @param preferences - Preferences projected by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void {
		this.projections.push( preferences );
	}
}

/**
 * In-memory preferences source used by Language screen behavior tests.
 * @since 0.1.0 Initial implementation.
 */
class MemoryLanguageSource implements LanguagePreferencesSource {
	private readonly listeners = new Set<LanguagePreferencesChangeListener>();

	/**
	 * Begins delivering complete preferences projections to one listener.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: LanguagePreferencesChangeListener ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops delivering preferences projections to one listener.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: LanguagePreferencesChangeListener ): void {
		this.listeners.delete( listener );
	}

	/**
	 * Delivers one preferences projection to every current listener.
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
 * Production-shaped projection that previews preferences and immediately emits them to subscribers.
 * @since 0.1.0 Initial implementation.
 */
class MemoryLanguageProjection implements LanguagePreferencesPreview, LanguagePreferencesSource {
	private readonly listeners = new Set<LanguagePreferencesChangeListener>();

	readonly projections: PreferencesDocument[] = [];

	/**
	 * Projects preferences and synchronously publishes them like the real preferences controller.
	 * @param preferences - Complete optimistic preferences projection.
	 * @since 0.1.0 Initial implementation.
	 */
	apply( preferences: PreferencesDocument ): void {
		this.projections.push( preferences );

		for ( const listener of this.listeners ) {
			listener( preferences );
		}
	}

	/**
	 * Begins delivering projected preferences to one listener.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	addPreferencesChangeListener( listener: LanguagePreferencesChangeListener ): void {
		this.listeners.add( listener );
	}

	/**
	 * Stops delivering projected preferences to one listener.
	 * @param listener - Preferences projection listener.
	 * @since 0.1.0 Initial implementation.
	 */
	removePreferencesChangeListener( listener: LanguagePreferencesChangeListener ): void {
		this.listeners.delete( listener );
	}
}

/**
 * Returns one required Language screen descendant with a validated runtime class.
 * @template Element Expected element class.
 * @param screen - Rendered Language settings screen.
 * @param selector - Shadow-root selector for the required descendant.
 * @param constructor - Expected runtime element constructor.
 * @return Matching descendant.
 * @since 0.1.0 Initial implementation.
 */
function getRequiredElement<Element extends globalThis.Element>(
	screen: ComponentLanguageScreen,
	selector: string,
	constructor: { new(): Element },
): Element {
	const element = screen.shadowRoot?.querySelector( selector );

	assert.instanceOf( element, constructor );

	return element;
}

/**
 * Waits for asynchronous preference work and the following Lit update.
 * @param screen - Language settings screen whose work should settle.
 * @return Promise resolved after asynchronous component work settles.
 * @since 0.1.0 Initial implementation.
 */
async function settleScreen( screen: ComponentLanguageScreen ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await screen.updateComplete;
}

/**
 * Renders one ready Language settings screen with complete local dependencies.
 * @param editor - Preferences editor used by the screen.
 * @param preview - Optional live preferences preview.
 * @param source - Optional cross-context preferences source.
 * @return Connected and ready Language settings screen.
 * @since 0.1.0 Initial implementation.
 */
async function renderScreen(
	editor: PreferencesEditor,
	preview: LanguagePreferencesPreview | null = null,
	source: LanguagePreferencesSource | null = null,
): Promise<ComponentLanguageScreen> {
	const screen = await fixture<ComponentLanguageScreen>( html`
		<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen }
			.editor=${ editor }
			.preview=${ preview }
			.source=${ source }
			.browserLanguage=${ Language.ENGLISH }
		></tocus-f-language-screen>
	` );

	await settleScreen( screen );

	return screen;
}

describe( 'tocus-f-language-screen', () => {
	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-language-screen' ), ComponentLanguageScreen );
	} );

	it( 'renders browser-following plus every approved language as stable native options', async () => {
		const screen = await renderScreen( new MemoryLanguageEditor( DefaultPreferencesDocument ) );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );
		const options = [ ...select.options ].map( ( option ) => ( {
			label: option.textContent.trim(),
			languageTag: option.lang,
			value: option.value,
		} ) );

		assert.deepEqual( options, [
			{ label: 'Use browser language', languageTag: '', value: '' },
			{ label: 'English', languageTag: 'en', value: 'en' },
			{ label: 'Espa\u00f1ol (t\u00fa)', languageTag: 'es', value: 'es-tu' },
			{ label: 'Espa\u00f1ol (vos)', languageTag: 'es-AR', value: 'es-vos' },
			{ label: 'Portugu\u00eas (Brasil)', languageTag: 'pt-BR', value: 'pt-BR' },
			{ label: 'Portugu\u00eas (Portugal)', languageTag: 'pt-PT', value: 'pt-PT' },
			{ label: 'Italiano', languageTag: 'it', value: 'it' },
			{ label: 'Fran\u00e7ais', languageTag: 'fr', value: 'fr' },
			{ label: 'Deutsch', languageTag: 'de', value: 'de' },
			{ label: '\u65e5\u672c\u8a9e', languageTag: 'ja', value: 'ja' },
			{ label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', languageTag: 'ru', value: 'ru' },
		] );
	} );

	it( 'previews and saves an explicit language immediately', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );
		const preview = new MemoryLanguagePreview();
		const screen = await renderScreen( editor, preview );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = Language.SPANISH_VOS;
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );

		assert.deepEqual( editor.updates, [ { language: Language.SPANISH_VOS } ] );
		assert.equal( preview.projections.at( -1 )?.language, Language.SPANISH_VOS );
		assert.equal( select.value, Language.SPANISH_VOS );
		assert.include( screen.shadowRoot?.textContent ?? '', 'Language saved.' );
	} );

	it( 'stores the browser-following option as an explicit null preference', async () => {
		const editor = new MemoryLanguageEditor( {
			...DefaultPreferencesDocument,
			language: Language.GERMAN,
		} );
		const screen = await renderScreen( editor );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = '';
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );

		assert.deepEqual( editor.updates, [ { language: null } ] );
		assert.equal( select.value, '' );
	} );

	it( 'rolls back the preview and restores focus when persistence fails', async () => {
		const editor = new MemoryLanguageEditor( {
			...DefaultPreferencesDocument,
			language: Language.ENGLISH,
		} );
		const preview = new MemoryLanguagePreview();
		const screen = await renderScreen( editor, preview );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		editor.rejectSaves = true;
		select.value = Language.JAPANESE;
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );

		assert.equal( select.value, Language.ENGLISH );
		assert.equal( preview.projections.at( -1 )?.language, Language.ENGLISH );
		assert.equal( screen.shadowRoot?.activeElement, select );
		assert.include(
			screen.shadowRoot?.textContent ?? '',
			'Your language could not be saved. TOCus returned to your previous language.',
		);
	} );

	it( 'handles sequential success and failure when preview and source share one controller', async () => {
		const editor = new MemoryLanguageEditor( {
			...DefaultPreferencesDocument,
			language: Language.ENGLISH,
		} );
		const projection = new MemoryLanguageProjection();
		const screen = await renderScreen( editor, projection, projection );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = Language.SPANISH_VOS;
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );
		assert.include( screen.shadowRoot?.textContent ?? '', 'Language saved.' );

		editor.rejectSaves = true;
		select.value = Language.JAPANESE;
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );

		assert.equal( select.value, Language.SPANISH_VOS );
		assert.include(
			screen.shadowRoot?.textContent ?? '',
			'Your language could not be saved. TOCus returned to your previous language.',
		);
		assert.notInclude( screen.shadowRoot?.textContent ?? '', 'Language saved.' );
	} );

	it( 'announces a saved language when its storage echo arrives before persistence resolves', async () => {
		const source = new MemoryLanguageSource();
		const editor = new EchoingLanguageEditor( DefaultPreferencesDocument, source );
		const screen = await renderScreen( editor, null, source );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = Language.FRENCH;
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );

		assert.equal( select.value, Language.FRENCH );
		assert.include( screen.shadowRoot?.textContent ?? '', 'Language saved.' );
	} );

	it( 'keeps the saved announcement when its storage echo arrives after persistence resolves', async () => {
		const source = new MemoryLanguageSource();
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );
		const screen = await renderScreen( editor, null, source );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = Language.GERMAN;
		select.dispatchEvent( new Event( 'change' ) );
		await settleScreen( screen );
		source.emit( editor.preferences );
		await screen.updateComplete;

		assert.equal( select.value, Language.GERMAN );
		assert.include( screen.shadowRoot?.textContent ?? '', 'Language saved.' );
	} );

	it( 'uses the resolved browser language in automatic-mode help', async () => {
		const screen = await renderScreen( new MemoryLanguageEditor( DefaultPreferencesDocument ) );

		screen.browserLanguage = Language.SPANISH_VOS;
		await screen.updateComplete;

		assert.include( screen.shadowRoot?.textContent ?? '', 'Your browser currently selects Espa\u00f1ol (vos).' );
	} );

	it( 'adopts current external preferences and exposes malformed data without rewriting it', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );
		const source = new MemoryLanguageSource();
		const screen = await renderScreen( editor, null, source );

		source.emit( { ...DefaultPreferencesDocument, language: Language.FRENCH } );
		await screen.updateComplete;
		assert.equal(
			getRequiredElement( screen, '#language', HTMLSelectElement ).value,
			Language.FRENCH,
		);

		source.emit( null );
		await screen.updateComplete;
		assert.include( screen.shadowRoot?.textContent ?? '', 'Personalization settings need your attention' );
		assert.deepEqual( editor.updates, [] );
	} );

	it( 'shows a retryable local read failure and restores selector focus after recovery', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );

		editor.rejectLoads = true;
		const screen = await renderScreen( editor );
		const retry = getRequiredElement( screen, '.retry-action', HTMLButtonElement );

		assert.include( screen.shadowRoot?.textContent ?? '', 'Language settings could not load' );
		editor.rejectLoads = false;
		retry.click();
		await settleScreen( screen );

		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		assert.equal( screen.shadowRoot?.activeElement, select );
	} );

	it( 'keeps retry focus when another local read fails', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );

		editor.rejectLoads = true;
		const screen = await renderScreen( editor );
		const retry = getRequiredElement( screen, '.retry-action', HTMLButtonElement );

		retry.click();
		await settleScreen( screen );

		assert.equal(
			screen.shadowRoot?.activeElement,
			getRequiredElement( screen, '.retry-action', HTMLButtonElement ),
		);
	} );

	it( 'moves focus to recovery when a retry discovers malformed data', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );

		editor.rejectLoads = true;
		const screen = await renderScreen( editor );
		const retry = getRequiredElement( screen, '.retry-action', HTMLButtonElement );

		editor.rejectLoads = false;
		editor.preferences = null;
		retry.click();
		await settleScreen( screen );

		assert.equal(
			screen.shadowRoot?.activeElement,
			getRequiredElement( screen, '.restore-action', HTMLButtonElement ),
		);
	} );

	it( 'distinguishes missing dependencies and malformed stored preferences', async () => {
		const missingEditorScreen = await fixture<ComponentLanguageScreen>(
			html`<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen }></tocus-f-language-screen>`,
		);

		await settleScreen( missingEditorScreen );
		assert.include( missingEditorScreen.shadowRoot?.textContent ?? '', 'Language settings could not load' );

		const malformedScreen = await renderScreen( new MemoryLanguageEditor( null ) );

		assert.include( malformedScreen.shadowRoot?.textContent ?? '', 'Personalization settings need your attention' );
		assert.include( malformedScreen.shadowRoot?.textContent ?? '', 'appearance, pause, motion, and language preferences' );
		assert.instanceOf( malformedScreen.shadowRoot?.querySelector( '.restore-action' ), HTMLButtonElement );
	} );

	it( 'restores malformed personalization data to defaults after an explicit action', async () => {
		const editor = new MemoryLanguageEditor( null );
		const preview = new MemoryLanguagePreview();
		const screen = await renderScreen( editor, preview );
		const restore = getRequiredElement( screen, '.restore-action', HTMLButtonElement );

		restore.click();
		await settleScreen( screen );

		assert.deepEqual( editor.preferences, DefaultPreferencesDocument );
		assert.deepEqual( preview.projections, [ DefaultPreferencesDocument ] );
		assert.equal( getRequiredElement( screen, '#language', HTMLSelectElement ).value, '' );
		assert.include( screen.shadowRoot?.textContent ?? '', 'Personalization defaults restored.' );
	} );

	it( 'keeps malformed personalization data recoverable when restoring defaults fails', async () => {
		const editor = new MemoryLanguageEditor( null );

		editor.rejectSaves = true;
		const screen = await renderScreen( editor );
		const restore = getRequiredElement( screen, '.restore-action', HTMLButtonElement );

		restore.click();
		await settleScreen( screen );

		assert.include( screen.shadowRoot?.textContent ?? '', 'could not restore your personalization defaults' );
		assert.equal( screen.shadowRoot?.activeElement, restore );
	} );

	it( 'ignores duplicate or unavailable personalization recovery requests', async () => {
		const deferredEditor = new DeferredLanguageEditor();
		const pendingScreen = await fixture<ComponentLanguageScreen>( html`
			<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen } .editor=${ deferredEditor }></tocus-f-language-screen>
		` );

		deferredEditor.completeLoad( 0, null );
		await settleScreen( pendingScreen );
		const pendingRestore = getRequiredElement( pendingScreen, '.restore-action', HTMLButtonElement );

		pendingRestore.dispatchEvent( new Event( 'click' ) );
		pendingRestore.dispatchEvent( new Event( 'click' ) );
		assert.equal( deferredEditor.restoreCalls, 1 );
		deferredEditor.completeRestore( 0, DefaultPreferencesDocument );
		await settleScreen( pendingScreen );

		const unavailableEditor = new MemoryLanguageEditor( null );
		const unavailableScreen = await renderScreen( unavailableEditor );
		const unavailableRestore = getRequiredElement(
			unavailableScreen,
			'.restore-action',
			HTMLButtonElement,
		);

		unavailableScreen.editor = null;
		unavailableRestore.dispatchEvent( new Event( 'click' ) );
		await unavailableScreen.updateComplete;

		assert.isNull( unavailableEditor.preferences );
	} );

	it( 'rejects an unsupported native value without reading or saving preferences', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );
		const screen = await renderScreen( editor );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );
		const unsupportedOption = document.createElement( 'option' );

		unsupportedOption.value = 'unsupported';
		select.append( unsupportedOption );
		select.value = unsupportedOption.value;
		select.dispatchEvent( new Event( 'change' ) );
		await screen.updateComplete;

		assert.equal( select.value, '' );
		assert.deepEqual( editor.updates, [] );
	} );

	it( 'disables selection while saving and preserves a newer external preference', async () => {
		const editor = new DeferredLanguageEditor();
		const source = new MemoryLanguageSource();
		const preview = new MemoryLanguagePreview();
		const screen = await fixture<ComponentLanguageScreen>( html`
			<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen }
				.editor=${ editor }
				.preview=${ preview }
				.source=${ source }
			></tocus-f-language-screen>
		` );

		editor.completeLoad( 0, DefaultPreferencesDocument );
		await settleScreen( screen );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = Language.JAPANESE;
		select.dispatchEvent( new Event( 'change' ) );
		await screen.updateComplete;
		assert.isTrue( select.disabled );
		select.value = Language.RUSSIAN;
		select.dispatchEvent( new Event( 'change' ) );
		assert.equal( editor.updateCalls, 1 );

		source.emit( { ...DefaultPreferencesDocument, language: Language.GERMAN } );
		editor.completeUpdate( 0, { ...DefaultPreferencesDocument, language: Language.JAPANESE } );
		await settleScreen( screen );

		assert.equal( select.value, Language.GERMAN );
		assert.equal( preview.projections.at( -1 )?.language, Language.JAPANESE );
	} );

	it( 'ignores a change after its editor dependency is removed', async () => {
		const editor = new MemoryLanguageEditor( DefaultPreferencesDocument );
		const screen = await renderScreen( editor );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		screen.editor = null;
		select.value = Language.FRENCH;
		select.dispatchEvent( new Event( 'change' ) );
		await screen.updateComplete;

		assert.deepEqual( editor.updates, [] );
	} );

	it( 'shows malformed data when persistence discovers an invalid document', async () => {
		const editor = new DeferredLanguageEditor();
		const preview = new MemoryLanguagePreview();
		const screen = await fixture<ComponentLanguageScreen>( html`
			<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen }
				.editor=${ editor }
				.preview=${ preview }
			></tocus-f-language-screen>
		` );

		editor.completeLoad( 0, DefaultPreferencesDocument );
		await settleScreen( screen );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		select.value = Language.FRENCH;
		select.dispatchEvent( new Event( 'change' ) );
		editor.completeUpdate( 0, null );
		await settleScreen( screen );

		assert.include( screen.shadowRoot?.textContent ?? '', 'Personalization settings need your attention' );
		assert.equal( preview.projections.at( -1 )?.language, null );
	} );

	it( 'ignores an old local read after a newer external projection', async () => {
		const editor = new DeferredLanguageEditor();
		const source = new MemoryLanguageSource();
		const screen = await fixture<ComponentLanguageScreen>( html`
			<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen }
				.editor=${ editor }
				.source=${ source }
			></tocus-f-language-screen>
		` );

		source.emit( { ...DefaultPreferencesDocument, language: Language.ITALIAN } );
		editor.completeLoad( 0, { ...DefaultPreferencesDocument, language: Language.RUSSIAN } );
		await settleScreen( screen );

		assert.equal(
			getRequiredElement( screen, '#language', HTMLSelectElement ).value,
			Language.ITALIAN,
		);
	} );

	it( 'refreshes after reconnecting and stops observing a replaced source', async () => {
		const editor = new MemoryLanguageEditor( {
			...DefaultPreferencesDocument,
			language: Language.ENGLISH,
		} );
		const originalSource = new MemoryLanguageSource();
		const replacementSource = new MemoryLanguageSource();
		const screen = await renderScreen( editor, null, originalSource );

		screen.source = replacementSource;
		await screen.updateComplete;
		originalSource.emit( { ...DefaultPreferencesDocument, language: Language.RUSSIAN } );
		replacementSource.emit( { ...DefaultPreferencesDocument, language: Language.FRENCH } );
		await screen.updateComplete;
		assert.equal( getRequiredElement( screen, '#language', HTMLSelectElement ).value, Language.FRENCH );

		screen.remove();
		editor.preferences = { ...DefaultPreferencesDocument, language: Language.ITALIAN };
		replacementSource.emit( { ...DefaultPreferencesDocument, language: Language.GERMAN } );
		document.body.append( screen );
		await settleScreen( screen );

		assert.equal( getRequiredElement( screen, '#language', HTMLSelectElement ).value, Language.ITALIAN );
		screen.remove();
	} );

	it( 'renders an accessible narrow screen without horizontal overflow', async () => {
		const frame = await fixture<HTMLElement>( html`
			<div style="width: 20rem">
				<tocus-f-language-screen
			.copy=${ TestEnglishLocalizationBundle.languageScreen }
					.editor=${ new MemoryLanguageEditor( DefaultPreferencesDocument ) }
					.browserLanguage=${ Language.ENGLISH }
				></tocus-f-language-screen>
			</div>
		` );
		const screen = frame.querySelector( 'tocus-f-language-screen' );

		assert.instanceOf( screen, ComponentLanguageScreen );
		await settleScreen( screen );
		const main = getRequiredElement( screen, 'main', HTMLElement );
		const form = getRequiredElement( screen, 'form', HTMLFormElement );
		const select = getRequiredElement( screen, '#language', HTMLSelectElement );

		assert.equal( main.getAttribute( 'aria-labelledby' ), 'language-title' );
		assert.equal( form.getAttribute( 'aria-busy' ), 'false' );
		assert.equal( select.getAttribute( 'aria-describedby' ), 'language-help' );
		assert.equal( screen.shadowRoot?.querySelector( '.save-status' )?.getAttribute( 'role' ), 'status' );
		await expect( screen ).to.be.accessible();
		assert.isAtMost( frame.scrollWidth, frame.clientWidth );
	} );
	it( 'renders nothing before localized copy is injected', async () => {
		const element = await fixture<ComponentLanguageScreen>( html`<tocus-f-language-screen></tocus-f-language-screen>` );

		assert.equal( element.shadowRoot?.childElementCount, 0 );
	} );

} );
