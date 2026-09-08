import { PopupProjectionStatus, PopupTimerPhase, PopupScopeKind, PopupScheduleStatus, PopupCurrentSiteAccess, PopupCurrentSiteStatus } from '../../../types/popup-projection';
import '@tocus/ui/styles.scss';
import '../../../../../entrypoints/popup/styles.scss';
import { mountPopup } from '../../../services/popup-presentation';
import { createEnglishLocalizationBundle } from '../../../../../localization';
import { DefaultProtectionScopeId } from '../../../../../domains/protection/types/protection-value';
import { ProtectedSiteConfigurationSchema } from '../../../../../domains/protection/types/protected-site-configuration';
import { PopupAddSiteRequestEventName, PopupRetryRequestEventName } from '../types';
import type { PopupFixtureBridge } from './types';

const root = document.getElementById( 'app' );
if ( root === null ) {
	throw new TypeError( 'The popup fixture requires a mount container.' );
}
const port = mountPopup( root );
port.copy = createEnglishLocalizationBundle().popup;
port.settingsPageUrl = '/options.html#protected-sites';
port.statisticsPageUrl = '/options.html#statistics';
port.projection = {
	status: PopupProjectionStatus.AVAILABLE, capturedAtEpochMilliseconds: 1000,
	currentSite: { status: PopupCurrentSiteStatus.UNPROTECTED, identityHost: 'example.com' }, activeScopes: [],
};

const bridge: PopupFixtureBridge = {
	currentSiteStatuses: PopupCurrentSiteStatus, scopeKinds: PopupScopeKind, timerPhases: PopupTimerPhase,
	port,
	requests: 0,
	retries: 0,
	listed: {
		status: PopupProjectionStatus.AVAILABLE, capturedAtEpochMilliseconds: 1000,
		currentSite: {
			status: PopupCurrentSiteStatus.PROTECTED, scopeId: DefaultProtectionScopeId,
			site: ProtectedSiteConfigurationSchema.parse( {
				identityHost: 'example.com',
				rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
			} ),
			access: PopupCurrentSiteAccess.GRANTED, schedule: PopupScheduleStatus.ACTIVE, nextWaitMilliseconds: null,
		},
		activeScopes: [],
	},
	wait: {
		kind: PopupScopeKind.SHARED, phase: PopupTimerPhase.WAITING, scopeId: DefaultProtectionScopeId,
		site: null, siteCount: 1, isCurrentScope: true, remainingMilliseconds: 5000,
	},
};
port.addEventListener( PopupAddSiteRequestEventName, () => {
	bridge.requests++;
	port.adding = true;
} );
port.addEventListener( PopupRetryRequestEventName, () => {
	bridge.retries++;
	port.retrying = true;
} );
window.popupTest = bridge;
