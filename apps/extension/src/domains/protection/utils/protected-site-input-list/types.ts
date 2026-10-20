import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';

/**
 * Canonically unique website targets and invalid entries from an address list.
 * @since 1.1.0
 */
export interface ProtectedSiteInputListResult {
	sites: ProtectedSiteConfiguration[];
	invalidInputs: string[];
}
