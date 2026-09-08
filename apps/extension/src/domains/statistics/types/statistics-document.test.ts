import { describe, expect, it } from 'vitest';
import { StatisticsDocumentSchema } from './statistics-document';

/**
 * Complete valid statistics document used by schema refinement tests.
 * @since 0.1.0 Initial implementation.
 */
const VALID_STATISTICS_DOCUMENT = {
	schemaVersion: 1,
	generationId: 'generation_1',
	lastAppliedBatchId: null,
	scopes: {
		scope_default: {
			totals: {
				estimatedReclaimedMilliseconds: 2_000,
				focusedPauseMilliseconds: 3_000,
				reconsideredVisitCount: 2,
				completedWaitCount: 1,
				allowanceGrantedCount: 1,
			},
			currentMeasurementRevision: 'revision_1',
			activeAllowance: {
				allowanceId: 'allowance_1',
				measurementRevision: 'revision_1',
				startedAtEpochMilliseconds: 10_000,
				expiresAtEpochMilliseconds: 70_000,
				confirmedFocusedUseMilliseconds: 4_000,
				accountedThroughEpochMilliseconds: 15_000,
			},
		},
	},
};

describe( 'StatisticsDocumentSchema', () => {
	it( 'rejects removed per-site focused use instead of accepting old persistence', () => {
		const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;
		expect( StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...scope,
					activeAllowance: {
						...scope.activeAllowance,
						focusedUseBySite: { 'youtube.com': 3_000 },
					},
				},
			},
		} ).success ).toBe( false );
	} );

	it.each( [
		{ hasFinalizedBaseline: true },
		{ hasFinalizedBaseline: false },
		{ latestBaseline: { measurementRevision: 'revision_1', focusedUseMilliseconds: 2_000 } },
		{ longestVisitsBySite: { 'youtube.com': 300_000 } },
		{ latestBaseline: undefined },
	] )( 'rejects removed baseline and visit-history fields %#', ( removedFields ) => {
		expect( StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: { ...VALID_STATISTICS_DOCUMENT.scopes.scope_default, ...removedFields },
			},
		} ).success ).toBe( false );
	} );

	it( 'parses a valid statistics document', () => {
		expect( StatisticsDocumentSchema.parse( VALID_STATISTICS_DOCUMENT ) ).toEqual(
			VALID_STATISTICS_DOCUMENT,
		);
	} );

	it( 'retains totals for an inactive scope', () => {
		const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;
		const result = StatisticsDocumentSchema.parse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					totals: scope.totals,
				},
			},
		} );

		expect( result.scopes.scope_default ).toEqual( {
			totals: scope.totals,
		} );
	} );

	it( 'rejects an unsupported document version', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			schemaVersion: 2,
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'rejects an active allowance accounted outside its interval', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					activeAllowance: {
						...VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance,
						accountedThroughEpochMilliseconds: 70_001,
					},
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it.each( [
		{ label: 'shorter than one minute', durationMilliseconds: 59_999 },
		{ label: 'off the whole-minute grid', durationMilliseconds: 60_001 },
		{ label: 'longer than sixty minutes', durationMilliseconds: 3_600_001 },
	] )( 'rejects an active allowance $label', ( { durationMilliseconds } ) => {
		const activeAllowance = VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance;
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					activeAllowance: {
						...activeAllowance,
						expiresAtEpochMilliseconds:
							activeAllowance.startedAtEpochMilliseconds + durationMilliseconds,
						confirmedFocusedUseMilliseconds: 0,
						accountedThroughEpochMilliseconds:
							activeAllowance.startedAtEpochMilliseconds,
					},
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it.each( [ 60_000, 3_600_000 ] )(
		'accepts the active allowance-duration boundary %i with sub-minute focused use',
		( durationMilliseconds ) => {
			const activeAllowance = VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance;
			const result = StatisticsDocumentSchema.safeParse( {
				...VALID_STATISTICS_DOCUMENT,
				scopes: {
					scope_default: {
						...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
						activeAllowance: {
							...activeAllowance,
							expiresAtEpochMilliseconds:
								activeAllowance.startedAtEpochMilliseconds + durationMilliseconds,
							confirmedFocusedUseMilliseconds: 30_001,
							accountedThroughEpochMilliseconds:
								activeAllowance.startedAtEpochMilliseconds + 30_001,
						},
					},
				},
			} );

			expect( result.success ).toBe( true );
		},
	);

	it( 'rejects an active allowance that does not end after it starts', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					activeAllowance: {
						...VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance,
						expiresAtEpochMilliseconds: 10_000,
						accountedThroughEpochMilliseconds: 10_000,
					},
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'rejects confirmed use beyond the accounted interval', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					activeAllowance: {
						...VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance,
						confirmedFocusedUseMilliseconds: 5_001,
					},
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'rejects an active allowance retained by an inactive scope', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					totals: VALID_STATISTICS_DOCUMENT.scopes.scope_default.totals,
					activeAllowance: VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance,
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'rejects an active allowance from another measurement revision', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					activeAllowance: {
						...VALID_STATISTICS_DOCUMENT.scopes.scope_default.activeAllowance,
						measurementRevision: 'revision_old',
					},
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it( 'omits explicitly undefined optional scope fields', () => {
		const result = StatisticsDocumentSchema.parse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					totals: VALID_STATISTICS_DOCUMENT.scopes.scope_default.totals,
					currentMeasurementRevision: undefined,
					activeAllowance: undefined,
				},
			},
		} );
		const scope = result.scopes.scope_default;

		expect( Object.hasOwn( scope ?? {}, 'currentMeasurementRevision' ) ).toBe( false );
		expect( Object.hasOwn( scope ?? {}, 'activeAllowance' ) ).toBe( false );
	} );

	it.each( [ '__proto__', 'constructor', 'toString' ] )(
		'preserves the supported object-property scope key %s',
		( scopeId ) => {
			const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;
			const result = StatisticsDocumentSchema.parse( {
				...VALID_STATISTICS_DOCUMENT,
				scopes: Object.fromEntries( [ [ scopeId, scope ] ] ),
			} );

			expect( Object.hasOwn( result.scopes, scopeId ) ).toBe( true );
			expect( result.scopes[ scopeId ] ).toEqual( scope );
		},
	);

	it.each( [ 'not-a-record', null, [], new Date( 0 ) ] )(
		'rejects a non-plain scope record %#',
		( scopes ) => {
			expect( StatisticsDocumentSchema.safeParse( {
				...VALID_STATISTICS_DOCUMENT,
				scopes,
			} ).success ).toBe( false );
		},
	);

	it( 'parses a null-prototype scope record', () => {
		const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;
		const scopes = Object.fromEntries( [ [ '__proto__', scope ] ] );

		Reflect.setPrototypeOf( scopes, null );

		const result = StatisticsDocumentSchema.parse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes,
		} );

		expect( Object.hasOwn( result.scopes, '__proto__' ) ).toBe( true );
	} );
} );
