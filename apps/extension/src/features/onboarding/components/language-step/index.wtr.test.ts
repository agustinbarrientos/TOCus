import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	Language,
	type Language as LanguageValue,
} from '../../../../domains/preferences/types';
import {
	ComponentOnboardingLanguageStep,
	OnboardingLanguageContinueEventName,
	OnboardingLanguageSelectEventName,
} from './index';
import {
	type OnboardingLanguageEventDetail,
	type OnboardingLanguageStepCopy,
} from './types';

/**
 * Complete English copy used by the Language-step component tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_COPY: Readonly<OnboardingLanguageStepCopy> = {
	title: 'Choose your language',
	introduction: 'You can change this later in Settings.',
	languageLegend: 'Language',
	languageLabels: {
		en: 'English',
		es: 'Espa\u00f1ol',
		pt: 'Portugu\u00eas',
		it: 'Italiano',
		fr: 'Fran\u00e7ais',
		de: 'Deutsch',
		ja: '\u65e5\u672c\u8a9e',
		ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
	},
	spanishVariantLegend: 'How do you prefer Spanish?',
	spanishTuLabel: 'T\u00fa',
	spanishVosLabel: 'Vos',
	portugueseVariantLegend: 'Which Portuguese do you prefer?',
	portugueseBrazilLabel: 'Brasil',
	portuguesePortugalLabel: 'Portugal',
	continueLabel: 'Continue',
};

/**
 * Renders one ready Language step.
 * @param language - Explicit language initially selected.
 * @return Connected Language-step component.
 * @since 0.1.0 Initial implementation.
 */
async function renderLanguageStep(
	language: LanguageValue = Language.ENGLISH,
): Promise<ComponentOnboardingLanguageStep> {
	return fixture<ComponentOnboardingLanguageStep>( html`
		<tocus-f-onboarding-language-step
			.copy=${ TEST_COPY }
			.language=${ language }
		></tocus-f-onboarding-language-step>
	` );
}

/**
 * Waits for one typed Language-step event.
 * @param element - Component expected to emit the event.
 * @param eventName - Stable Language-step event name.
 * @return Next matching custom event.
 * @since 0.1.0 Initial implementation.
 */
function waitForLanguageEvent(
	element: ComponentOnboardingLanguageStep,
	eventName: string,
): Promise<CustomEvent<OnboardingLanguageEventDetail>> {
	return new Promise( ( resolve ) => {
		element.addEventListener( eventName, ( event ) => {
			if ( event instanceof CustomEvent ) {
				resolve( event );
			}
		}, { once: true } );
	} );
}

/**
 * Returns the connected component shadow root.
 * @param element - Language-step component under test.
 * @return Component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentOnboardingLanguageStep ): ShadowRoot {
	const shadowRoot = element.shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the Language step to render a shadow root.' );
	}

	return shadowRoot;
}

describe( 'tocus-f-onboarding-language-step', () => {
	it( 'renders eight language families and preserves the selected language', async () => {
		const element = await renderLanguageStep( Language.JAPANESE );
		const shadowRoot = getShadowRoot( element );
		const inputs = shadowRoot.querySelectorAll<HTMLInputElement>( 'input[name="language-family"]' );

		assert.equal( customElements.get( 'tocus-f-onboarding-language-step' ), ComponentOnboardingLanguageStep );
		assert.equal( inputs.length, 8 );
		assert.isTrue( shadowRoot.querySelector<HTMLInputElement>( 'input[value="ja"]' )?.checked );
		await expect( element ).to.be.accessible();
	} );

	it( 'reveals and emits the selected Spanish form', async () => {
		const element = await renderLanguageStep();
		const shadowRoot = getShadowRoot( element );
		const eventPromise = waitForLanguageEvent( element, OnboardingLanguageSelectEventName );
		const spanishFamily = shadowRoot.querySelector<HTMLInputElement>( 'input[value="es"]' );

		assert.instanceOf( spanishFamily, HTMLInputElement );
		spanishFamily.click();
		const familyEvent = await eventPromise;

		assert.equal( familyEvent.detail.language, Language.SPANISH_TU );
		await element.updateComplete;

		const vosEventPromise = waitForLanguageEvent( element, OnboardingLanguageSelectEventName );
		const variantChoice = shadowRoot.querySelector( '.variant-choice' );
		const vos = shadowRoot.querySelector<HTMLInputElement>( 'input[value="es-vos"]' );
		const tuLabel = shadowRoot.querySelector( 'input[value="es-tu"] ~ strong' );
		const vosLabel = shadowRoot.querySelector( 'input[value="es-vos"] ~ strong' );

		assert.instanceOf( variantChoice, HTMLFieldSetElement );
		assert.instanceOf( vos, HTMLInputElement );
		assert.instanceOf( vos.nextElementSibling, HTMLSpanElement );
		assert.isTrue( vos.parentElement?.classList.contains( 'language-option' ) );
		assert.equal( tuLabel?.getAttribute( 'lang' ), 'es' );
		assert.equal( vosLabel?.getAttribute( 'lang' ), 'es-AR' );
		await expect( element ).to.be.accessible();
		vos.click();
		const vosEvent = await vosEventPromise;

		assert.equal( vosEvent.detail.language, Language.SPANISH_VOS );
	} );

	it( 'preserves selected Spanish and Portuguese variants when their family is reselected', async () => {
		const spanishElement = await renderLanguageStep( Language.SPANISH_VOS );
		const spanishFamily = getShadowRoot( spanishElement ).querySelector<HTMLInputElement>( 'input[value="es"]' );
		const spanishEventPromise = waitForLanguageEvent(
			spanishElement,
			OnboardingLanguageSelectEventName,
		);

		assert.instanceOf( spanishFamily, HTMLInputElement );
		spanishFamily.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		assert.equal( ( await spanishEventPromise ).detail.language, Language.SPANISH_VOS );

		const portugueseElement = await renderLanguageStep( Language.PORTUGUESE_PORTUGAL );
		const portugueseFamily = getShadowRoot( portugueseElement ).querySelector<HTMLInputElement>(
			'input[value="pt"]',
		);
		const portugueseEventPromise = waitForLanguageEvent(
			portugueseElement,
			OnboardingLanguageSelectEventName,
		);

		assert.instanceOf( portugueseFamily, HTMLInputElement );
		portugueseFamily.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		assert.equal( ( await portugueseEventPromise ).detail.language, Language.PORTUGUESE_PORTUGAL );
	} );

	it( 'uses the Brazilian default and selects nonregional languages exactly', async () => {
		const element = await renderLanguageStep();
		const shadowRoot = getShadowRoot( element );
		const portuguese = shadowRoot.querySelector<HTMLInputElement>( 'input[value="pt"]' );
		const portugueseEventPromise = waitForLanguageEvent( element, OnboardingLanguageSelectEventName );

		assert.instanceOf( portuguese, HTMLInputElement );
		portuguese.click();
		assert.equal( ( await portugueseEventPromise ).detail.language, Language.PORTUGUESE_BRAZIL );
		await element.updateComplete;

		const french = shadowRoot.querySelector<HTMLInputElement>( 'input[value="fr"]' );
		const frenchEventPromise = waitForLanguageEvent( element, OnboardingLanguageSelectEventName );

		assert.instanceOf( french, HTMLInputElement );
		french.click();
		assert.equal( ( await frenchEventPromise ).detail.language, Language.FRENCH );
	} );

	it( 'reveals and emits the selected Portuguese region', async () => {
		const element = await renderLanguageStep( Language.PORTUGUESE_PORTUGAL );
		const shadowRoot = getShadowRoot( element );
		const region = shadowRoot.querySelector( '.variant-choice' );

		assert.instanceOf( region, HTMLFieldSetElement );
		assert.isTrue(
			shadowRoot.querySelector<HTMLInputElement>( 'input[value="pt-PT"]' )?.checked,
		);

		const eventPromise = waitForLanguageEvent( element, OnboardingLanguageSelectEventName );
		const brazil = shadowRoot.querySelector<HTMLInputElement>( 'input[value="pt-BR"]' );
		const brazilLabel = shadowRoot.querySelector( 'input[value="pt-BR"] ~ strong' );
		const portugalLabel = shadowRoot.querySelector( 'input[value="pt-PT"] ~ strong' );

		assert.instanceOf( brazil, HTMLInputElement );
		assert.instanceOf( brazil.nextElementSibling, HTMLSpanElement );
		assert.isTrue( brazil.parentElement?.classList.contains( 'language-option' ) );
		assert.equal( brazilLabel?.getAttribute( 'lang' ), 'pt-BR' );
		assert.equal( portugalLabel?.getAttribute( 'lang' ), 'pt-PT' );
		await expect( element ).to.be.accessible();
		brazil.click();
		const event = await eventPromise;

		assert.equal( event.detail.language, Language.PORTUGUESE_BRAZIL );
	} );

	it( 'emits the exact selected language when Continue is requested', async () => {
		const element = await renderLanguageStep( Language.GERMAN );
		const shadowRoot = getShadowRoot( element );
		const eventPromise = waitForLanguageEvent( element, OnboardingLanguageContinueEventName );
		const continueButton = shadowRoot.querySelector( '.continue-action' );

		assert.instanceOf( continueButton, HTMLButtonElement );
		continueButton.click();
		const event = await eventPromise;

		assert.equal( event.detail.language, Language.GERMAN );
	} );

	it( 'ignores unchecked controls and every selection or submission while pending', async () => {
		const element = await renderLanguageStep( Language.SPANISH_TU );
		const shadowRoot = getShadowRoot( element );
		const english = shadowRoot.querySelector<HTMLInputElement>( 'input[value="en"]' );
		const vos = shadowRoot.querySelector<HTMLInputElement>( 'input[value="es-vos"]' );
		const form = shadowRoot.querySelector( 'form' );
		let continueCount = 0;
		let selectionCount = 0;

		element.addEventListener( OnboardingLanguageSelectEventName, () => {
			selectionCount += 1;
		} );
		element.addEventListener( OnboardingLanguageContinueEventName, () => {
			continueCount += 1;
		} );
		assert.instanceOf( english, HTMLInputElement );
		assert.instanceOf( vos, HTMLInputElement );
		assert.instanceOf( form, HTMLFormElement );

		english.checked = false;
		english.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		element.pending = true;
		await element.updateComplete;
		english.checked = true;
		english.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		vos.checked = true;
		vos.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		form.dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );

		assert.equal( selectionCount, 0 );
		assert.equal( continueCount, 0 );
		assert.equal( element.language, Language.SPANISH_TU );
	} );

	it( 'renders nothing until localized copy is supplied', async () => {
		const element = await fixture<ComponentOnboardingLanguageStep>( html`
			<tocus-f-onboarding-language-step></tocus-f-onboarding-language-step>
		` );

		assert.equal( getShadowRoot( element ).childElementCount, 0 );
	} );
} );
