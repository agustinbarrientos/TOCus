import { describe, expect, it } from 'vitest';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__/protection-configuration';
import {
	createAllowanceState,
	createWaitingState,
} from '../../../../domains/protection/types/__fixtures__/protection-state';
import {
	ProtectionConfigurationDocumentSchema,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import { AllowanceProtectionStateSchema } from '../../../../domains/protection/types/protection-state';
import {
	StatisticsDocumentSchema,
	StatisticsDocumentVersion,
} from '../../../../domains/statistics/types/statistics-document';
import { resolveFocusedAllowance } from './index';
import { type ResolveFocusedAllowanceInput } from './types';

/**
 * Current instant shared by focused-allowance resolver tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_NOW_EPOCH_MILLISECONDS = 1_800_000_100_000;

/**
 * Protected configuration shared by focused-allowance resolver tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_CONFIGURATION = ProtectionConfigurationDocumentSchema.parse( {
	...TestEmptyProtectionConfiguration,
	sites: [ {
		identityHost: 'example.com',
		rule: {
			host: 'example.com',
			includeSubdomains: true,
			scopeId: 'scope-default',
		},
	} ],
	schedulesByScope: {
		...TestEmptyProtectionConfiguration.schedulesByScope,
		'scope-default': TestEmptyProtectionConfiguration.schedulesByScope.scope_default,
	},
	measurementRevisionsByScope: {
		...TestEmptyProtectionConfiguration.measurementRevisionsByScope,
		'scope-default': 'revision_scope_default',
	},
} );

/**
 * Active allowance shared by focused-allowance resolver tests.
 * @since 0.1.0 Initial implementation.
 */
const TEST_ALLOWANCE = AllowanceProtectionStateSchema.parse( {
	...createAllowanceState(),
	readyParticipants: [],
} );

/**
 * Statistics document containing the allowance eligible for focus measurement.
 * @since 0.1.0 Initial implementation.
 */
const TEST_STATISTICS_DOCUMENT = StatisticsDocumentSchema.parse( {
	schemaVersion: StatisticsDocumentVersion,
	generationId: 'generation_test',
	lastAppliedBatchId: null,
	scopes: {
		'scope-default': {
			totals: {
				estimatedReclaimedMilliseconds: 0,
				focusedPauseMilliseconds: 0,
				reconsideredVisitCount: 0,
				completedWaitCount: 0,
				allowanceGrantedCount: 1,
			},
			currentMeasurementRevision: 'revision_scope_default',
			activeAllowance: {
				allowanceId: TEST_ALLOWANCE.allowanceId,
				measurementRevision: 'revision_scope_default',
				startedAtEpochMilliseconds: TEST_ALLOWANCE.startedAtEpochMilliseconds,
				expiresAtEpochMilliseconds: TEST_ALLOWANCE.expiresAtEpochMilliseconds,
				confirmedFocusedUseMilliseconds: 0,
				accountedThroughEpochMilliseconds: TEST_ALLOWANCE.startedAtEpochMilliseconds,
			},
		},
	},
} );

/**
 * Creates a complete resolver input with one focused regular protected tab.
 * @param overrides - Input fields to replace for one test.
 * @return Focused-allowance resolver input.
 * @since 0.1.0 Initial implementation.
 */
function createInput(
	overrides: Partial<ResolveFocusedAllowanceInput> = {},
): ResolveFocusedAllowanceInput {
	return {
		configuration: TEST_CONFIGURATION,
		statisticsDocument: TEST_STATISTICS_DOCUMENT,
		statesByScope: { 'scope-default': TEST_ALLOWANCE },
		focusedTabId: 7,
		nowEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
		tabs: [ {
			id: 7,
			incognito: false,
			url: 'https://example.com/feed',
		} ],
		...overrides,
	};
}

describe( 'resolveFocusedAllowance', () => {
	it( 'returns only the current allowance measurement identity', () => {
		expect( resolveFocusedAllowance( createInput() ) ).toEqual( {
			scopeId: 'scope-default',
			measurementRevision: 'revision_scope_default',
			allowanceId: 'allowance-a',
		} );
	} );

	it( 'does not measure a focused protected tab before its Ready continuation', () => {
		const allowance = AllowanceProtectionStateSchema.parse( {
			...TEST_ALLOWANCE,
			readyParticipants: [ {
				...createAllowanceState().readyParticipants[ 0 ],
				pageId: 'page_tab_7_ready',
			} ],
		} );

		expect( resolveFocusedAllowance( createInput( {
			statesByScope: { 'scope-default': allowance },
		} ) ) ).toBeNull();
	} );

	it( 'fails closed when the coordinator snapshot lacks the matched scope', () => {
		expect( resolveFocusedAllowance( createInput( { statesByScope: {} } ) ) ).toBeNull();
	} );

	it( 'fails closed for a corrupted configuration missing the matched scope revision', () => {
		const corruptedConfiguration = {
			...TEST_CONFIGURATION,
			measurementRevisionsByScope: {},
		} as ProtectionConfigurationDocument;

		expect( resolveFocusedAllowance( createInput( {
			configuration: corruptedConfiguration,
		} ) ) ).toBeNull();
	} );

	it.each( [
		{ label: 'no focused browser window', overrides: { focusedTabId: null } },
		{ label: 'a missing focused tab', overrides: { focusedTabId: 9 } },
		{
			label: 'a private focused tab',
			overrides: { tabs: [ { id: 7, incognito: true, url: 'https://example.com/' } ] },
		},
		{
			label: 'a tab with unknown privacy',
			overrides: { tabs: [ { id: 7, url: 'https://example.com/' } ] },
		},
		{
			label: 'a tab without an observable URL',
			overrides: { tabs: [ { id: 7, incognito: false } ] },
		},
		{
			label: 'an unprotected URL',
			overrides: { tabs: [ { id: 7, incognito: false, url: 'https://outside.example/' } ] },
		},
		{
			label: 'an invalid URL',
			overrides: { tabs: [ { id: 7, incognito: false, url: 'not a url' } ] },
		},
		{
			label: 'a Waiting scope',
			overrides: { statesByScope: { 'scope-default': createWaitingState() } },
		},
		{
			label: 'an expired allowance',
			overrides: {
				statesByScope: {
					'scope-default': AllowanceProtectionStateSchema.parse( {
						...TEST_ALLOWANCE,
						expiresAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS,
						startedAtEpochMilliseconds: TEST_NOW_EPOCH_MILLISECONDS - 300_000,
					} ),
				},
			},
		},
		{
			label: 'statistics without the active allowance',
			overrides: {
				statisticsDocument: StatisticsDocumentSchema.parse( {
					...TEST_STATISTICS_DOCUMENT,
					scopes: {},
				} ),
			},
		},
		{
			label: 'a mismatched statistics allowance',
			overrides: {
				statisticsDocument: StatisticsDocumentSchema.parse( {
					...TEST_STATISTICS_DOCUMENT,
					scopes: {
						'scope-default': {
							...TEST_STATISTICS_DOCUMENT.scopes[ 'scope-default' ],
							activeAllowance: {
								...TEST_STATISTICS_DOCUMENT.scopes[ 'scope-default' ]?.activeAllowance,
								allowanceId: 'allowance-other',
							},
						},
					},
				} ),
			},
		},
	] )( 'returns null for $label', ( { overrides } ) => {
		expect( resolveFocusedAllowance( createInput( overrides ) ) ).toBeNull();
	} );

	it( 'uses a pending URL before the stale committed URL', () => {
		expect( resolveFocusedAllowance( createInput( {
			tabs: [ {
				id: 7,
				incognito: false,
				pendingUrl: 'https://example.com/new',
				url: 'https://outside.example/old',
			} ],
		} ) ) ).toEqual( {
			scopeId: 'scope-default',
			measurementRevision: 'revision_scope_default',
			allowanceId: 'allowance-a',
		} );
	} );

	it( 'uses the explicit top-level navigation URL for the focused navigating tab', () => {
		expect( resolveFocusedAllowance( createInput( {
			navigation: {
				frameId: 0,
				tabId: 7,
				url: 'https://outside.example/away',
			},
		} ) ) ).toBeNull();

		expect( resolveFocusedAllowance( createInput( {
			tabs: [ {
				id: 7,
				incognito: false,
				url: 'https://outside.example/old',
			} ],
			navigation: {
				frameId: 0,
				tabId: 7,
				url: 'https://example.com/current',
			},
		} ) ) ).not.toBeNull();
	} );

	it.each( [
		{ label: 'another tab', navigation: { frameId: 0, tabId: 8, url: 'https://outside.example/' } },
		{ label: 'a child frame', navigation: { frameId: 1, tabId: 7, url: 'https://outside.example/' } },
	] )( 'ignores an explicit navigation from $label', ( { navigation } ) => {
		expect( resolveFocusedAllowance( createInput( { navigation } ) ) ).not.toBeNull();
	} );

	it( 'resolves prototype-named scopes through own properties only', () => {
		const scopeId = '__proto__';
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			sites: [ {
				identityHost: 'example.com',
				rule: { host: 'example.com', includeSubdomains: false, scopeId },
			} ],
			schedulesByScope: Object.fromEntries( [
				...Object.entries( TestEmptyProtectionConfiguration.schedulesByScope ),
				[ scopeId, TestEmptyProtectionConfiguration.schedulesByScope.scope_default ],
			] ),
			measurementRevisionsByScope: Object.fromEntries( [
				...Object.entries( TestEmptyProtectionConfiguration.measurementRevisionsByScope ),
				[ scopeId, 'revision_prototype' ],
			] ),
		} );
		const state = AllowanceProtectionStateSchema.parse( {
			...TEST_ALLOWANCE,
			scopeId,
		} );
		const statisticsDocument = StatisticsDocumentSchema.parse( {
			...TEST_STATISTICS_DOCUMENT,
			scopes: Object.fromEntries( [
				[ scopeId, {
					...TEST_STATISTICS_DOCUMENT.scopes[ 'scope-default' ],
					currentMeasurementRevision: 'revision_prototype',
					activeAllowance: {
						...TEST_STATISTICS_DOCUMENT.scopes[ 'scope-default' ]?.activeAllowance,
						measurementRevision: 'revision_prototype',
					},
				} ],
			] ),
		} );

		expect( resolveFocusedAllowance( createInput( {
			configuration,
			statisticsDocument,
			statesByScope: Object.fromEntries( [ [ scopeId, state ] ] ),
		} ) ) ).toEqual( {
			scopeId,
			measurementRevision: 'revision_prototype',
			allowanceId: 'allowance-a',
		} );
	} );
} );
