import { assert, expect, fixture, html } from '@open-wc/testing';
import {
	ProtectionConfigurationEditRejectionReason,
} from '../../../../domains/protection/services/protection-configuration-editor';
import {
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import {
	DefaultProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteEnrollmentResult,
	type ProtectedSiteEnrollmentService,
	type ProtectedSiteRemovalResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import {
	ComponentOnboardingSitesStep,
	OnboardingSitesFinishEventName,
} from './index';
import { type OnboardingSitesStepCopy } from './types';

/**
 * Valid Instagram site returned by successful test enrollment.
 * @since 0.1.0 Initial implementation.
 */
const INSTAGRAM_SITE: ProtectedSiteConfiguration = {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};

/**
 * Valid configuration returned by successful test enrollment.
 * @since 0.1.0 Initial implementation.
 */
const INSTAGRAM_CONFIGURATION: ProtectionConfigurationDocument = {
	...TestEmptyProtectionConfiguration,
	sites: [ INSTAGRAM_SITE ],
};

/**
 * Formats one suggestion add action in tests.
 * @param siteName - Brand name shown by the suggestion.
 * @return English add action.
 * @since 0.1.0 Initial implementation.
 */
function formatAddSuggestionLabel( siteName: string ): string {
	return `Protect ${ siteName }`;
}

/**
 * Formats one pending suggestion action in tests.
 * @param siteName - Brand name shown by the suggestion.
 * @return English pending action.
 * @since 0.1.0 Initial implementation.
 */
function formatAddingSuggestionLabel( siteName: string ): string {
	return `Adding ${ siteName }`;
}

/**
 * Formats one selected suggestion status in tests.
 * @param siteName - Brand name shown by the suggestion.
 * @return English selected status.
 * @since 0.1.0 Initial implementation.
 */
function formatAddedSuggestionLabel( siteName: string ): string {
	return `${ siteName } protected`;
}

/**
 * Formats one successful enrollment announcement in tests.
 * @param siteName - Site name shown to the user.
 * @return English success announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatAddedAnnouncement( siteName: string ): string {
	return `${ siteName } is now protected.`;
}

/**
 * Formats one visibly distinct translated announcement in localization-state tests.
 * @param siteName - Site name shown to the user.
 * @return Alternate translated announcement.
 * @since 0.1.0 Initial implementation.
 */
function formatTranslatedAddedAnnouncement( siteName: string ): string {
	return `Translated ${ siteName } announcement.`;
}

/**
 * Complete English copy used by the Sites-step component tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_COPY: Readonly<OnboardingSitesStepCopy> = {
	title: 'Choose your protected sites',
	introduction: 'Pick any suggestions or add a website yourself. You can change this later.',
	suggestionsLegend: 'Popular choices',
	formatAddSuggestionLabel,
	formatAddingSuggestionLabel,
	formatAddedSuggestionLabel,
	manualLegend: 'Add another website',
	addressLabel: 'Website address',
	addressPlaceholder: 'example.com',
	addressHelp: 'Enter a domain or an http or https address.',
	addSiteLabel: 'Add a pause here',
	addingSiteLabel: 'Adding site',
	invalidSiteError: 'Enter a valid website address.',
	alreadyProtectedError: 'That website is already protected.',
	permissionDeniedError: 'TOCus needs website access before it can protect this site.',
	permissionRequestError: 'Website access could not be requested. Try again.',
	permissionRetainedError: 'The site was not saved, but browser access may still be active.',
	saveError: 'The site could not be saved. Try again.',
	unexpectedError: 'Something went wrong. Try again.',
	formatAddedAnnouncement,
	finishLabel: 'Finish setup',
};

/**
 * Asynchronous enrollment behavior used by one test service.
 * @since 0.1.0 Initial implementation.
 */
type TestEnrollmentHandler = (
	siteInput: unknown,
	independent: boolean,
) => Promise<ProtectedSiteEnrollmentResult>;

/**
 * Focused enrollment service test double with real component-facing behavior.
 * @since 0.1.0 Initial implementation.
 */
class TestEnrollmentService implements ProtectedSiteEnrollmentService {
	/**
	 * Creates a service around one controlled add behavior.
	 * @param addHandler - Add behavior controlled by the current test.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor( private readonly addHandler: TestEnrollmentHandler ) {}

	/**
	 * Runs the controlled add behavior.
	 * @param siteInput - Site input forwarded by the component.
	 * @param independent - Scope behavior forwarded by the component.
	 * @return Controlled enrollment result.
	 * @since 0.1.0 Initial implementation.
	 */
	add( siteInput: unknown, independent: boolean ): Promise<ProtectedSiteEnrollmentResult> {
		return this.addHandler( siteInput, independent );
	}

	/**
	 * Returns a stable unused removal result.
	 * @return Rejected removal result.
	 * @since 0.1.0 Initial implementation.
	 */
	remove(): Promise<ProtectedSiteRemovalResult> {
		return Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
		} );
	}
}

/**
 * Creates one successful Instagram enrollment result.
 * @return Successful protected-site enrollment.
 * @since 0.1.0 Initial implementation.
 */
function createAddedResult(): ProtectedSiteEnrollmentResult {
	return {
		status: ProtectedSiteEnrollmentStatus.ADDED,
		configuration: INSTAGRAM_CONFIGURATION,
		site: INSTAGRAM_SITE,
	};
}

/**
 * Creates a ready Sites-step fixture.
 * @param enrollment - Enrollment service used by site actions.
 * @param protectedRuleHosts - Rules already protected before onboarding renders.
 * @return Connected Sites-step component.
 * @since 0.1.0 Initial implementation.
 */
async function renderSitesStep(
	enrollment: ProtectedSiteEnrollmentService,
	protectedRuleHosts: readonly string[] = [],
): Promise<ComponentOnboardingSitesStep> {
	return fixture<ComponentOnboardingSitesStep>( html`
		<tocus-f-onboarding-sites-step
			.copy=${ TEST_COPY }
			.enrollment=${ enrollment }
			.protectedRuleHosts=${ protectedRuleHosts }
			.suggestions=${ OnboardingSiteSuggestions }
		></tocus-f-onboarding-sites-step>
	` );
}

/**
 * Returns the connected component shadow root.
 * @param element - Sites-step component under test.
 * @return Component shadow root.
 * @since 0.1.0 Initial implementation.
 */
function getShadowRoot( element: ComponentOnboardingSitesStep ): ShadowRoot {
	const shadowRoot = element.shadowRoot;

	assert.instanceOf( shadowRoot, ShadowRoot );
	if ( ! ( shadowRoot instanceof ShadowRoot ) ) {
		throw new TypeError( 'Expected the Sites step to render a shadow root.' );
	}

	return shadowRoot;
}

/**
 * Provides a safe placeholder before a pending test enrollment captures its resolver.
 * @param result - Unused enrollment result.
 * @since 0.1.0 Initial implementation.
 */
function ignoreEnrollmentResolution( result: ProtectedSiteEnrollmentResult ): void {
	void result;
}

/**
 * Submits one manual site and waits for enrollment and rendering to settle.
 * @param element - Sites step that owns the manual form.
 * @param siteInput - Domain or URL entered by the user.
 * @return Manual address input after enrollment settles.
 * @since 0.1.0 Initial implementation.
 */
async function submitManualSite(
	element: ComponentOnboardingSitesStep,
	siteInput: string,
): Promise<HTMLInputElement> {
	const shadowRoot = getShadowRoot( element );
	const input = shadowRoot.querySelector<HTMLInputElement>( '#onboarding-site-address' );
	const form = shadowRoot.querySelector<HTMLFormElement>( '.manual-form' );

	assert.instanceOf( input, HTMLInputElement );
	assert.instanceOf( form, HTMLFormElement );
	input.value = siteInput;
	form.dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;

	return input;
}

describe( 'tocus-f-onboarding-sites-step', () => {
	it( 'renders nothing until localized copy is supplied', async () => {
		const element = await fixture<ComponentOnboardingSitesStep>( html`
			<tocus-f-onboarding-sites-step></tocus-f-onboarding-sites-step>
		` );

		assert.equal( getShadowRoot( element ).childElementCount, 0 );
	} );

	it( 'renders all fifteen local suggestions with decorative packaged icons', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( createAddedResult() ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const suggestionButtons = shadowRoot.querySelectorAll( '.suggestion' );
		const icons = shadowRoot.querySelectorAll<HTMLImageElement>( '.suggestion img' );

		assert.equal( customElements.get( 'tocus-f-onboarding-sites-step' ), ComponentOnboardingSitesStep );
		assert.equal( suggestionButtons.length, 15 );
		assert.equal( icons.length, 15 );
		assert.isTrue( Array.from( icons ).every( ( icon ) => icon.alt === '' && icon.src.endsWith( '.svg' ) ) );
		await expect( element ).to.be.accessible();
	} );

	it( 'associates suggestion errors without rendering a redundant explanation', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( createAddedResult() ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const suggestions = shadowRoot.querySelector( '.suggestions' );

		assert.instanceOf( suggestions, HTMLElement );
		assert.equal( suggestions.getAttribute( 'aria-describedby' ), 'suggestions-error' );
		assert.equal( shadowRoot.querySelector( '#suggestions-help' ), null );
		assert.equal( shadowRoot.querySelector( '.protection-defaults' ), null );
	} );

	it( 'keeps the manual address field named without rendering a visible label', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( createAddedResult() ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const input = shadowRoot.querySelector( '#onboarding-site-address' );

		assert.instanceOf( input, HTMLInputElement );
		assert.equal( input.getAttribute( 'aria-label' ), TEST_COPY.addressLabel );
		assert.equal( shadowRoot.querySelector( 'label[for="onboarding-site-address"]' ), null );
	} );

	it( 'marks every suggestion whose canonical rule is already protected', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( createAddedResult() ) );
		const element = await renderSitesStep( enrollment, [ 'instagram.com' ] );
		const instagram = getShadowRoot( element ).querySelector<HTMLButtonElement>(
			'.suggestion[data-site-id="instagram"]',
		);

		assert.instanceOf( instagram, HTMLButtonElement );
		assert.equal( instagram.getAttribute( 'aria-pressed' ), 'true' );
		assert.isTrue( instagram.disabled );
		assert.instanceOf( instagram.querySelector( '.selection-mark svg' ), SVGElement );
		assert.equal(
			instagram.querySelector( '.selection-mark svg' )?.getAttribute( 'viewBox' ),
			'0 0 640 640',
		);
		assert.equal(
			getShadowRoot( element ).querySelector( '.suggestion[data-site-id="youtube"] .selection-mark' ),
			null,
		);
	} );

	it( 'ignores missing and already selected suggestions without enrolling them again', async () => {
		let callCount = 0;
		const enrollment = new TestEnrollmentService( () => {
			callCount += 1;

			return Promise.resolve( createAddedResult() );
		} );
		const element = await renderSitesStep( enrollment, [ 'instagram.com' ] );
		const instagram = getShadowRoot( element ).querySelector<HTMLButtonElement>(
			'.suggestion[data-site-id="instagram"]',
		);

		assert.instanceOf( instagram, HTMLButtonElement );
		instagram.dataset.siteId = 'missing';
		instagram.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
		instagram.dataset.siteId = 'instagram';
		instagram.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );

		assert.equal( callCount, 0 );
	} );

	it( 'starts one suggestion enrollment immediately and serializes permission requests', async () => {
		let callCount = 0;
		let resolveEnrollment: ( result: ProtectedSiteEnrollmentResult ) => void = ignoreEnrollmentResolution;
		const pendingEnrollment = new Promise<ProtectedSiteEnrollmentResult>( ( resolve ) => {
			resolveEnrollment = resolve;
		} );
		const enrollment = new TestEnrollmentService( ( siteInput, independent ) => {
			callCount += 1;
			assert.equal( siteInput, 'www.instagram.com' );
			assert.isFalse( independent );

			return pendingEnrollment;
		} );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const instagram = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="instagram"]' );
		const youtube = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="youtube"]' );

		assert.instanceOf( instagram, HTMLButtonElement );
		assert.instanceOf( youtube, HTMLButtonElement );
		instagram.click();
		assert.equal( callCount, 1 );
		youtube.click();
		assert.equal( callCount, 1 );
		await element.updateComplete;
		assert.equal( instagram.getAttribute( 'aria-busy' ), 'true' );

		resolveEnrollment( createAddedResult() );
		await pendingEnrollment;
		await element.updateComplete;

		assert.equal( instagram.getAttribute( 'aria-pressed' ), 'true' );
		assert.include( shadowRoot.querySelector( '.announcement' )?.textContent, 'Instagram' );
	} );

	it( 'shows a localized recoverable error after permission denial', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED,
		} ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const instagram = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="instagram"]' );

		assert.instanceOf( instagram, HTMLButtonElement );
		instagram.click();
		await element.updateComplete;
		await new Promise<void>( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
		await element.updateComplete;

		assert.equal( shadowRoot.querySelector( '.suggestion-error' )?.textContent.trim(), TEST_COPY.permissionDeniedError );
		assert.equal( shadowRoot.querySelector( '#onboarding-site-address' )?.getAttribute( 'aria-invalid' ), 'false' );
		assert.isFalse( instagram.disabled );
	} );

	it( 'treats an already-protected suggestion as a successful selection', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.REJECTED,
			reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
		} ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const instagram = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="instagram"]' );

		assert.instanceOf( instagram, HTMLButtonElement );
		instagram.click();
		await new Promise<void>( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
		await element.updateComplete;

		assert.equal( instagram.getAttribute( 'aria-pressed' ), 'true' );
		assert.equal( shadowRoot.querySelector( '.suggestion-error' )?.textContent.trim(), '' );
		assert.include( shadowRoot.querySelector( '.announcement' )?.textContent, 'Instagram' );
	} );

	it( 'retranslates a retained-permission failure from semantic state', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
		} ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const instagram = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="instagram"]' );

		assert.instanceOf( instagram, HTMLButtonElement );
		instagram.click();
		await new Promise<void>( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
		await element.updateComplete;
		assert.equal( shadowRoot.querySelector( '.suggestion-error' )?.textContent.trim(), TEST_COPY.permissionRetainedError );

		element.copy = {
			...TEST_COPY,
			permissionRetainedError: 'Translated retained permission warning.',
		};
		await element.updateComplete;

		assert.equal(
			shadowRoot.querySelector( '.suggestion-error' )?.textContent.trim(),
			'Translated retained permission warning.',
		);
	} );

	it( 'retranslates a successful announcement from its site name', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( createAddedResult() ) );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const instagram = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="instagram"]' );

		assert.instanceOf( instagram, HTMLButtonElement );
		instagram.click();
		await new Promise<void>( ( resolve ) => {
			setTimeout( resolve, 0 );
		} );
		await element.updateComplete;

		element.copy = {
			...TEST_COPY,
			formatAddedAnnouncement: formatTranslatedAddedAnnouncement,
		};
		await element.updateComplete;

		assert.equal(
			shadowRoot.querySelector( '.announcement' )?.textContent.trim(),
			'Translated Instagram announcement.',
		);
	} );

	it( 'adds a manually entered site through shared whole-domain enrollment', async () => {
		let receivedInput: unknown;
		const enrollment = new TestEnrollmentService( ( siteInput, independent ) => {
			receivedInput = siteInput;
			assert.isFalse( independent );

			return Promise.resolve( createAddedResult() );
		} );
		const element = await renderSitesStep( enrollment );
		const input = await submitManualSite( element, 'https://www.instagram.com/reels' );

		assert.equal( receivedInput, 'https://www.instagram.com/reels' );
		assert.equal( input.value, '' );
	} );

	it( 'maps recoverable manual enrollment failures to the correct local message', async () => {
		const cases: ReadonlyArray<readonly [ ProtectedSiteEnrollmentResult, string ]> = [
			[ {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.ALREADY_PROTECTED,
			}, TEST_COPY.alreadyProtectedError ],
			[ {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.INVALID_SITE,
			}, TEST_COPY.invalidSiteError ],
			[ {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
			}, TEST_COPY.saveError ],
			[ {
				status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
			}, TEST_COPY.permissionRequestError ],
			[ {
				status: ProtectedSiteEnrollmentStatus.SAVE_ERROR,
			}, TEST_COPY.saveError ],
		];

		for ( const [ result, expectedMessage ] of cases ) {
			const enrollment = new TestEnrollmentService( () => Promise.resolve( result ) );
			const element = await renderSitesStep( enrollment );
			const input = await submitManualSite( element, 'example.com' );
			const manualError = getShadowRoot( element ).querySelector( '.manual-error' );

			assert.equal( manualError?.textContent.trim(), expectedMessage );
			assert.equal( input.getAttribute( 'aria-invalid' ), 'true' );
			assert.equal( input.value, 'example.com' );
		}
	} );

	it( 'shows an unexpected manual error when enrollment rejects', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.reject(
			new Error( 'Controlled enrollment rejection.' ),
		) );
		const element = await renderSitesStep( enrollment );

		await submitManualSite( element, 'example.com' );

		assert.equal(
			getShadowRoot( element ).querySelector( '.manual-error' )?.textContent.trim(),
			TEST_COPY.unexpectedError,
		);
	} );

	it( 'ignores a manual submission when its expected address field is absent', async () => {
		let callCount = 0;
		const enrollment = new TestEnrollmentService( () => {
			callCount += 1;

			return Promise.resolve( createAddedResult() );
		} );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const form = shadowRoot.querySelector<HTMLFormElement>( '.manual-form' );

		assert.instanceOf( form, HTMLFormElement );
		shadowRoot.querySelector( '#onboarding-site-address' )?.remove();
		form.dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );

		assert.equal( callCount, 0 );
	} );

	it( 'blocks manual enrollment and completion while another site is pending', async () => {
		let callCount = 0;
		let completionCount = 0;
		let resolveEnrollment: ( result: ProtectedSiteEnrollmentResult ) => void = ignoreEnrollmentResolution;
		const pendingEnrollment = new Promise<ProtectedSiteEnrollmentResult>( ( resolve ) => {
			resolveEnrollment = resolve;
		} );
		const enrollment = new TestEnrollmentService( () => {
			callCount += 1;

			return pendingEnrollment;
		} );
		const element = await renderSitesStep( enrollment );
		const shadowRoot = getShadowRoot( element );
		const instagram = shadowRoot.querySelector<HTMLButtonElement>( '.suggestion[data-site-id="instagram"]' );
		const form = shadowRoot.querySelector<HTMLFormElement>( '.manual-form' );
		const finish = shadowRoot.querySelector<HTMLButtonElement>( '.finish-action' );

		element.addEventListener( OnboardingSitesFinishEventName, () => {
			completionCount += 1;
		} );
		assert.instanceOf( instagram, HTMLButtonElement );
		assert.instanceOf( form, HTMLFormElement );
		assert.instanceOf( finish, HTMLButtonElement );
		instagram.click();
		await element.updateComplete;
		form.dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );
		finish.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );

		assert.equal( callCount, 1 );
		assert.equal( completionCount, 0 );

		resolveEnrollment( {
			status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED,
		} );
		await pendingEnrollment;
	} );

	it( 'allows onboarding to finish without selecting any site', async () => {
		const enrollment = new TestEnrollmentService( () => Promise.resolve( createAddedResult() ) );
		const element = await renderSitesStep( enrollment );
		let completionCount = 0;

		element.addEventListener( OnboardingSitesFinishEventName, () => {
			completionCount += 1;
		} );
		const finishButton = getShadowRoot( element ).querySelector( '.finish-action' );

		assert.instanceOf( finishButton, HTMLButtonElement );
		finishButton.click();

		assert.equal( completionCount, 1 );
	} );
} );
