import type { PopupCurrentSiteStatus, PopupCurrentSite } from '../../types/popup-projection';

/**
 * Current-site states with enough canonical host metadata to display an identity.
 * @since 0.1.0
 */
export type PopupIdentifiedCurrentSite = Extract<PopupCurrentSite, Record<'status', typeof PopupCurrentSiteStatus.PROTECTED | typeof PopupCurrentSiteStatus.UNPROTECTED>>;
