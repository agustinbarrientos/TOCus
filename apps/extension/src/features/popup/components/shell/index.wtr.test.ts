import { assert, expect, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { ProtectedSiteConfigurationSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import {
	PopupCurrentSiteAccess,
	PopupCurrentSiteStatus,
	PopupProjectionStatus,
	PopupProjectionSchema,
	PopupScheduleStatus,
	PopupScopeKind,
	PopupTimerPhase,
	PopupActiveScopeSchema,
	type PopupActiveScope,
	type PopupProjection,
} from '../../types/popup-projection';
import {
	ComponentPopupShell,
	PopupAddSiteRequestEventName,
	PopupOperationError,
	PopupRetryRequestEventName,
} from './index';

const NOW = 1_800_000_000_000;
const SETTINGS_URL = 'chrome-extension://extension-id/options.html#protected-sites';
const STATISTICS_URL = 'chrome-extension://extension-id/options.html#statistics';
const INSTAGRAM_SITE = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
} );
const CHESS_SITE = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'chess.com',
	rule: {
		host: 'chess.com',
		includeSubdomains: true,
		scopeId: 'scope_chess',
	},
} );
const LONG_HOST_SITE = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'this-is-an-intentionally-long-subdomain-that-needs-to-truncate.example.com',
	rule: {
		host: 'this-is-an-intentionally-long-subdomain-that-needs-to-truncate.example.com',
		includeSubdomains: false,
		scopeId: 'scope_long_host',
	},
} );
const UNPROTECTED_PROJECTION: PopupProjection = {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: {
		status: PopupCurrentSiteStatus.UNPROTECTED,
		identityHost: INSTAGRAM_SITE.identityHost,
	},
	activeScopes: [],
};
const IDLE_PROTECTED_CURRENT_SITE = Object.freeze( {
	status: PopupCurrentSiteStatus.PROTECTED,
	site: INSTAGRAM_SITE,
	scopeId: 'scope_default',
	access: PopupCurrentSiteAccess.GRANTED,
	schedule: PopupScheduleStatus.ACTIVE,
	nextWaitMilliseconds: 10_000,
} as const );
const IDLE_PROTECTED_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: IDLE_PROTECTED_CURRENT_SITE,
	activeScopes: [],
} );
const MULTI_SCOPE_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: {
		...IDLE_PROTECTED_CURRENT_SITE,
		nextWaitMilliseconds: null,
	},
	activeScopes: [
		{
			scopeId: 'scope_default',
			kind: PopupScopeKind.SHARED,
			phase: PopupTimerPhase.ALLOWANCE,
			expiresAtEpochMilliseconds: NOW + 240_000,
			siteCount: 3,
			site: null,
			isCurrentScope: true,
		},
		{
			scopeId: 'scope_chess',
			kind: PopupScopeKind.INDEPENDENT,
			phase: PopupTimerPhase.WAITING,
			remainingMilliseconds: 8_000,
			siteCount: 1,
			site: CHESS_SITE,
			isCurrentScope: false,
		},
	],
} );

/**
 * Creates one unique independent Waiting scope for overflow behavior tests.
 * @param index - Positive deterministic scope index.
 * @return Valid active scope with unique website metadata.
 * @since 0.1.0 Initial implementation.
 */
function createOverflowingWaitingScope( index: number ): PopupActiveScope {
	const identityHost = `site-${ String( index ) }.example`;
	const scopeId = `scope_overflow_${ String( index ) }`;

	return PopupActiveScopeSchema.parse( {
		scopeId,
		kind: PopupScopeKind.INDEPENDENT,
		phase: PopupTimerPhase.WAITING,
		remainingMilliseconds: 8_000,
		siteCount: 1,
		site: {
			identityHost,
			rule: {
				host: identityHost,
				includeSubdomains: false,
				scopeId,
			},
		},
		isCurrentScope: false,
	} );
}

const OVERFLOWING_SCOPES_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
	activeScopes: [ 1, 2, 3, 4 ].map( createOverflowingWaitingScope ),
} );

/**
 * Creates one fully configured popup shell fixture.
 * @param projection - Semantic popup projection to render.
 * @return Updated popup shell.
 * @since 0.1.0 Initial implementation.
 */
async function createShell( projection: PopupProjection ): Promise<ComponentPopupShell> {
	return fixture<ComponentPopupShell>( html`
		<tocus-f-popup-shell
			.copy=${ TestEnglishLocalizationBundle.popup }
			.projection=${ projection }
			.nowEpochMilliseconds=${ NOW }
			.settingsPageUrl=${ SETTINGS_URL }
			.statisticsPageUrl=${ STATISTICS_URL }
		></tocus-f-popup-shell>
	` );
}

describe( 'tocus-f-popup-shell', () => {
	afterEach( () => {
		fixtureCleanup();
	} );

	it( 'registers the exported component class', () => {
		assert.equal( customElements.get( 'tocus-f-popup-shell' ), ComponentPopupShell );
	} );

	it( 'renders current website identity and a one-click add action', async () => {
		const element = await createShell( UNPROTECTED_PROJECTION );
		const shadowRoot = element.shadowRoot;

		assert.notEqual( shadowRoot, null );
		assert.equal( shadowRoot?.querySelector( '.site-name' )?.textContent.trim(), 'Instagram' );
		assert.equal( shadowRoot?.querySelector( '.site-host' )?.textContent.trim(), 'www.instagram.com' );
		assert.equal( shadowRoot?.querySelector( '.site-status' )?.textContent.trim(), 'No pause here' );
		assert.equal( shadowRoot?.querySelector<HTMLAnchorElement>( '.settings-link' )?.href, SETTINGS_URL );
		assert.equal( shadowRoot?.querySelector<HTMLAnchorElement>( '.statistics-link' )?.href, STATISTICS_URL );

		const addRequest = new Promise<Event>( ( resolve ) => {
			element.addEventListener( PopupAddSiteRequestEventName, resolve, { once: true } );
		} );
		shadowRoot?.querySelector<HTMLButtonElement>( '.primary-action' )?.click();
		assert.instanceOf( await addRequest, Event );
	} );

	it( 'renders the next pause for an idle configured website', async () => {
		const element = await createShell( IDLE_PROTECTED_PROJECTION );

		assert.equal( element.shadowRoot?.querySelector( '.site-status' )?.textContent.trim(), 'TOCus is active' );
		assert.equal( element.shadowRoot?.querySelector( '.next-pause-value' )?.textContent.trim(), '10 seconds' );
		assert.equal(
			element.shadowRoot?.querySelector<HTMLAnchorElement>( '.manage-action' )?.href,
			SETTINGS_URL,
		);
		assert.notExists( element.shadowRoot?.querySelector( '.primary-action' ) );
	} );

	it( 'renders every active scope once with phase-specific countdown semantics', async () => {
		const element = await createShell( MULTI_SCOPE_PROJECTION );
		const rows = element.shadowRoot?.querySelectorAll( '.timing-row' ) ?? [];

		assert.equal( rows.length, 2 );
		assert.include( rows[ 0 ]?.textContent, 'Shared timing' );
		assert.include( rows[ 0 ]?.textContent, '3 websites' );
		assert.include( rows[ 0 ]?.textContent, '4:00' );
		assert.include( rows[ 0 ]?.textContent, 'Current website' );
		assert.include( rows[ 1 ]?.textContent, 'Chess' );
		assert.include( rows[ 1 ]?.textContent, '0:08' );
		assert.include( element.shadowRoot?.querySelector( '.site-status' )?.textContent, 'Visit window open' );

		element.nowEpochMilliseconds = NOW + 60_000;
		await element.updateComplete;
		assert.include( rows[ 0 ]?.textContent, '3:00' );
		assert.include( rows[ 1 ]?.textContent, '0:08' );
	} );

	it( 'keeps an overflowing active-timing region reachable and visible from the keyboard', async () => {
		const element = await createShell( OVERFLOWING_SCOPES_PROJECTION );
		const timingList = element.shadowRoot?.querySelector<HTMLElement>( '.timing-list' );

		assert.instanceOf( timingList, HTMLElement );
		assert.isAbove( timingList.scrollHeight, timingList.clientHeight );
		assert.equal( timingList.tabIndex, 0 );
		assert.equal( timingList.getAttribute( 'role' ), 'region' );
		assert.equal( timingList.getAttribute( 'aria-labelledby' ), 'active-timing-title' );

		timingList.focus();

		assert.equal( element.shadowRoot?.activeElement, timingList );
		assert.equal( getComputedStyle( timingList ).outlineStyle, 'solid' );
	} );

	it( 'renders each configured-website status from the semantic projection', async () => {
		const scenarios = [
			{
				projection: PopupProjectionSchema.parse( {
					...IDLE_PROTECTED_PROJECTION,
					currentSite: {
						...IDLE_PROTECTED_CURRENT_SITE,
						access: PopupCurrentSiteAccess.MISSING,
						schedule: PopupScheduleStatus.UNAVAILABLE,
						nextWaitMilliseconds: null,
					},
				} ),
				expectedStatus: 'Browser access needed',
			},
			{
				projection: PopupProjectionSchema.parse( {
					...IDLE_PROTECTED_PROJECTION,
					currentSite: {
						...IDLE_PROTECTED_CURRENT_SITE,
						schedule: PopupScheduleStatus.INACTIVE,
						nextWaitMilliseconds: null,
					},
				} ),
				expectedStatus: 'Off right now',
			},
			{
				projection: PopupProjectionSchema.parse( {
					...IDLE_PROTECTED_PROJECTION,
					currentSite: {
						...IDLE_PROTECTED_CURRENT_SITE,
						schedule: PopupScheduleStatus.UNAVAILABLE,
						nextWaitMilliseconds: null,
					},
				} ),
				expectedStatus: 'Status unavailable',
			},
			{
				projection: PopupProjectionSchema.parse( {
					...IDLE_PROTECTED_PROJECTION,
					currentSite: {
						...IDLE_PROTECTED_CURRENT_SITE,
						nextWaitMilliseconds: null,
					},
					activeScopes: [ {
						scopeId: 'scope_default',
						kind: PopupScopeKind.SHARED,
						phase: PopupTimerPhase.WAITING,
						remainingMilliseconds: 8_000,
						siteCount: 3,
						site: null,
						isCurrentScope: true,
					} ],
				} ),
				expectedStatus: 'Pause in progress',
			},
			{
				projection: PopupProjectionSchema.parse( {
					...IDLE_PROTECTED_PROJECTION,
					currentSite: {
						...IDLE_PROTECTED_CURRENT_SITE,
						schedule: PopupScheduleStatus.INACTIVE,
						nextWaitMilliseconds: null,
					},
					activeScopes: [ {
						scopeId: 'scope_default',
						kind: PopupScopeKind.SHARED,
						phase: PopupTimerPhase.ALLOWANCE,
						expiresAtEpochMilliseconds: NOW + 60_000,
						siteCount: 3,
						site: null,
						isCurrentScope: true,
					} ],
				} ),
				expectedStatus: 'Visit window open',
			},
		] as const;

		for ( const scenario of scenarios ) {
			const element = await createShell( scenario.projection );

			assert.equal(
				element.shadowRoot?.querySelector( '.site-status' )?.textContent.trim(),
				scenario.expectedStatus,
			);
			fixtureCleanup();
		}
	} );

	it( 'keeps the current next pause visible beside unrelated active timing', async () => {
		const element = await createShell( PopupProjectionSchema.parse( {
			...IDLE_PROTECTED_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_chess',
				kind: PopupScopeKind.INDEPENDENT,
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 8_000,
				siteCount: 1,
				site: CHESS_SITE,
				isCurrentScope: false,
			} ],
		} ) );

		assert.equal( element.shadowRoot?.querySelector( '.next-pause-value' )?.textContent.trim(), '10 seconds' );
		assert.include( element.shadowRoot?.querySelector( '.timing-row' )?.textContent, 'Chess' );
	} );

	it( 'contains long independent website identities within the popup width', async () => {
		const element = await createShell( PopupProjectionSchema.parse( {
			...IDLE_PROTECTED_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_long_host',
				kind: PopupScopeKind.INDEPENDENT,
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: NOW + 60_000,
				siteCount: 1,
				site: LONG_HOST_SITE,
				isCurrentScope: false,
			} ],
		} ) );
		element.style.width = '18rem';
		await element.updateComplete;
		const timing = element.shadowRoot?.querySelector<HTMLElement>( '.timing' );

		assert.exists( timing );
		assert.isAtMost( timing.scrollWidth, timing.clientWidth );
	} );

	it( 'uses a cached local favicon and falls back to the deterministic monogram', async () => {
		const element = await createShell( UNPROTECTED_PROJECTION );
		element.faviconSource = 'chrome-extension://extension-id/_favicon/?pageUrl=https%3A%2F%2Finstagram.com';
		await element.updateComplete;
		const favicon = element.shadowRoot?.querySelector<HTMLImageElement>( '.site-favicon' );

		assert.exists( favicon );
		favicon.dispatchEvent( new Event( 'error' ) );
		await element.updateComplete;
		assert.notExists( element.shadowRoot?.querySelector( '.site-favicon' ) );
		assert.equal( element.shadowRoot?.querySelector( '.site-monogram' )?.textContent.trim(), 'I' );
	} );

	it( 'does not offer website enrollment on a browser-controlled page', async () => {
		const element = await createShell( {
			status: PopupProjectionStatus.AVAILABLE,
			capturedAtEpochMilliseconds: NOW,
			currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
			activeScopes: [],
		} );

		assert.include( element.shadowRoot?.textContent, TestEnglishLocalizationBundle.popup.unsupportedPage );
		assert.notExists( element.shadowRoot?.querySelector( '.primary-action' ) );
	} );

	it( 'offers retry when current website lookup is temporarily unavailable', async () => {
		const element = await createShell( PopupProjectionSchema.parse( {
			status: PopupProjectionStatus.AVAILABLE,
			capturedAtEpochMilliseconds: NOW,
			currentSite: { status: PopupCurrentSiteStatus.UNAVAILABLE },
			activeScopes: [],
		} ) );

		assert.include(
			element.shadowRoot?.textContent,
			TestEnglishLocalizationBundle.popup.currentWebsiteUnavailable,
		);
		assert.exists( element.shadowRoot?.querySelector( '.retry-action' ) );
	} );

	it( 'announces pending enrollment and exposes its busy state', async () => {
		const element = await createShell( UNPROTECTED_PROJECTION );
		element.adding = true;
		await element.updateComplete;
		const websiteCard = element.shadowRoot?.querySelector( '.website-card' );
		const announcement = element.shadowRoot?.querySelector( '.action-announcement' );

		assert.equal( websiteCard?.getAttribute( 'aria-busy' ), 'true' );
		assert.equal(
			announcement?.textContent.trim(),
			TestEnglishLocalizationBundle.popup.addingPause,
		);
		assert.isFalse( websiteCard?.contains( announcement ?? null ) );

		element.adding = false;
		await element.updateComplete;

		assert.equal( element.shadowRoot?.querySelector( '.action-announcement' ), announcement );
		assert.equal( announcement?.textContent.trim(), '' );
	} );

	it( 'disables and announces every retry action while recovery is pending', async () => {
		const copy = {
			...TestEnglishLocalizationBundle.popup,
			retrying: 'Trying again...',
		};
		const projections: ReadonlyArray<PopupProjection> = [
			PopupProjectionSchema.parse( {
				status: PopupProjectionStatus.AVAILABLE,
				capturedAtEpochMilliseconds: NOW,
				currentSite: { status: PopupCurrentSiteStatus.UNAVAILABLE },
				activeScopes: [],
			} ),
			{ status: PopupProjectionStatus.UNAVAILABLE },
		];

		for ( const projection of projections ) {
			const element = await createShell( projection );
			let retryRequests = 0;

			element.copy = copy;
			element.retrying = true;
			element.addEventListener( PopupRetryRequestEventName, () => {
				retryRequests += 1;
			} );
			await element.updateComplete;
			const retryAction = element.shadowRoot?.querySelector<HTMLButtonElement>( '.retry-action' );
			const announcement = element.shadowRoot?.querySelector( '.retry-announcement' );

			assert.instanceOf( retryAction, HTMLButtonElement );
			assert.isTrue( retryAction.disabled );
			assert.equal( retryAction.textContent.trim(), 'Trying again...' );
			assert.equal( getComputedStyle( retryAction ).cursor, 'wait' );
			assert.equal( announcement?.getAttribute( 'role' ), 'status' );
			assert.equal( announcement?.textContent.trim(), 'Trying again...' );
			retryAction.click();
			assert.equal( retryRequests, 0 );
			fixtureCleanup();
		}
	} );

	it( 'focuses the best available destination after retry recovery rerenders', async () => {
		const scenarios: ReadonlyArray<Readonly<{
			projection: PopupProjection;
			selector: string;
		}>> = [
			{ projection: UNPROTECTED_PROJECTION, selector: '.primary-action' },
			{ projection: IDLE_PROTECTED_PROJECTION, selector: '.manage-action' },
			{ projection: { status: PopupProjectionStatus.UNAVAILABLE }, selector: '.retry-action' },
			{
				projection: PopupProjectionSchema.parse( {
					status: PopupProjectionStatus.AVAILABLE,
					capturedAtEpochMilliseconds: NOW,
					currentSite: { status: PopupCurrentSiteStatus.UNAVAILABLE },
					activeScopes: [],
				} ),
				selector: '.retry-action',
			},
			{
				projection: PopupProjectionSchema.parse( {
					status: PopupProjectionStatus.AVAILABLE,
					capturedAtEpochMilliseconds: NOW,
					currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
					activeScopes: [],
				} ),
				selector: '.neutral-message',
			},
		];

		for ( const scenario of scenarios ) {
			const element = await createShell( scenario.projection );
			const expectedTarget = element.shadowRoot?.querySelector( scenario.selector );

			await element.focusAfterRetry();

			assert.equal( element.shadowRoot?.activeElement, expectedTarget );
			fixtureCleanup();
		}
	} );

	it( 'shows a visible focus indicator on the unsupported-page retry fallback', async () => {
		const element = await createShell( PopupProjectionSchema.parse( {
			status: PopupProjectionStatus.AVAILABLE,
			capturedAtEpochMilliseconds: NOW,
			currentSite: { status: PopupCurrentSiteStatus.UNSUPPORTED },
			activeScopes: [],
		} ) );
		const status = element.shadowRoot?.querySelector<HTMLElement>( '.neutral-message' );

		assert.instanceOf( status, HTMLElement );
		await element.focusAfterRetry();

		assert.equal( element.shadowRoot?.activeElement, status );
		assert.equal( getComputedStyle( status ).outlineStyle, 'solid' );
	} );

	it( 'moves focus to website management after enrollment succeeds', async () => {
		const element = await createShell( UNPROTECTED_PROJECTION );
		element.projection = IDLE_PROTECTED_PROJECTION;

		await element.focusManageAction();

		assert.equal( element.shadowRoot?.activeElement, element.shadowRoot?.querySelector( '.manage-action' ) );
	} );

	it( 'leaves focus unchanged when website management is unavailable', async () => {
		const element = await createShell( UNPROTECTED_PROJECTION );

		await element.focusManageAction();

		assert.equal( element.shadowRoot?.activeElement, null );
	} );

	it( 'renders a concise retry action when runtime status is unavailable', async () => {
		const element = await createShell( { status: PopupProjectionStatus.UNAVAILABLE } );
		const retryRequest = new Promise<Event>( ( resolve ) => {
			element.addEventListener( PopupRetryRequestEventName, resolve, { once: true } );
		} );

		assert.include( element.shadowRoot?.textContent, TestEnglishLocalizationBundle.popup.unavailableTitle );
		element.shadowRoot?.querySelector<HTMLButtonElement>( '.retry-action' )?.click();
		assert.instanceOf( await retryRequest, Event );
	} );

	it( 'keeps every enrollment failure concise and recoverable', async () => {
		for ( const operationError of Object.values( PopupOperationError ) ) {
			const element = await createShell( UNPROTECTED_PROJECTION );
			element.operationError = operationError;
			await element.updateComplete;

			assert.isNotEmpty( element.shadowRoot?.querySelector( '[role="alert"]' )?.textContent.trim() );
			assert.exists( element.shadowRoot?.querySelector( '.primary-action' ) );
			fixtureCleanup();
		}
	} );

	it( 'does not dispatch duplicate add requests while enrollment is pending', async () => {
		const element = await createShell( UNPROTECTED_PROJECTION );
		let requestCount = 0;
		element.addEventListener( PopupAddSiteRequestEventName, () => {
			requestCount += 1;
		} );
		element.adding = true;
		await element.updateComplete;
		element.shadowRoot?.querySelector<HTMLButtonElement>( '.primary-action' )?.dispatchEvent(
			new MouseEvent( 'click', { bubbles: true, composed: true } ),
		);

		assert.include( element.shadowRoot?.querySelector( '.primary-action' )?.textContent, 'Adding' );
		assert.equal( requestCount, 0 );
	} );

	it( 'clamps expired allowance countdowns to zero', async () => {
		const element = await createShell( MULTI_SCOPE_PROJECTION );
		element.nowEpochMilliseconds = NOW + 300_000;
		await element.updateComplete;

		assert.include( element.shadowRoot?.querySelector( '.timing-row' )?.textContent, '0:00' );
	} );

	it( 'stays empty until both copy and projection are ready', async () => {
		const withoutCopy = await fixture<ComponentPopupShell>( html`
			<tocus-f-popup-shell .projection=${ UNPROTECTED_PROJECTION }></tocus-f-popup-shell>
		` );
		assert.equal( withoutCopy.shadowRoot?.textContent.trim(), '' );
		fixtureCleanup();
		const withoutProjection = await fixture<ComponentPopupShell>( html`
			<tocus-f-popup-shell .copy=${ TestEnglishLocalizationBundle.popup }></tocus-f-popup-shell>
		` );
		assert.equal( withoutProjection.shadowRoot?.textContent.trim(), '' );
	} );

	it( 'has no automatically detectable accessibility violations in light and dark themes', async () => {
		for ( const colorScheme of [ 'light', 'dark' ] as const ) {
			await emulateMedia( { colorScheme } );
			const frame = await fixture<HTMLElement>( html`
				<div class="tocus-test-frame">
					<tocus-f-popup-shell
						.copy=${ TestEnglishLocalizationBundle.popup }
						.projection=${ MULTI_SCOPE_PROJECTION }
						.nowEpochMilliseconds=${ NOW }
						.settingsPageUrl=${ SETTINGS_URL }
						.statisticsPageUrl=${ STATISTICS_URL }
					></tocus-f-popup-shell>
				</div>
			` );

			await expect( frame ).to.be.accessible();
			fixtureCleanup();
		}
	} );
} );
