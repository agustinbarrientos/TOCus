import type { ProtectedSiteConfiguration } from '../../types/protected-site-configuration';
import { canonicalizeProtectedSite, ProtectedSiteCanonicalizationStatus } from '../protected-site-canonicalizer';
import { getProtectedSiteRuleKey } from '../protected-site-rule-key';
import type { ProtectedSiteInputListResult } from './types';

/**
 * Splits an address list while excluding empty comma-separated segments.
 * @param input - Raw address field, including optional whitespace and separators.
 * @return Trimmed nonempty addresses in their original order.
 * @since 1.1.0
 */
export function splitProtectedSiteInputs( input: string ): string[] {
	return input.split( ',' ).map( ( entry ) => entry.trim() ).filter( ( entry ) => entry.length > 0 );
}

/**
 * Canonicalizes each address and reports invalid entries before callers stage a batch.
 * @param input - Raw comma-separated addresses.
 * @param scopeId - Protection scope applied to each explicit target.
 * @return Canonically unique targets and invalid input addresses, preserving first occurrence order.
 * @since 1.1.0
 */
export function canonicalizeProtectedSiteInputs( input: string, scopeId: unknown ): ProtectedSiteInputListResult {
	const sites: ProtectedSiteConfiguration[] = [];
	const invalidInputs: string[] = [];
	const keys = new Set<string>();
	for ( const entry of splitProtectedSiteInputs( input ) ) {
		const canonical = canonicalizeProtectedSite( entry, scopeId );
		if ( canonical.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			invalidInputs.push( entry );
			continue;
		}
		const key = getProtectedSiteRuleKey( canonical.rule );
		if ( ! keys.has( key ) ) {
			keys.add( key );
			sites.push( { identityHost: canonical.identityHost, rule: canonical.rule } );
		}
	}
	return { sites, invalidInputs };
}
