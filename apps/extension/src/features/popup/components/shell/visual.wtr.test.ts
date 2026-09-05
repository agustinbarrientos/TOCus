import { assert, fixture, fixtureCleanup, html } from '@open-wc/testing';
import { emulateMedia, setViewport } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import {
	Palette,
	ThemeMode,
	type Palette as PaletteValue,
} from '../../../../domains/preferences/types';
import { ProtectedSiteConfigurationSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import instagramIconMarkup from '../../../onboarding/assets/site-icons/site-instagram.svg?raw';
import {
	PopupCurrentSiteAccess,
	PopupCurrentSiteStatus,
	PopupProjectionSchema,
	PopupProjectionStatus,
	PopupScheduleStatus,
	PopupScopeKind,
	PopupTimerPhase,
	type PopupProjection,
} from '../../types/popup-projection';
import './index';
import { type ComponentPopupShell } from './index';
import { type PopupShellCopy } from './types';

/**
 * Fixed wall-clock instant used by every popup visual fixture.
 * @since 0.1.0 Initial implementation.
 */
const NOW = 1_800_000_000_000;

/**
 * Deterministic packaged Settings URL used by popup visual fixtures.
 * @since 0.1.0 Initial implementation.
 */
const SETTINGS_URL = 'chrome-extension://extension-id/options.html#protected-sites';

/**
 * Deterministic packaged Statistics URL used by popup visual fixtures.
 * @since 0.1.0 Initial implementation.
 */
const STATISTICS_URL = 'chrome-extension://extension-id/options.html#statistics';

/**
 * Local data URL that presents the bundled Instagram mark without a network request.
 * @since 0.1.0 Initial implementation.
 */
const INSTAGRAM_FAVICON = `data:image/svg+xml,${ encodeURIComponent( instagramIconMarkup ) }`;

/**
 * Instagram configuration rendered by the common popup visual states.
 * @since 0.1.0 Initial implementation.
 */
const INSTAGRAM_SITE = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
} );

/**
 * Independent Chess.com configuration rendered by the concurrent-scope visual state.
 * @since 0.1.0 Initial implementation.
 */
const CHESS_SITE = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'chess.com',
	rule: {
		host: 'chess.com',
		includeSubdomains: true,
		scopeId: 'scope_chess',
	},
} );

/**
 * Deliberately long website configuration used to guard the popup's narrow layout.
 * @since 0.1.0 Initial implementation.
 */
const LONG_HOST_SITE = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'this-is-an-intentionally-long-subdomain-that-needs-to-truncate.example.com',
	rule: {
		host: 'this-is-an-intentionally-long-subdomain-that-needs-to-truncate.example.com',
		includeSubdomains: false,
		scopeId: 'scope_long_host',
	},
} );

/**
 * Available projection for a website that is not yet on the user's list.
 * @since 0.1.0 Initial implementation.
 */
const UNPROTECTED_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: {
		status: PopupCurrentSiteStatus.UNPROTECTED,
		identityHost: INSTAGRAM_SITE.identityHost,
	},
	activeScopes: [],
} );

/**
 * Available projection for an idle configured website and its next pause.
 * @since 0.1.0 Initial implementation.
 */
const IDLE_PROTECTED_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: {
		status: PopupCurrentSiteStatus.PROTECTED,
		site: INSTAGRAM_SITE,
		scopeId: DefaultProtectionScopeId,
		access: PopupCurrentSiteAccess.GRANTED,
		schedule: PopupScheduleStatus.ACTIVE,
		nextWaitMilliseconds: 10_000,
	},
	activeScopes: [],
} );

/**
 * Available projection showing concurrent shared and independent timing scopes.
 * @since 0.1.0 Initial implementation.
 */
const MULTI_SCOPE_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: {
		status: PopupCurrentSiteStatus.PROTECTED,
		site: INSTAGRAM_SITE,
		scopeId: DefaultProtectionScopeId,
		access: PopupCurrentSiteAccess.GRANTED,
		schedule: PopupScheduleStatus.ACTIVE,
		nextWaitMilliseconds: null,
	},
	activeScopes: [
		{
			scopeId: DefaultProtectionScopeId,
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
 * Unavailable projection rendered by the focused recovery visual state.
 * @since 0.1.0 Initial implementation.
 */
const UNAVAILABLE_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.UNAVAILABLE,
} );

/**
 * Narrow projection with long local website metadata and active timing.
 * @since 0.1.0 Initial implementation.
 */
const LONG_CONTENT_PROJECTION = PopupProjectionSchema.parse( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: NOW,
	currentSite: {
		status: PopupCurrentSiteStatus.PROTECTED,
		site: LONG_HOST_SITE,
		scopeId: 'scope_long_host',
		access: PopupCurrentSiteAccess.GRANTED,
		schedule: PopupScheduleStatus.ACTIVE,
		nextWaitMilliseconds: null,
	},
	activeScopes: [ {
		scopeId: 'scope_long_host',
		kind: PopupScopeKind.INDEPENDENT,
		phase: PopupTimerPhase.WAITING,
		remainingMilliseconds: 8_000,
		siteCount: 1,
		site: LONG_HOST_SITE,
		isCurrentScope: true,
	} ],
} );

/**
 * Longer localized copy used to expose wrapping regressions at the minimum popup width.
 * @since 0.1.0 Initial implementation.
 */
const LONG_CONTENT_COPY: Readonly<PopupShellCopy> = Object.freeze( {
	...TestEnglishLocalizationBundle.popup,
	currentWebsite: 'Website currently open',
	pauseInProgress: 'Your mindful pause is currently in progress',
	activeTiming: 'Timing currently active',
	currentScope: 'This is the current website',
	pause: 'Focused pause in progress',
	manageWebsite: 'Manage this website and its timing',
	statistics: 'View statistics',
	settings: 'Open settings',
} );

/**
 * Configures deterministic inherited theme tokens and browser media.
 * @param theme - Explicit light or dark appearance.
 * @param palette - Selected full-scene palette.
 * @return Promise resolved after media emulation settles.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance(
	theme: typeof ThemeMode.LIGHT | typeof ThemeMode.DARK,
	palette: PaletteValue,
): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	document.documentElement.setAttribute( 'data-tocus-palette', palette );
	await emulateMedia( {
		colorScheme: theme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

/**
 * Renders one settled popup inside an explicit capture frame.
 * @param projection - Validated semantic popup projection.
 * @param width - Explicit popup width.
 * @param copy - Complete localized popup copy.
 * @param faviconSource - Optional extension-local favicon source.
 * @return Connected frame containing the settled popup shell.
 * @since 0.1.0 Initial implementation.
 */
async function renderPopup(
	projection: PopupProjection,
	width = '22rem',
	copy: Readonly<PopupShellCopy> = TestEnglishLocalizationBundle.popup,
	faviconSource: string | null = null,
): Promise<HTMLElement> {
	const frame = await fixture<HTMLElement>( html`
		<div class="tocus-test-frame" style=${ `width: ${ width };` }>
			<tocus-f-popup-shell
				.copy=${ copy }
				.projection=${ projection }
				.nowEpochMilliseconds=${ NOW }
				.faviconSource=${ faviconSource }
				.settingsPageUrl=${ SETTINGS_URL }
				.statisticsPageUrl=${ STATISTICS_URL }
			></tocus-f-popup-shell>
		</div>
	` );
	const shell = frame.querySelector<ComponentPopupShell>( 'tocus-f-popup-shell' );

	assert.instanceOf( shell, HTMLElement );
	await shell.updateComplete;
	const favicon = shell.shadowRoot?.querySelector<HTMLImageElement>( '.site-favicon' );

	if ( favicon !== null && favicon !== undefined ) {
		await favicon.decode();
	}

	return frame;
}

describe( 'tocus-f-popup-shell visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( async () => {
		fixtureCleanup();
		document.documentElement.removeAttribute( 'data-tocus-theme' );
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		await emulateMedia( {
			colorScheme: 'light',
			forcedColors: 'none',
			reducedMotion: 'no-preference',
		} );
	} );

	it( 'matches an unconfigured website in the light brown appearance', async () => {
		await setViewport( { height: 800, width: 800 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BROWN );
		const frame = await renderPopup( UNPROTECTED_PROJECTION, '22rem', undefined, INSTAGRAM_FAVICON );

		await visualDiff( frame, 'popup-shell-light' );
	} );

	it( 'matches an idle configured website and its next pause', async () => {
		await setViewport( { height: 800, width: 800 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.GREEN );
		const frame = await renderPopup( IDLE_PROTECTED_PROJECTION, '22rem', undefined, INSTAGRAM_FAVICON );

		await visualDiff( frame, 'popup-shell-protected-idle' );
	} );

	it( 'matches concurrent timing scopes in the dark purple appearance', async () => {
		await setViewport( { height: 900, width: 800 } );
		await configureAppearance( ThemeMode.DARK, Palette.PURPLE );
		const frame = await renderPopup( MULTI_SCOPE_PROJECTION, '22rem', undefined, INSTAGRAM_FAVICON );

		await visualDiff( frame, 'popup-shell-dark' );
	} );

	it( 'matches the focused unavailable recovery state', async () => {
		await setViewport( { height: 800, width: 800 } );
		await configureAppearance( ThemeMode.DARK, Palette.BROWN );
		const frame = await renderPopup( UNAVAILABLE_PROJECTION );

		await visualDiff( frame, 'popup-shell-unavailable' );
	} );

	it( 'contains long localized content at the minimum popup width', async () => {
		await setViewport( { height: 900, width: 360 } );
		await configureAppearance( ThemeMode.LIGHT, Palette.BLUE );
		const frame = await renderPopup( LONG_CONTENT_PROJECTION, '18rem', LONG_CONTENT_COPY );

		await visualDiff( frame, 'popup-shell-long-content-narrow' );
	} );
} );
