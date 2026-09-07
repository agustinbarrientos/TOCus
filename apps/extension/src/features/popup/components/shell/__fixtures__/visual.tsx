import '@tocus/ui/styles.scss';
import '../../../../../entrypoints/popup/styles.scss';
import { mountPopup } from '../../../services/popup-presentation';
import { createEnglishLocalizationBundle } from '../../../../../localization';
import { DefaultProtectionScopeId } from '../../../../../domains/protection/types/protection-value';
import { ProtectedSiteConfigurationSchema } from '../../../../../domains/protection/types/protected-site-configuration';
import { Palette, ThemeMode } from '../../../../../domains/preferences/types';
import {
	PopupCurrentSiteAccess, PopupCurrentSiteStatus, PopupProjectionStatus,
	PopupScheduleStatus, PopupScopeKind, PopupTimerPhase,
} from '../../../types/popup-projection';
import type { PopupProjection } from '../../../types/popup-projection';
import instagramIcon from '../../../../onboarding/assets/site-icons/site-instagram.svg?raw';
import { PopupVisualScenario } from './visual-types';

const now = 1_800_000_000_000;
const query = new URLSearchParams( location.search );
const scenario = query.get( 'scenario' );
const longContent = scenario === PopupVisualScenario.LONG_CONTENT;
const site = ProtectedSiteConfigurationSchema.parse( {
	identityHost: longContent ? 'this-is-an-intentionally-long-subdomain-that-needs-to-truncate.example.com' : 'www.instagram.com',
	rule: {
		host: longContent ? 'this-is-an-intentionally-long-subdomain-that-needs-to-truncate.example.com' : 'instagram.com',
		includeSubdomains: ! longContent,
		scopeId: longContent ? 'scope_long_host' : DefaultProtectionScopeId,
	},
} );
const chess = ProtectedSiteConfigurationSchema.parse( {
	identityHost: 'chess.com',
	rule: { host: 'chess.com', includeSubdomains: true, scopeId: 'scope_chess' },
} );
const active = scenario === PopupVisualScenario.ACTIVE;
const dark = active || scenario === PopupVisualScenario.UNAVAILABLE;
document.documentElement.dataset.tocusTheme = dark ? ThemeMode.DARK : ThemeMode.LIGHT;
document.documentElement.dataset.tocusPalette = active ? Palette.PURPLE : longContent ? Palette.BLUE
	: scenario === PopupVisualScenario.IDLE ? Palette.GREEN : Palette.BROWN;
const root = document.getElementById( 'app' );
if ( ! root ) {
	throw new Error( 'The original popup comparison requires its capture frame.' );
}
// The archived WTR suite required the bundled brand font before rendering any fixture.
const loadedFonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );
if ( loadedFonts.length === 0 ) {
	throw new Error( 'The original popup comparison requires the bundled Fredoka font.' );
}
root.style.width = longContent ? '18rem' : '22rem';
const port = mountPopup( root );
const copy = createEnglishLocalizationBundle().popup;
port.copy = longContent ? {
	...copy,
	currentWebsite: 'Website currently open',
	pauseInProgress: 'Your mindful pause is currently in progress',
	timeLeft: 'Time remaining for this website',
	manageWebsite: 'Manage this website and its timing',
	statistics: 'View statistics',
	settings: 'Open settings',
} : copy;
port.nowEpochMilliseconds = now;
port.faviconSource = longContent ? null : `data:image/svg+xml,${ encodeURIComponent( instagramIcon ) }`;
port.settingsPageUrl = 'chrome-extension://extension-id/options.html#protected-sites';
port.statisticsPageUrl = 'chrome-extension://extension-id/options.html#statistics';

/**
 * Recreates archived validated runtime inputs; the production view renders every pixel.
 * @return The original deterministic runtime projection for this scenario.
 */
function originalProjection(): PopupProjection {
	if ( scenario === PopupVisualScenario.UNAVAILABLE ) {
		return { status: PopupProjectionStatus.UNAVAILABLE };
	}
	if ( scenario === PopupVisualScenario.UNLISTED ) {
		return {
			status: PopupProjectionStatus.AVAILABLE, capturedAtEpochMilliseconds: now,
			currentSite: { status: PopupCurrentSiteStatus.UNPROTECTED, identityHost: site.identityHost },
			activeScopes: [],
		};
	}
	return {
		status: PopupProjectionStatus.AVAILABLE, capturedAtEpochMilliseconds: now,
		currentSite: {
			status: PopupCurrentSiteStatus.PROTECTED, site, scopeId: site.rule.scopeId,
			access: PopupCurrentSiteAccess.GRANTED, schedule: PopupScheduleStatus.ACTIVE,
			nextWaitMilliseconds: active || longContent ? null : 10_000,
		},
		activeScopes: longContent ? [ {
			scopeId: site.rule.scopeId, kind: PopupScopeKind.INDEPENDENT, phase: PopupTimerPhase.WAITING,
			remainingMilliseconds: 8000, siteCount: 1, site, isCurrentScope: true,
		} ] : active ? [ {
			scopeId: DefaultProtectionScopeId, kind: PopupScopeKind.SHARED, phase: PopupTimerPhase.ALLOWANCE,
			expiresAtEpochMilliseconds: now + 240_000, siteCount: 3, site: null, isCurrentScope: true,
		}, {
			scopeId: chess.rule.scopeId, kind: PopupScopeKind.INDEPENDENT, phase: PopupTimerPhase.WAITING,
			remainingMilliseconds: 8000, siteCount: 1, site: chess, isCurrentScope: false,
		} ] : [],
	};
}
port.projection = originalProjection();
