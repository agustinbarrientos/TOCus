import {
	ProtectionConfigurationDocumentSchema,
} from '../protected-site-configuration';
import { DefaultProtectionSchedule } from '../protection-schedule';
import { DefaultProtectionScopeId } from '../protection-value';
import { DefaultTimingConfiguration } from '../timing-configuration';

/**
 * Empty current configuration shared by protection configuration tests.
 * @since 0.1.0 Initial implementation.
 */
export const TestEmptyProtectionConfiguration = Object.freeze(
	ProtectionConfigurationDocumentSchema.parse( {
		schemaVersion: 2,
		sites: [],
		timingConfiguration: DefaultTimingConfiguration,
		schedulesByScope: {
			[ DefaultProtectionScopeId ]: DefaultProtectionSchedule,
		},
	} ),
);
