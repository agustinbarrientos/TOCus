import { assert, expect, fixture, html } from '@open-wc/testing';
import { ProtectionConfigurationEditRejectionReason } from '../../../../domains/protection/services/protection-configuration-editor';
import { type ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	ProtectedSiteEnrollmentStatus,
	type ProtectedSiteBatchEnrollmentResult,
	type ProtectedSiteEnrollmentService,
	type ProtectedSiteRemovalResult,
} from '../../../protected-sites/services/protected-site-enrollment';
import { SitePermissionReleaseStatus } from '../../../protected-sites/services/site-permission-manager';
import { OnboardingSiteSuggestions } from '../../utils/site-suggestion-catalog';
import { ComponentOnboardingSitesStep, OnboardingSitesFinishEventName } from './index';

/**
 * Valid whole-domain site used by onboarding tests.
 * @since 0.1.0 Initial implementation.
 */
const INSTAGRAM_SITE: ProtectedSiteConfiguration = {
	identityHost: 'www.instagram.com',
	rule: { host: 'instagram.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
};

/**
 * Creates an enrollment boundary with successful batch and removal behavior.
 * @param overrides - Operations replaced for one scenario.
 * @return Complete controlled enrollment service.
 * @since 0.1.0 Initial implementation.
 */
function createEnrollment( overrides: Partial<ProtectedSiteEnrollmentService> = {} ): ProtectedSiteEnrollmentService {
	return {
		/**
		 * Provides the configured enrollment outcome.
		 * @since 0.1.0 Initial implementation.
		 */
		add: () => {
			throw new Error( 'Draft selection must not request single-site enrollment.' );
		},
		/**
		 * Provides the configured enrollment outcome.
		 * @return Controlled enrollment outcome.
		 * @since 0.1.0 Initial implementation.
		 */
		addMany: () => Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			configuration: { ...TestEmptyProtectionConfiguration, sites: [ INSTAGRAM_SITE ] },
			sites: [ INSTAGRAM_SITE ],
		} ),
		/**
		 * Provides the configured enrollment outcome.
		 * @param site - Input forwarded by the component.
		 * @return Controlled enrollment outcome.
		 * @since 0.1.0 Initial implementation.
		 */
		remove: ( site ) => Promise.resolve( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: TestEmptyProtectionConfiguration,
			site,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
		} ),
		...overrides,
	};
}

/**
 * Renders a localized Sites step with controlled browser operations.
 * @param enrollment - Enrollment boundary used at completion.
 * @param protectedSites - Sites already persisted before selection.
 * @return Connected component.
 * @since 0.1.0 Initial implementation.
 */
async function renderSitesStep(
	enrollment = createEnrollment(),
	protectedSites: readonly ProtectedSiteConfiguration[] = [],
): Promise<ComponentOnboardingSitesStep> {
	return fixture<ComponentOnboardingSitesStep>( html`
		<tocus-f-onboarding-sites-step
			.copy=${ TestEnglishLocalizationBundle.onboarding.sites }
			.enrollment=${ enrollment }
			.protectedSites=${ protectedSites }
			.suggestions=${ OnboardingSiteSuggestions }
		></tocus-f-onboarding-sites-step>
	` );
}

/**
 * Finds one rendered control or fails with its selector.
 * @param element - Component owning the shadow root.
 * @param selector - Required selector.
 * @return Matching control.
 * @since 0.1.0 Initial implementation.
 */
function control( element: ComponentOnboardingSitesStep, selector: string ): HTMLElement {
	const target = element.shadowRoot?.querySelector( selector );
	assert.instanceOf( target, HTMLElement, selector );
	return target;
}

/**
 * Submits an address and waits for the local list update.
 * @param element - Component containing the form.
 * @param value - Address entered into the field.
 * @return Settled address field.
 * @since 0.1.0 Initial implementation.
 */
async function submitSite( element: ComponentOnboardingSitesStep, value: string ): Promise<HTMLInputElement> {
	const input = control( element, '#onboarding-site-address' ) as HTMLInputElement;
	input.value = value;
	input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
	control( element, '.manual-form' ).dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );
	await element.updateComplete;
	return input;
}

/**
 * Waits for service completion and the resulting render.
 * @param element - Component under test.
 * @return Promise resolved after pending reactions.
 * @since 0.1.0 Initial implementation.
 */
async function settle( element: ComponentOnboardingSitesStep ): Promise<void> {
	await new Promise<void>( ( resolve ) => {
		setTimeout( resolve, 0 );
	} );
	await element.updateComplete;
}

describe( 'tocus-f-onboarding-sites-step', () => {
	it( 'renders nothing until localization is ready', async () => {
		const element = await fixture<ComponentOnboardingSitesStep>( html`<tocus-f-onboarding-sites-step></tocus-f-onboarding-sites-step>` );
		assert.equal( element.shadowRoot?.textContent.trim(), '' );
	} );

	it( 'renders fifteen local suggestions and an accessible manual field', async () => {
		const element = await renderSitesStep();
		assert.equal( customElements.get( 'tocus-f-onboarding-sites-step' ), ComponentOnboardingSitesStep );
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.suggestion' ) ?? [], 15 );
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.suggestion img' ) ?? [], 15 );
		assert.equal( control( element, '#onboarding-site-address' ).getAttribute( 'aria-label' ), 'Website address' );
		assert.equal( element.shadowRoot?.querySelector( 'label[for="onboarding-site-address"]' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'fills the add action only while the address contains non-whitespace text', async () => {
		const element = await renderSitesStep();
		const input = control( element, '#onboarding-site-address' ) as HTMLInputElement;
		const button = control( element, '.manual-control button' );
		assert.equal( button.textContent.trim(), 'Add site' );
		assert.isFalse( button.classList.contains( 'filled-action' ) );
		input.value = ' example.com ';
		input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		await element.updateComplete;
		assert.isTrue( button.classList.contains( 'filled-action' ) );
		input.value = '   ';
		input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		await element.updateComplete;
		assert.isFalse( button.classList.contains( 'filled-action' ) );
	} );

	it( 'keeps a distinct keyboard focus ring on a selected popular card', async () => {
		const element = await renderSitesStep( createEnrollment(), [ INSTAGRAM_SITE ] );
		const instagram = control( element, '.suggestion[data-site-id="instagram"]' );
		instagram.focus();

		assert.isTrue( element.shadowRoot?.activeElement === instagram );
		assert.isTrue( instagram.matches( ':focus-visible' ) );
		assert.equal( instagram.getAttribute( 'aria-pressed' ), 'true' );
		assert.equal( getComputedStyle( instagram ).outlineWidth, '3px' );
		assert.equal( getComputedStyle( instagram ).outlineOffset, '2px' );
	} );

	it( 'moves focused draft removal to the next row, previous row, or empty-list input', async () => {
		const element = await renderSitesStep();
		await submitSite( element, 'first.com' );
		await submitSite( element, 'second.com' );
		await submitSite( element, 'third.com' );
		const second = control( element, '.added-site:nth-child(2) .remove-action' );
		const third = control( element, '.added-site:nth-child(3) .remove-action' );
		second.focus();
		second.click();
		await settle( element );
		assert.isTrue( element.shadowRoot?.activeElement === third );

		const first = control( element, '.added-site:first-child .remove-action' );
		third.click();
		await settle( element );
		assert.isTrue( element.shadowRoot?.activeElement === first );

		first.click();
		await settle( element );
		assert.isTrue( element.shadowRoot?.activeElement === control( element, '#onboarding-site-address' ) );
	} );

	it( 'retains focused persisted removal until completion and then focuses the remaining row', async () => {
		const pending = Promise.withResolvers<ProtectedSiteRemovalResult>();
		const enrollment = createEnrollment();
		enrollment.remove = () => pending.promise;
		const element = await renderSitesStep( enrollment, [ INSTAGRAM_SITE ] );
		await submitSite( element, 'example.com' );
		const remove = control( element, '.remove-action' );
		const next = control( element, '.added-site:nth-child(2) .remove-action' );
		remove.focus();
		remove.click();
		await element.updateComplete;
		assert.isTrue( element.shadowRoot?.activeElement === remove );
		assert.equal( remove.getAttribute( 'aria-disabled' ), 'true' );
		pending.resolve( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: TestEmptyProtectionConfiguration,
			site: INSTAGRAM_SITE,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
		} );
		await settle( element );
		assert.isTrue( element.shadowRoot?.activeElement === next );
	} );

	it( 'does not move focus for removal from an unfocused row', async () => {
		const element = await renderSitesStep();
		const input = await submitSite( element, 'example.com' );
		input.focus();
		control( element, '.remove-action' ).click();
		await settle( element );
		assert.isTrue( element.shadowRoot?.activeElement === input );
	} );

	it( 'retains removal focus through an early authoritative update until completion', async () => {
		const pending = Promise.withResolvers<ProtectedSiteRemovalResult>();
		const enrollment = createEnrollment();
		enrollment.remove = () => pending.promise;
		const element = await renderSitesStep( enrollment, [ INSTAGRAM_SITE ] );
		const remove = control( element, '.remove-action' );
		remove.focus();
		remove.click();
		await element.updateComplete;
		element.protectedSites = [];
		await element.updateComplete;
		assert.isTrue( element.shadowRoot?.activeElement === remove );

		pending.resolve( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: TestEmptyProtectionConfiguration,
			site: INSTAGRAM_SITE,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
		} );
		await settle( element );
		assert.isTrue( element.shadowRoot?.activeElement === control( element, '#onboarding-site-address' ) );
	} );

	it( 'does not reclaim focus after the user leaves an asynchronous removal', async () => {
		const pending = Promise.withResolvers<ProtectedSiteRemovalResult>();
		const enrollment = createEnrollment();
		enrollment.remove = () => pending.promise;
		const element = await renderSitesStep( enrollment, [ INSTAGRAM_SITE ] );
		const outside = await fixture<HTMLButtonElement>( html`<button type="button">Outside</button>` );
		const remove = control( element, '.remove-action' );
		remove.focus();
		remove.click();
		await element.updateComplete;
		outside.focus();
		element.protectedSites = [];
		await element.updateComplete;
		pending.resolve( {
			status: ProtectedSiteEnrollmentStatus.REMOVED,
			configuration: TestEmptyProtectionConfiguration,
			site: INSTAGRAM_SITE,
			permissionReleaseStatus: SitePermissionReleaseStatus.RELEASED,
		} );
		await settle( element );
		assert.isTrue( document.activeElement === outside );
	} );

	it( 'immediately lists a normalized manual draft without requesting permissions', async () => {
		let requests = 0;
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @return Controlled enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			addMany: () => {
				requests += 1;
				return Promise.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
			}
		} ) );
		const input = await submitSite( element, 'https://www.instagram.com/reels' );
		const list = control( element, '.added-sites' );
		assert.equal( requests, 0 );
		assert.equal( input.value, '' );
		assert.include( list.textContent, 'Instagram' );
		assert.include( list.textContent, 'instagram.com' );
		assert.instanceOf( list.querySelector( 'img' ), HTMLImageElement );
		assert.equal( control( element, '.remove-action' ).textContent.trim(), 'Remove site' );
		assert.isTrue( Boolean( list.compareDocumentPosition( control( element, '.manual-form' ) ) & Node.DOCUMENT_POSITION_PRECEDING ) );
		assert.equal( control( element, '.suggestion[data-site-id="instagram"]' ).getAttribute( 'aria-pressed' ), 'true' );
		assert.isFalse( control( element, '.manual-control button' ).classList.contains( 'filled-action' ) );
	} );

	it( 'renders automatic names and local monograms for custom domains', async () => {
		const element = await renderSitesStep();
		await submitSite( element, 'example.com' );
		const list = control( element, '.added-sites' );
		assert.include( list.textContent, 'Example' );
		assert.include( list.textContent, 'example.com' );
		assert.equal( list.querySelector( '.monogram' )?.textContent.trim(), 'E' );
		assert.equal( list.querySelector( 'img' ), null );
		await expect( element ).to.be.accessible();
	} );

	it( 'uses an authoritative display-name override and clears externally removed sites', async () => {
		const element = await renderSitesStep( createEnrollment(), [ { ...INSTAGRAM_SITE, displayNameOverride: 'My feed' } ] );
		assert.include( control( element, '.added-sites' ).textContent, 'My feed' );
		element.protectedSites = [];
		await element.updateComplete;
		assert.equal( element.shadowRoot?.querySelector( '.added-sites' ), null );
		assert.equal( control( element, '.suggestion[data-site-id="instagram"]' ).getAttribute( 'aria-pressed' ), 'false' );
	} );

	it( 'toggles popular drafts and removes manual drafts without browser operations', async () => {
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			remove: () => {
				throw new Error( 'Draft removal must stay local.' );
			}
		} ) );
		const instagram = control( element, '.suggestion[data-site-id="instagram"]' );
		instagram.click();
		await element.updateComplete;
		assert.equal( instagram.getAttribute( 'aria-pressed' ), 'true' );
		instagram.click();
		await element.updateComplete;
		assert.equal( element.shadowRoot?.querySelector( '.added-sites' ), null );
		await submitSite( element, 'example.com' );
		control( element, '.remove-action' ).click();
		await element.updateComplete;
		assert.equal( element.shadowRoot?.querySelector( '.added-sites' ), null );
	} );

	it( 'retains invalid and overlapping manual input for correction', async () => {
		const element = await renderSitesStep();
		const input = await submitSite( element, 'ftp://example.com' );
		assert.equal( input.value, 'ftp://example.com' );
		assert.equal( input.getAttribute( 'aria-invalid' ), 'true' );
		assert.include( control( element, '.manual-error' ).textContent, 'valid website' );
		await submitSite( element, 'www.instagram.com' );
		await submitSite( element, 'instagram.com' );
		assert.include( control( element, '.manual-error' ).textContent, 'already on your list' );
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.added-sites li' ) ?? [], 1 );
	} );

	it( 'requests the selected batch in the Finish click stack and waits before completion', async () => {
		const pending = Promise.withResolvers<ProtectedSiteBatchEnrollmentResult>();
		let requested: readonly string[] = [];
		let finishes = 0;
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @param inputs - Input forwarded by the component.
			 * @return Controlled enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			addMany: ( inputs ) => {
				requested = inputs;
				return pending.promise;
			}
		} ) );
		element.addEventListener( OnboardingSitesFinishEventName, () => {
			finishes += 1;
		} );
		await submitSite( element, 'www.instagram.com' );
		await submitSite( element, 'example.com' );
		control( element, '.finish-action' ).click();
		assert.deepEqual( requested, [ 'www.instagram.com', 'example.com' ] );
		assert.equal( finishes, 0 );
		await element.updateComplete;
		assert.isTrue( ( control( element, '.manual-control button' ) as HTMLButtonElement ).disabled );
		assert.isTrue( ( control( element, '.remove-action' ) as HTMLButtonElement ).disabled );
		pending.resolve( {
			status: ProtectedSiteEnrollmentStatus.ADDED,
			sites: [ INSTAGRAM_SITE ],
			configuration: { ...TestEmptyProtectionConfiguration, sites: [ INSTAGRAM_SITE ] },
		} );
		await settle( element );
		assert.equal( finishes, 1 );
	} );

	it( 'retains drafts and permits retry after a denied batch', async () => {
		let finishes = 0;
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @return Controlled enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			addMany: () => Promise.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } )
		} ) );
		element.addEventListener( OnboardingSitesFinishEventName, () => {
			finishes += 1;
		} );
		await submitSite( element, 'example.com' );
		control( element, '.finish-action' ).click();
		await settle( element );
		assert.equal( finishes, 0 );
		assert.include( control( element, '.added-sites' ).textContent, 'example.com' );
		assert.include( control( element, '.finish-error' ).textContent, 'browser access' );
		assert.isFalse( ( control( element, '.finish-action' ) as HTMLButtonElement ).disabled );
	} );

	it( 'finishes without requesting browser access when no draft is selected', async () => {
		let finishes = 0;
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			addMany: () => {
				throw new Error( 'No batch is needed.' );
			} } ), [ INSTAGRAM_SITE ] );
		element.addEventListener( OnboardingSitesFinishEventName, () => {
			finishes += 1;
		} );
		control( element, '.finish-action' ).click();
		assert.equal( finishes, 1 );
	} );

	it( 'removes persisted sites through enrollment and reports retained browser access', async () => {
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @param site - Input forwarded by the component.
			 * @return Controlled enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			remove: ( site ) => Promise.resolve( {
				status: ProtectedSiteEnrollmentStatus.REMOVED,
				configuration: TestEmptyProtectionConfiguration,
				site,
				permissionReleaseStatus: SitePermissionReleaseStatus.RETAINED,
			} ) } ), [ INSTAGRAM_SITE ] );
		control( element, '.remove-action' ).click();
		await settle( element );
		assert.equal( element.shadowRoot?.querySelector( '.added-sites' ), null );
		assert.equal( control( element, '.suggestion[data-site-id="instagram"]' ).getAttribute( 'aria-pressed' ), 'false' );
		assert.include( control( element, '.removal-status' ).textContent, 'browser access could not be removed' );
	} );

	it( 'keeps a persisted site when its removal is rejected', async () => {
		const element = await renderSitesStep( createEnrollment( {
			/**
			 * Provides the configured enrollment outcome.
			 * @return Controlled enrollment outcome.
			 * @since 0.1.0 Initial implementation.
			 */
			remove: () => Promise.resolve( {
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
			} ) } ), [ INSTAGRAM_SITE ] );
		control( element, '.remove-action' ).click();
		await settle( element );
		assert.include( control( element, '.added-sites' ).textContent, 'Instagram' );
		assert.include( control( element, '.removal-status' ).textContent, 'could not be saved' );
	} );

	it( 'retranslates batch failures while retaining the selected websites', async () => {
		const results: readonly ProtectedSiteBatchEnrollmentResult[] = [
			{ status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR },
			{ status: ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED },
			{ status: ProtectedSiteEnrollmentStatus.SAVE_ERROR },
			{
				status: ProtectedSiteEnrollmentStatus.REJECTED,
				reason: ProtectionConfigurationEditRejectionReason.SITE_NOT_FOUND,
			},
		];
		for ( const result of results ) {
			const enrollment = createEnrollment();
			enrollment.addMany = () => Promise.resolve( result );
			const element = await renderSitesStep( enrollment );
			await submitSite( element, 'example.com' );
			control( element, '.finish-action' ).click();
			await settle( element );
			assert.isNotEmpty( control( element, '.finish-error' ).textContent.trim() );
			element.copy = {
				...element.copy,
				permissionRequestError: 'Translated failure.',
				permissionRetainedError: 'Translated failure.',
				saveError: 'Translated failure.',
			};
			await element.updateComplete;
			assert.equal( control( element, '.finish-error' ).textContent.trim(), 'Translated failure.' );
			assert.include( control( element, '.added-sites' ).textContent, 'example.com' );
		}
	} );

	it( 'contains unexpected batch and persisted-removal failures', async () => {
		const enrollment = createEnrollment();
		enrollment.addMany = () => Promise.reject( new Error( 'Batch failed.' ) );
		enrollment.remove = () => Promise.reject( new Error( 'Removal failed.' ) );
		const element = await renderSitesStep( enrollment, [ INSTAGRAM_SITE ] );
		await submitSite( element, 'example.com' );
		control( element, '.finish-action' ).click();
		await settle( element );
		assert.include( control( element, '.finish-error' ).textContent, 'Something went wrong' );
		control( element, '.remove-action' ).click();
		await settle( element );
		assert.include( control( element, '.removal-status' ).textContent, 'could not be saved' );
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.added-sites li' ) ?? [], 2 );
	} );

	it( 'removes persisted selections through their popular card', async () => {
		const element = await renderSitesStep( createEnrollment(), [ INSTAGRAM_SITE ] );
		control( element, '.suggestion[data-site-id="instagram"]' ).click();
		await settle( element );
		assert.equal( element.shadowRoot?.querySelector( '.added-sites' ), null );
		assert.include( control( element, '.removal-status' ).textContent, 'Instagram was removed from your list.' );
	} );

	it( 'keeps unrelated drafts when another context protects a selected domain', async () => {
		let requested: readonly string[] = [];
		const enrollment = createEnrollment();
		enrollment.addMany = ( sites ) => {
			requested = sites;
			return Promise.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
		};
		const element = await renderSitesStep( enrollment );
		await submitSite( element, 'instagram.com' );
		await submitSite( element, 'example.com' );
		element.protectedSites = [ INSTAGRAM_SITE ];
		await element.updateComplete;
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.added-sites li' ) ?? [], 2 );
		control( element, '.finish-action' ).click();
		assert.deepEqual( requested, [ 'example.com' ] );
		await settle( element );
	} );

	it( 'serializes completion and removal while browser access is pending', async () => {
		const pending = Promise.withResolvers<ProtectedSiteBatchEnrollmentResult>();
		let calls = 0;
		const enrollment = createEnrollment();
		enrollment.addMany = () => {
			calls += 1;
			return pending.promise;
		};
		const element = await renderSitesStep( enrollment );
		await submitSite( element, 'example.com' );
		const finish = control( element, '.finish-action' );
		finish.click();
		finish.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
		control( element, '.remove-action' ).dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
		control( element, '.suggestion[data-site-id="instagram"]' ).dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
		await submitSite( element, 'second.example.com' );
		assert.equal( calls, 1 );
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.added-sites li' ) ?? [], 1 );
		pending.resolve( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
		await settle( element );
	} );

	it( 'keeps local drafts available when enrollment is unavailable', async () => {
		const element = await renderSitesStep( createEnrollment(), [ INSTAGRAM_SITE ] );
		element.enrollment = null;
		await submitSite( element, 'example.com' );
		const finish = control( element, '.finish-action' ) as HTMLButtonElement;
		assert.isTrue( finish.disabled );
		finish.dispatchEvent( new MouseEvent( 'click', { bubbles: true } ) );
		control( element, '.suggestion[data-site-id="instagram"]' ).click();
		await settle( element );
		assert.lengthOf( element.shadowRoot?.querySelectorAll( '.added-sites li' ) ?? [], 2 );
	} );

	it( 'ignores missing suggestion identifiers and missing address controls', async () => {
		const element = await renderSitesStep();
		const suggestion = control( element, '.suggestion' );
		suggestion.dataset.siteId = 'missing';
		suggestion.click();
		control( element, '#onboarding-site-address' ).remove();
		control( element, '.manual-form' ).dispatchEvent( new SubmitEvent( 'submit', { bubbles: true, cancelable: true } ) );
		await element.updateComplete;
		assert.equal( element.shadowRoot?.querySelector( '.added-sites' ), null );
	} );
} );
