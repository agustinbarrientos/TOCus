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
			latestBaseline: {
				measurementRevision: 'revision_1',
				focusedUseMilliseconds: 2_000,
			},
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
	it( 'parses a valid statistics document', () => {
		expect( StatisticsDocumentSchema.parse( VALID_STATISTICS_DOCUMENT ) ).toEqual( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					hasFinalizedBaseline: true,
				},
			},
		} );
	} );

	it( 'preserves an aggregate finalized-baseline marker without a current baseline', () => {
		const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;
		const result = StatisticsDocumentSchema.parse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					totals: scope.totals,
					hasFinalizedBaseline: true,
				},
			},
		} );

		expect( result.scopes.scope_default ).toEqual( {
			totals: scope.totals,
			hasFinalizedBaseline: true,
		} );
	} );

	it( 'omits a false aggregate finalized-baseline marker', () => {
		const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;
		const result = StatisticsDocumentSchema.parse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					totals: scope.totals,
					hasFinalizedBaseline: false,
				},
			},
		} );

		expect( Object.hasOwn(
			result.scopes.scope_default ?? {},
			'hasFinalizedBaseline',
		) ).toBe( false );
	} );

	it.each( [ 'true', 1, null ] )(
		'rejects the invalid aggregate finalized-baseline marker %#',
		( hasFinalizedBaseline ) => {
			const scope = VALID_STATISTICS_DOCUMENT.scopes.scope_default;

			expect( StatisticsDocumentSchema.safeParse( {
				...VALID_STATISTICS_DOCUMENT,
				scopes: {
					scope_default: {
						totals: scope.totals,
						hasFinalizedBaseline,
					},
				},
			} ).success ).toBe( false );
		},
	);

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

	it( 'retains a finalized baseline from an earlier measurement revision', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					latestBaseline: {
						measurementRevision: 'revision_old',
						focusedUseMilliseconds: 2_000,
					},
				},
			},
		} );

		expect( result.success ).toBe( true );
	} );

	it( 'rejects a baseline beyond the maximum possible allowance', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
					latestBaseline: {
						measurementRevision: 'revision_1',
						focusedUseMilliseconds: 3_600_001,
					},
				},
			},
		} );

		expect( result.success ).toBe( false );
	} );

	it.each( [ 0, 30_001, 3_600_000 ] )(
		'accepts the possible finalized baseline %i',
		( focusedUseMilliseconds ) => {
			const result = StatisticsDocumentSchema.safeParse( {
				...VALID_STATISTICS_DOCUMENT,
				scopes: {
					scope_default: {
						...VALID_STATISTICS_DOCUMENT.scopes.scope_default,
						latestBaseline: {
							measurementRevision: 'revision_1',
							focusedUseMilliseconds,
						},
					},
				},
			} );

			expect( result.success ).toBe( true );
		},
	);

	it( 'retains a finalized baseline for an inactive scope', () => {
		const result = StatisticsDocumentSchema.safeParse( {
			...VALID_STATISTICS_DOCUMENT,
			scopes: {
				scope_default: {
					totals: VALID_STATISTICS_DOCUMENT.scopes.scope_default.totals,
					latestBaseline: VALID_STATISTICS_DOCUMENT.scopes.scope_default.latestBaseline,
				},
			},
		} );

		expect( result.success ).toBe( true );
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
					latestBaseline: undefined,
					activeAllowance: undefined,
				},
			},
		} );
		const scope = result.scopes.scope_default;

		expect( Object.hasOwn( scope ?? {}, 'currentMeasurementRevision' ) ).toBe( false );
		expect( Object.hasOwn( scope ?? {}, 'latestBaseline' ) ).toBe( false );
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
			expect( result.scopes[ scopeId ] ).toEqual( {
				...scope,
				hasFinalizedBaseline: true,
			} );
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
