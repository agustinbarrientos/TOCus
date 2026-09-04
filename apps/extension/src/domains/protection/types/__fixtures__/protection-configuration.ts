import {
	ProtectionConfigurationDocumentSchema,
} from '../protected-site-configuration';
import { DefaultProtectionSchedule } from '../protection-schedule';
import { DefaultProtectionScopeId } from '../protection-value';
import { DefaultTimingConfiguration } from '../timing-configuration';

/**
 * Creates one deterministic measurement revision for editor tests.
 * @return Stable test measurement revision.
 * @since 0.1.0 Initial implementation.
 */
export function createTestProtectionMeasurementRevision(): string {
	return 'revision_test_next';
}

/**
 * Empty current configuration shared by protection configuration tests.
 * @since 0.1.0 Initial implementation.
 */
export const TestEmptyProtectionConfiguration = Object.freeze(
	ProtectionConfigurationDocumentSchema.parse( {
		schemaVersion: 3,
		sites: [],
		timingConfiguration: DefaultTimingConfiguration,
		schedulesByScope: {
			[ DefaultProtectionScopeId ]: DefaultProtectionSchedule,
		},
		measurementRevisionsByScope: {
			[ DefaultProtectionScopeId ]: 'revision_initial_scope_default',
		},
	} ),
);
