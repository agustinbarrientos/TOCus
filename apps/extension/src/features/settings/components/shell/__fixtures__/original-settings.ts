import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../../../../domains/protection/types/protection-value';
import { DefaultProtectionSchedule, ScheduleMode, Weekday } from '../../../../../domains/protection/types/protection-schedule';
import { ProtectionConfigurationDocumentSchema } from '../../../../../domains/protection/types/protected-site-configuration';
import { TestEmptyProtectionConfiguration } from '../../../../../domains/protection/types/__fixtures__';

/**
 * Reconstructs the approved screenshot's persisted input, without changing presentation behavior.
 * @param name - Original screenshot filename selected by the visual runner.
 * @return Validated configuration matching the archived fixture.
 * @since 0.1.0
 */
export function originalConfiguration( name: string ) {
	const separate = ProtectionScopeIdSchema.parse( 'scope_visual_chatgpt' );
	const populated = name.includes( 'protected-site' ) && ! name.includes( 'empty' ) || name.includes( 'schedule' );
	const list = name.startsWith( 'protected-site-list-' );
	const item = name.startsWith( 'protected-site-item-' );
	const sharedHost = list ? 'youtube.com' : 'instagram.com';
	const independentHost = list ? 'x.com' : 'chatgpt.com';
	return ProtectionConfigurationDocumentSchema.parse( {
		...TestEmptyProtectionConfiguration,
		timingConfiguration: TestEmptyProtectionConfiguration.timingConfiguration,
		sites: populated ? [
			{ identityHost: item ? 'www.instagram.com' : sharedHost, ...( list ? {} : { displayNameOverride: 'Instagram' } ),
				rule: { host: sharedHost, includeSubdomains: true, scopeId: DefaultProtectionScopeId } },
			...( item ? [] : [ { identityHost: independentHost, ...( list ? {} : { displayNameOverride: 'ChatGPT' } ),
				rule: { host: independentHost, includeSubdomains: true, scopeId: separate } } ] ),
		] : [],
		schedulesByScope: { ...TestEmptyProtectionConfiguration.schedulesByScope,
			...( populated && ! item ? { [ separate ]: DefaultProtectionSchedule } : {} ),
			...( name.includes( 'schedule' ) ? { [ DefaultProtectionScopeId ]: { mode: ScheduleMode.CUSTOM,
				windows: [ { weekday: Weekday.MONDAY, startMinute: 540, endMinute: 1020 },
					{ weekday: Weekday.FRIDAY, startMinute: 1080, endMinute: 1320 } ] } } : {} ),
		},
		measurementRevisionsByScope: { ...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
			...( populated && ! item ? { [ separate ]: 'revision_visual_chatgpt' } : {} ) },
	} );
}
