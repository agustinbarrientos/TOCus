import { describe, expect, it } from 'vitest';
import { PopupProjectionSchema } from './popup-projection';

const SITE = Object.freeze( {
	identityHost: 'example.com',
	rule: {
		host: 'example.com',
		includeSubdomains: true,
		scopeId: 'scope_default',
	},
} as const );
const BASE_PROJECTION = Object.freeze( {
	status: 'available',
	capturedAtEpochMilliseconds: 1_800_000_000_000,
	currentSite: {
		status: 'protected',
		site: SITE,
		scopeId: 'scope_default',
		access: 'granted',
		schedule: 'active',
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
				kind: 'independent',
				site: {
					...SITE,
					rule: { ...SITE.rule, scopeId: 'scope_other' },
				},
				phase: 'waiting',
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
			kind: 'independent',
			site: {
				...SITE,
				rule: { ...SITE.rule, scopeId: 'scope_other' },
			},
			phase: 'waiting',
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
				kind: 'shared',
				site: null,
				phase: 'waiting',
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: false,
			} ],
		},
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: 'independent',
				site: {
					...SITE,
					rule: { ...SITE.rule, scopeId: 'scope_other' },
				},
				phase: 'waiting',
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
				kind: 'shared',
				site: null,
				phase: 'waiting',
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
					kind: 'independent',
					site: {
						...SITE,
						rule: { ...SITE.rule, scopeId: 'scope_other' },
					},
					phase: 'allowance',
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
				access: 'missing',
			},
		},
		{
			...BASE_PROJECTION,
			currentSite: {
				...BASE_PROJECTION.currentSite,
				schedule: 'inactive',
			},
		},
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: 'independent',
				site: SITE,
				phase: 'waiting',
				remainingMilliseconds: 5_000,
				siteCount: 1,
				isCurrentScope: false,
			} ],
		},
		{
			...BASE_PROJECTION,
			activeScopes: [ {
				scopeId: 'scope_other',
				kind: 'independent',
				site: SITE,
				phase: 'allowance',
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
				kind: 'shared',
				site: null,
				phase: 'allowance',
				expiresAtEpochMilliseconds: -1,
				siteCount: 1,
				isCurrentScope: true,
			} ],
		},
	] )( 'rejects negative wall-clock instants', ( projection ) => {
		expect( PopupProjectionSchema.safeParse( projection ).success ).toBe( false );
	} );
} );
