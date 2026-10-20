import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../types/__fixtures__/protection-configuration';
import { DefaultProtectionScopeId } from '../../types/protection-value';
import { requireSitePolicy } from './index';

describe( 'required configured policy', () => {
	const rule = { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId };
	it( 'resolves a matched configured target', () => {
		const site = { identityHost: rule.host, rule };
		expect( requireSitePolicy( { ...TestEmptyProtectionConfiguration, sites: [ site ] }, rule ) ).toEqual( {
			site, schedule: TestEmptyProtectionConfiguration.schedule,
			timingConfiguration: TestEmptyProtectionConfiguration.timingConfiguration,
		} );
	} );
	it( 'rejects a mismatched configuration instead of silently applying global policy', () => {
		expect( () => requireSitePolicy( TestEmptyProtectionConfiguration, rule ) ).toThrow( 'Matched website policy is missing.' );
	} );
} );
