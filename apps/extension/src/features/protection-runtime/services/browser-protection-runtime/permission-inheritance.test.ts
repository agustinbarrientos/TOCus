import { StoredSessionProtectionStateSchema } from '../../../../domains/protection/types/stored-protection-state';
import { describe, expect, it, vi } from 'vitest';
import { CompletionAction } from '../../../../domains/protection/types/completion-action';
import { ProtectionConfigurationDocumentSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { ProtectionStateType } from '../../../../domains/protection/types/protection-state';
import { createSitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import { createPopupProjection } from '../../../popup/utils/create-popup-projection';
import { InterruptionPageRequestType } from '../../types/runtime-message';
import { EXAMPLE_CONFIGURATION, MemoryConfigurationStorage, MemoryProtectionStorage, MemoryRuntimeBrowser, completeFocusedPause, createRuntime } from './__fixtures__';

const MAIN = EXAMPLE_CONFIGURATION.sites[ 0 ];
if ( MAIN === undefined ) {
	throw new Error( 'Expected main website fixture.' );
}
const CHILD = {
	identityHost: 'studio.example.com',
	rule: { ...MAIN.rule, host: 'studio.example.com', includeSubdomains: false },
};
const URL = 'https://studio.example.com/feed';
const MONDAY = {
	mode: ScheduleMode.CUSTOM,
	windows: [ { weekday: Weekday.MONDAY, startMinute: 0, endMinute: 1440 } ],
};
const MAIN_TIMING = {
	...EXAMPLE_CONFIGURATION.timingConfiguration,
	initialWaitMilliseconds: 20_000,
	allowanceMilliseconds: 120_000,
	completionAction: CompletionAction.OPEN_AUTOMATICALLY,
};
const permissions = createSitePermissionManager( { permissions: {
	getAll: vi.fn().mockResolvedValue( { permissions: [ 'webNavigation' ], origins: [ '*://studio.example.com/*' ] } ),
	contains: vi.fn(), request: vi.fn(), remove: vi.fn(),
} } );

describe( 'permission-filtered website inheritance', () => {
	it.each( [ false, true ] )( 'retains the stored main policy across restart with legacy captures: %s', async ( legacy ) => {
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			sites: [ { ...MAIN, timingConfiguration: MAIN_TIMING }, CHILD ],
		} );
		const original = structuredClone( configuration );
		const configurationStorage = new MemoryConfigurationStorage( configuration );
		configurationStorage.filterForRuntime = permissions.filterConfiguration.bind( permissions );
		const storage = new MemoryProtectionStorage();
		const browser = new MemoryRuntimeBrowser();
		browser.tabs = [ { id: 7, incognito: false, url: URL } ];
		const now = { value: Date.UTC( 2026, 8, 15, 12 ) };
		const { runtime, coordinator } = createRuntime( now, configurationStorage, browser, storage );
		await runtime.start();
		expect( browser.rules ).toHaveLength( 1 );
		expect( browser.rules[ 0 ]?.condition.regexFilter ).toContain( 'studio\\.example\\.com' );
		const snapshot = await runtime.readSnapshot();
		if ( snapshot === null ) {
			throw new Error( 'Expected runtime snapshot.' );
		}
		expect( snapshot.configuration ).toEqual( original );
		const popup = createPopupProjection( {
			currentTab: { id: 7, incognito: false, url: URL }, snapshot,
			interruptionPageUrl: 'chrome-extension://extension-id/interruption.html',
		} );
		expect( popup ).toMatchObject( { currentSite: { nextWaitMilliseconds: 20_000 } } );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: URL } );
		expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
			capturedWaitDurationMilliseconds: 20_000,
			capturedAllowanceDurationMilliseconds: 120_000,
			capturedCompletionAction: CompletionAction.OPEN_AUTOMATICALLY,
		} );
		expect( configurationStorage.configuration ).toEqual( original );
		if ( legacy ) {
			const session = StoredSessionProtectionStateSchema.parse( storage.state.session );
			const wait = session.scopes.scope_default;
			if ( wait?.type !== ProtectionStateType.WAITING ) {
				throw new Error( 'Expected stored waiting state.' );
			}
			delete wait.capturedAllowanceDurationMilliseconds;
			delete wait.capturedCompletionAction;
			storage.state = { ...storage.state, session };
		} else {
			configurationStorage.configuration = ProtectionConfigurationDocumentSchema.parse( {
				...configuration,
				sites: [ { ...MAIN, timingConfiguration: EXAMPLE_CONFIGURATION.timingConfiguration }, CHILD ],
			} );
		}
		const restarted = createRuntime( now, configurationStorage, browser, storage );
		await restarted.runtime.start();
		expect( ( await restarted.coordinator.getStates() )?.scope_default ).toMatchObject( {
			capturedAllowanceDurationMilliseconds: 120_000,
			capturedCompletionAction: CompletionAction.OPEN_AUTOMATICALLY,
		} );
		await restarted.runtime.handlePageRequest(
			{ type: InterruptionPageRequestType.CONNECT, documentVisible: true }, 7, true,
		);
		await completeFocusedPause( restarted.runtime, 7, 20_000 );
		expect( ( await restarted.coordinator.getStates() )?.scope_default ).toMatchObject( {
			type: ProtectionStateType.ALLOWANCE,
			expiresAtEpochMilliseconds: now.value + 120_000,
		} );
	} );

	it.each( [ false, true ] )( 'retains inherited inactivity unless the child explicitly overrides it: %s', async ( override ) => {
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...EXAMPLE_CONFIGURATION,
			schedule: override ? MONDAY : { mode: ScheduleMode.ALWAYS },
			sites: [
				{ ...MAIN, schedule: MONDAY, timingConfiguration: MAIN_TIMING },
				{ ...CHILD, ...( override ? {
					schedule: { mode: ScheduleMode.ALWAYS },
					timingConfiguration: EXAMPLE_CONFIGURATION.timingConfiguration,
				} : {} ) },
			],
		} );
		const configurationStorage = new MemoryConfigurationStorage( configuration );
		configurationStorage.filterForRuntime = permissions.filterConfiguration.bind( permissions );
		const browser = new MemoryRuntimeBrowser();
		browser.tabs = [ { id: 7, incognito: false, url: URL } ];
		const { runtime, coordinator } = createRuntime(
			{ value: Date.UTC( 2026, 8, 15, 12 ) }, configurationStorage, browser,
		);
		await runtime.start();
		expect( browser.rules ).toHaveLength( override ? 1 : 0 );
		await runtime.handleNavigation( { tabId: 7, frameId: 0, url: URL } );
		if ( override ) {
			expect( ( await coordinator.getStates() )?.scope_default ).toMatchObject( {
				type: ProtectionStateType.WAITING,
				capturedWaitDurationMilliseconds: 10_000,
				capturedAllowanceDurationMilliseconds: 300_000,
				capturedCompletionAction: CompletionAction.SHOW_CONTINUE,
			} );
		} else {
			expect( ( await coordinator.getStates() )?.scope_default?.type ).not.toBe( ProtectionStateType.WAITING );
			expect( browser.protectionClockDeadlines ).toContain( Date.UTC( 2026, 8, 21 ) );
		}
		const before = await coordinator.getStates();
		await runtime.handleNavigation( { tabId: 8, frameId: 0, url: 'https://example.com/feed' } );
		expect( await coordinator.getStates() ).toEqual( before );
	} );
} );
