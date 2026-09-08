import { describe, expect, it } from 'vitest';
import { PopupProjectionStatus, PopupTimerPhase, PopupScopeKind, PopupScheduleStatus, PopupCurrentSiteAccess, PopupCurrentSiteStatus, PopupProjectionSchema } from './popup-projection';

const SITE = Object.freeze( {
	identityHost: 'example.com',
	rule: {
		host: 'example.com',
		includeSubdomains: true,
		scopeId: 'scope_default',
	},
} as const );
const BASE_PROJECTION = Object.freeze( {
	status: PopupProjectionStatus.AVAILABLE,
	capturedAtEpochMilliseconds: 1_800_000_000_000,
	currentSite: {
		status: PopupCurrentSiteStatus.PROTECTED,
		site: SITE,
		scopeId: 'scope_default',
		access: PopupCurrentSiteAccess.GRANTED,
		schedule: PopupScheduleStatus.ACTIVE,
		nextWaitMilliseconds: 10_000,
	},
	activeScopes: [],
} as const );

describe( 'PopupProjectionSchema', () => {
	it( 'accepts one internally consistent protected website projection', () => {
		expect( PopupProjectionSchema.safeParse( BASE_PROJECTION ).success ).toBe( true );
	} );

	it( 'accepts an independent Waiting scope whose website uses the same scope', () => {
		const projection = {
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: PopupScopeKind.INDEPENDENT,
				site: {
					...SITE,
					rule: { ...SITE.rule, scopeId: 'scope_other' },
				},
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: false,
			} ],
		};

		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( true );
	} );

	it( 'rejects duplicate active scope identifiers', () => {
		const activeScope = {
			scopeId: 'scope_other',
			kind: PopupScopeKind.INDEPENDENT,
			site: {
				...SITE,
				rule: { ...SITE.rule, scopeId: 'scope_other' },
			},
			phase: PopupTimerPhase.WAITING,
			remainingMilliseconds: 5_000,
			siteCount: 1,
			isCurrentScope: false,
		} as const;
		const projection = {
			...BASE_PROJECTION,
			activeScopes: [ activeScope, activeScope ],
		};

		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
	} );

	it.each( [
		{
			...BASE_PROJECTION,
			currentSite: {
				...BASE_PROJECTION.currentSite,
				nextWaitMilliseconds: null,
			},
			activeScopes: [ {
				scopeId: 'scope_default',
				kind: PopupScopeKind.SHARED,
				site: null,
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: false,
			} ],
		},
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: PopupScopeKind.INDEPENDENT,
				site: {
					...SITE,
					rule: { ...SITE.rule, scopeId: 'scope_other' },
				},
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: true,
			} ],
		},
	] )( 'rejects an active scope whose current marker contradicts the current website', ( projection ) => {
		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
	} );

	it( 'rejects a next wait while the current protected scope is active', () => {
		const projection = {
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_default',
				kind: PopupScopeKind.SHARED,
				site: null,
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: true,
			} ],
		};

		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
	} );

	it.each( [ 1_800_000_000_000, 1_799_999_999_999 ] )(
		'rejects an Allowance scope that does not expire after the projection was captured',
		( expiresAtEpochMilliseconds ) => {
			const projection = {
				...BASE_PROJECTION,
				activeScopes: [ {
					scopeId: 'scope_other',
					kind: PopupScopeKind.INDEPENDENT,
					site: {
						...SITE,
						rule: { ...SITE.rule, scopeId: 'scope_other' },
					},
					phase: PopupTimerPhase.ALLOWANCE,
					expiresAtEpochMilliseconds,
					siteCount: 1,
					isCurrentScope: false,
				} ],
			};

			expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
		},
	);

	it.each( [
		{
			...BASE_PROJECTION,
			currentSite: { ...BASE_PROJECTION.currentSite, scopeId: 'scope_other' },
		},
		{
			...BASE_PROJECTION,
			currentSite: {
				...BASE_PROJECTION.currentSite,
				access: PopupCurrentSiteAccess.MISSING,
			},
		},
		{
			...BASE_PROJECTION,
			currentSite: {
				...BASE_PROJECTION.currentSite,
				schedule: PopupScheduleStatus.INACTIVE,
			},
		},
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: PopupScopeKind.INDEPENDENT,
				site: SITE,
				phase: PopupTimerPhase.WAITING,
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: false,
			} ],
		},
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: PopupScopeKind.INDEPENDENT,
				site: SITE,
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: 1_800_000_020_000,
				siteCount: 1,
				isCurrentScope: false,
			} ],
		},
	] )( 'rejects contradictory scope, access, or schedule metadata', ( projection ) => {
		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
	} );

	it.each( [
		{ ...BASE_PROJECTION, capturedAtEpochMilliseconds: -1 },
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_default',
				kind: PopupScopeKind.SHARED,
				site: null,
				phase: PopupTimerPhase.ALLOWANCE,
				expiresAtEpochMilliseconds: -1,
				siteCount: 1,
				isCurrentScope: true,
			} ],
		},
	] )( 'rejects negative wall-clock instants', ( projection ) => {
		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
	} );
} );
