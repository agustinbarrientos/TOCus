import { describe, expect, it } from 'vitest';
import { AllowanceDurationMillisecondsSchema } from '../allowance-duration';
import {
	AllowanceGrantedFactInputSchema,
	PauseTimeFactInputSchema,
} from '../protection-fact';
import {
	DefaultProtectionSchedule,
	NormalizedCustomScheduleSchema,
	ScheduleEndMinuteSchema,
	ScheduleMode,
	ScheduleStartMinuteSchema,
	ScheduleWindowSchema,
} from '../protection-schedule';
import {
	CanonicalHostSchema,
	ProtectedSiteRuleSchema,
	ProtectedSiteRuleSetSchema,
} from '../protected-site-rule';
import {
	ProtectionConfigurationDocumentSchema,
	ProtectionScopeMeasurementRevisionMapSchema,
	ProtectionScopeScheduleMapSchema,
} from '../protected-site-configuration';
import {
	ProtectionParticipantOrigin,
} from '../protection-participant';
import {
	ProtectionStateSchema,
} from '../protection-state';
import { LocalDateSchema } from '../protection-value';
import {
	ProtectionParticipantOriginByStoredProtectionParticipantOrigin,
	StoredProtectionParticipantOrigin,
	StoredProtectionParticipantOriginByProtectionParticipantOrigin,
	StoredProtectionParticipantsSchema,
} from '../stored-protection-participant';
import {
	StoredDurableProtectionStateSchema,
	StoredProtectionAllowanceSchema,
	StoredSessionProtectionStateSchema,
} from '../stored-protection-state';
import {
	DefaultTimingConfiguration,
	TimingConfigurationSchema,
} from '../timing-configuration';
import {
	DepartureCause,
	ProtectionEventSchema,
} from '../protection-event';
import {
	createAllowanceExpiry,
	createDeparture,
	createFocusChange,
	createProgressCheckpoint,
	createReadyContinuation,
	createReadyReconciliation,
	createScheduleReevaluation,
	createVisitAttempt,
} from './protection-event';
import {
	Mock_ProtectionSchedule_Custom,
	Mock_ProtectionSchedule_Normalized,
} from './protection-schedule';
import {
	createAllowanceState,
	createIdleState,
	createNavigationParticipant,
	createWaitingState,
} from './protection-state';
import {
	Mock_StoredProtectionParticipant_Navigation,
	Mock_StoredProtectionState_Durable,
	Mock_StoredProtectionState_Session,
} from './stored-protection-state';
import { TestEmptyProtectionConfiguration } from './protection-configuration';

/**
 * Fixed allowance start instant used by fixture validation.
 * @since 0.1.0 Initial implementation.
 */
const AllowanceStartInstant = 1_800_000_000_000;

/**
 * Allowance durations outside the supported whole-minute range.
 * @since 0.1.0 Initial implementation.
 */
const InvalidAllowanceDurations = [
	{ label: 'less than one minute', durationMilliseconds: 59_999 },
	{ label: 'off the whole-minute grid', durationMilliseconds: 60_001 },
	{ label: 'more than sixty minutes', durationMilliseconds: 3_600_001 },
] as const;

describe( 'protection type fixtures', () => {
	it.each( [
		createVisitAttempt(),
		createFocusChange(),
		createProgressCheckpoint(),
		createReadyContinuation(),
		createReadyReconciliation(),
		createAllowanceExpiry(),
		createDeparture( DepartureCause.BACK ),
		createScheduleReevaluation(),
	] )( 'round-trips the $type event fixture', ( fixture ) => {
		expect( ProtectionEventSchema.parse( fixture ) ).toStrictEqual( fixture );
	} );

	it.each( [
		createIdleState(),
		createWaitingState(),
		createAllowanceState(),
	] )( 'round-trips the $type state fixture', ( fixture ) => {
		expect( ProtectionStateSchema.parse( fixture ) ).toStrictEqual( fixture );
	} );

	it( 'round-trips schedule fixtures', () => {
		expect( ScheduleWindowSchema.parse( Mock_ProtectionSchedule_Custom.windows[ 0 ] ) )
			.toStrictEqual( Mock_ProtectionSchedule_Custom.windows[ 0 ] );
		expect( NormalizedCustomScheduleSchema.parse( Mock_ProtectionSchedule_Normalized ) )
			.toStrictEqual( Mock_ProtectionSchedule_Normalized );
	} );

	it( 'round-trips the current protection configuration fixture', () => {
		expect( ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			schemaVersion: 3,
			measurementRevisionsByScope: {
				scope_default: 'revision_initial_scope_default',
			},
		} ) ).toStrictEqual( {
			...TestEmptyProtectionConfiguration,
			schemaVersion: 3,
			measurementRevisionsByScope: {
				scope_default: 'revision_initial_scope_default',
			},
		} );
	} );

	it( 'round-trips stored-state fixtures', () => {
		expect( StoredDurableProtectionStateSchema.parse( Mock_StoredProtectionState_Durable ) )
			.toStrictEqual( Mock_StoredProtectionState_Durable );
		expect( StoredSessionProtectionStateSchema.parse( Mock_StoredProtectionState_Session ) )
			.toStrictEqual( Mock_StoredProtectionState_Session );
	} );
} );

describe( 'protection contract custom rules', () => {
	it( 'requires canonical hosts and non-overlapping protected-site ranges', () => {
		expect( CanonicalHostSchema.safeParse( 'Example.com' ).success ).toBe( false );
		expect( ProtectedSiteRuleSchema.safeParse( {
			host: '127.0.0.1',
			includeSubdomains: true,
			scopeId: 'scope-a',
		} ).success ).toBe( false );
		expect( ProtectedSiteRuleSetSchema.safeParse( [
			{ host: 'example.com', includeSubdomains: true, scopeId: 'scope-a' },
			{ host: 'www.example.com', includeSubdomains: false, scopeId: 'scope-a' },
		] ).success ).toBe( false );
	} );

	it( 'requires one measurement revision for every active protection scope', () => {
		const currentConfiguration = {
			...TestEmptyProtectionConfiguration,
			schemaVersion: 3,
			measurementRevisionsByScope: {
				scope_default: 'revision_initial_scope_default',
			},
		};

		expect( ProtectionConfigurationDocumentSchema.safeParse( {
			...currentConfiguration,
			measurementRevisionsByScope: {},
		} ).success ).toBe( false );
		expect( ProtectionConfigurationDocumentSchema.safeParse( {
			...currentConfiguration,
			measurementRevisionsByScope: {
				...currentConfiguration.measurementRevisionsByScope,
				scope_orphan: 'revision_orphan',
			},
		} ).success ).toBe( false );
		expect( ProtectionScopeMeasurementRevisionMapSchema.safeParse( {
			'scope with spaces': 'revision_invalid_key',
		} ).success ).toBe( false );
	} );

	it( 'preserves every supported object-property scope key in both configuration maps', () => {
		const scopeIds = [ '__proto__', 'constructor', 'toString', 'hasOwnProperty' ];
		const schedulesByScope = Object.fromEntries(
			scopeIds.map( ( scopeId ) => [ scopeId, DefaultProtectionSchedule ] as const ),
		);
		const measurementRevisionsByScope = Object.fromEntries(
			scopeIds.map( ( scopeId, index ) => [ scopeId, `revision_${ String( index ) }` ] as const ),
		);

		Reflect.setPrototypeOf( schedulesByScope, null );
		Reflect.setPrototypeOf( measurementRevisionsByScope, null );

		const parsedSchedules = ProtectionScopeScheduleMapSchema.parse( schedulesByScope );
		const parsedRevisions = ProtectionScopeMeasurementRevisionMapSchema.parse(
			measurementRevisionsByScope,
		);

		expect( Object.keys( parsedSchedules ) ).toEqual( scopeIds );
		expect( Object.keys( parsedRevisions ) ).toEqual( scopeIds );
		for ( const scopeId of scopeIds ) {
			expect( Object.hasOwn( parsedSchedules, scopeId ) ).toBe( true );
			expect( parsedSchedules[ scopeId ] ).toEqual( DefaultProtectionSchedule );
			expect( Object.hasOwn( parsedRevisions, scopeId ) ).toBe( true );
			expect( parsedRevisions[ scopeId ] ).toBe(
				measurementRevisionsByScope[ scopeId ],
			);
		}
	} );

	it.each( [
		{
			label: 'schedule',
			schema: ProtectionScopeScheduleMapSchema,
			validValue: DefaultProtectionSchedule,
			invalidValue: { mode: 'sometimes' },
		},
		{
			label: 'measurement-revision',
			schema: ProtectionScopeMeasurementRevisionMapSchema,
			validValue: 'revision_valid',
			invalidValue: 'invalid revision',
		},
	] )( 'rejects unsafe or invalid $label map input', ( {
		schema,
		validValue,
		invalidValue,
	} ) => {
		const inheritedRecord = {};
		Reflect.setPrototypeOf( inheritedRecord, { scope_inherited: validValue } );

		expect( schema.safeParse( [] ).success ).toBe( false );
		expect( schema.safeParse( 'scope-map' ).success ).toBe( false );
		expect( schema.safeParse( 1 ).success ).toBe( false );
		expect( schema.safeParse( null ).success ).toBe( false );
		expect( schema.safeParse( inheritedRecord ).success ).toBe( false );
		expect( schema.safeParse( Object.fromEntries( [
			[ 'scope with spaces', validValue ],
		] ) ).success ).toBe( false );
		expect( schema.safeParse( Object.fromEntries( [
			[ 'scope_invalid', invalidValue ],
		] ) ).success ).toBe( false );
	} );

	it( 'round-trips prototype-named active scopes through the configuration document schema', () => {
		const scopeIds = [ '__proto__', 'constructor', 'toString', 'hasOwnProperty' ];
		const schedulesByScope = Object.fromEntries( [
			[ 'scope_default', DefaultProtectionSchedule ] as const,
			...scopeIds.map( ( scopeId ) => [ scopeId, DefaultProtectionSchedule ] as const ),
		] );
		const measurementRevisionsByScope = Object.fromEntries( [
			[ 'scope_default', 'revision_default' ] as const,
			...scopeIds.map( ( scopeId, index ) => [
				scopeId,
				`revision_${ String( index ) }`,
			] as const ),
		] );
		const configuration = ProtectionConfigurationDocumentSchema.parse( {
			...TestEmptyProtectionConfiguration,
			sites: scopeIds.map( ( scopeId, index ) => ( {
				identityHost: `scope-${ String( index ) }.example`,
				rule: {
					host: `scope-${ String( index ) }.example`,
					includeSubdomains: false,
					scopeId,
				},
			} ) ),
			schedulesByScope,
			measurementRevisionsByScope,
		} );

		for ( const scopeId of scopeIds ) {
			expect( Object.hasOwn( configuration.schedulesByScope, scopeId ) ).toBe( true );
			expect( Object.hasOwn( configuration.measurementRevisionsByScope, scopeId ) ).toBe( true );
		}
	} );

	it( 'accepts only real ISO calendar dates', () => {
		expect( LocalDateSchema.parse( '2028-02-29' ) ).toBe( '2028-02-29' );
		expect( LocalDateSchema.safeParse( '2026-02-29' ).success ).toBe( false );
	} );

	it( 'normalizes negative-zero schedule minutes', () => {
		expect( ScheduleStartMinuteSchema.parse( -0 ) ).toBe( 0 );
		expect( ScheduleEndMinuteSchema.parse( -0 ) ).toBe( 0 );
	} );

	it( 'rejects empty and non-canonical normalized schedule ranges', () => {
		expect( ScheduleWindowSchema.safeParse( {
			weekday: 'Monday',
			startMinute: 60,
			endMinute: 60,
		} ).success ).toBe( false );
		expect( NormalizedCustomScheduleSchema.safeParse( {
			mode: ScheduleMode.CUSTOM,
			windows: [
				{ weekday: 'Tuesday', startMinute: 60, endMinute: 120 },
				{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
			],
		} ).success ).toBe( false );
		expect( NormalizedCustomScheduleSchema.safeParse( {
			mode: ScheduleMode.CUSTOM,
			windows: [
				{ weekday: 'Monday', startMinute: 60, endMinute: 120 },
				{ weekday: 'Monday', startMinute: 120, endMinute: 180 },
			],
		} ).success ).toBe( false );
	} );

	it( 'rejects inconsistent protection facts', () => {
		expect( PauseTimeFactInputSchema.safeParse( {
			scopeId: 'scope-a',
			waitId: 'wait-a',
			ownerParticipantId: 'participant-a',
			ownerEpoch: 1,
			checkpointHighWaterMilliseconds: 2_000,
			acceptedDurationMilliseconds: 2_001,
			observedAtEpochMilliseconds: 1_800_000_000_000,
		} ).success ).toBe( false );
		expect( AllowanceGrantedFactInputSchema.safeParse( {
			scopeId: 'scope-a',
			allowanceId: 'allowance-a',
			startedAtEpochMilliseconds: AllowanceStartInstant,
			expiresAtEpochMilliseconds: AllowanceStartInstant + 300_000,
			allowanceDurationMilliseconds: 240_000,
		} ).success ).toBe( false );
	} );

	it( 'rejects a progress checkpoint whose allowance expiry cannot be represented', () => {
		const checkpoint = {
			...createProgressCheckpoint(),
			observedAtEpochMilliseconds: Number.MAX_SAFE_INTEGER - 1,
		};

		expect( ProtectionEventSchema.safeParse( checkpoint ).success ).toBe( false );
	} );

	it( 'requires completed-wait provenance whenever an Allowance retains Ready participants', () => {
		const allowanceWithoutProvenance = { ...createAllowanceState() };
		const storedReadyWithoutProvenance = {
			...Mock_StoredProtectionState_Session.scopes[ 'scope-a' ],
		};
		Reflect.deleteProperty( allowanceWithoutProvenance, 'completedWaitId' );
		Reflect.deleteProperty( storedReadyWithoutProvenance, 'completedWaitId' );

		expect( ProtectionStateSchema.safeParse( allowanceWithoutProvenance ).success ).toBe( false );
		expect( ProtectionStateSchema.safeParse( {
			...createAllowanceState(),
			completedWaitId: null,
		} ).success ).toBe( false );
		expect( StoredSessionProtectionStateSchema.safeParse( {
			...Mock_StoredProtectionState_Session,
			scopes: {
				'scope-a': storedReadyWithoutProvenance,
			},
		} ).success ).toBe( false );
	} );

	it.each( InvalidAllowanceDurations )(
		'rejects $label in every allowance-duration contract',
		( { durationMilliseconds } ) => {
			const allowanceState = {
				...createAllowanceState(),
				startedAtEpochMilliseconds: AllowanceStartInstant,
				expiresAtEpochMilliseconds: AllowanceStartInstant + durationMilliseconds,
			};
			const storedAllowance = {
				allowanceId: 'allowance-a',
				startedAtEpochMilliseconds: AllowanceStartInstant,
				expiresAtEpochMilliseconds: AllowanceStartInstant + durationMilliseconds,
			};
			const allowanceFact = {
				scopeId: 'scope-a',
				...storedAllowance,
				allowanceDurationMilliseconds: durationMilliseconds,
			};

			expect( AllowanceDurationMillisecondsSchema.safeParse( durationMilliseconds ).success )
				.toBe( false );
			expect( ProtectionStateSchema.safeParse( allowanceState ).success ).toBe( false );
			expect( StoredProtectionAllowanceSchema.safeParse( storedAllowance ).success ).toBe( false );
			expect( AllowanceGrantedFactInputSchema.safeParse( allowanceFact ).success ).toBe( false );
		},
	);

	it.each( [ 60_000, 3_600_000 ] )(
		'accepts the inclusive allowance-duration boundary %i',
		( durationMilliseconds ) => {
			const allowanceState = {
				...createAllowanceState(),
				startedAtEpochMilliseconds: AllowanceStartInstant,
				expiresAtEpochMilliseconds: AllowanceStartInstant + durationMilliseconds,
			};
			const storedAllowance = {
				allowanceId: 'allowance-a',
				startedAtEpochMilliseconds: AllowanceStartInstant,
				expiresAtEpochMilliseconds: AllowanceStartInstant + durationMilliseconds,
			};
			const allowanceFact = {
				scopeId: 'scope-a',
				...storedAllowance,
				allowanceDurationMilliseconds: durationMilliseconds,
			};

			expect( AllowanceDurationMillisecondsSchema.safeParse( durationMilliseconds ).success )
				.toBe( true );
			expect( ProtectionStateSchema.safeParse( allowanceState ).success ).toBe( true );
			expect( StoredProtectionAllowanceSchema.safeParse( storedAllowance ).success ).toBe( true );
			expect( AllowanceGrantedFactInputSchema.safeParse( allowanceFact ).success ).toBe( true );
		},
	);

	it.each( [
		{
			...createWaitingState(),
			confirmedFocusedDurationMilliseconds: 10_000,
		},
		{
			...createWaitingState(),
			confirmedFocusedDurationMilliseconds: 1_000,
			checkpointHighWaterMilliseconds: 1_001,
		},
		{
			...createWaitingState(),
			participants: [
				createNavigationParticipant(),
				createNavigationParticipant( 'participant-a', 'page-b', true, 1 ),
			],
		},
		{
			...createWaitingState(),
			participants: [
				createNavigationParticipant( 'participant-b', 'page-b', true, 0 ),
				createNavigationParticipant( 'participant-a', 'page-a', true, 0 ),
			],
			ownerParticipantId: 'participant-b',
		},
		{
			...createWaitingState(),
			ownerEpoch: 0,
		},
		{
			...createWaitingState(),
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			checkpointHighWaterMilliseconds: 1,
		},
		{
			...createWaitingState(),
			confirmedFocusedDurationMilliseconds: 1,
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			ownerEpoch: 1,
		},
	] )( 'rejects an inconsistent Waiting-state invariant', ( state ) => {
		expect( ProtectionStateSchema.safeParse( state ).success ).toBe( false );
	} );

	it( 'accepts recovered ownerless progress after a later owner epoch', () => {
		const state = {
			...createWaitingState(),
			confirmedFocusedDurationMilliseconds: 1_000,
			participants: [ createNavigationParticipant( 'participant-a', 'page-a', false ) ],
			ownerParticipantId: null,
			ownerEpoch: 2,
		};

		expect( ProtectionStateSchema.parse( state ) ).toStrictEqual( state );
	} );

	it( 'rejects allowance intervals and Ready identity collisions', () => {
		const allowance = createAllowanceState();

		expect( ProtectionStateSchema.safeParse( {
			...allowance,
			expiresAtEpochMilliseconds: allowance.startedAtEpochMilliseconds,
		} ).success ).toBe( false );
		expect( ProtectionStateSchema.safeParse( {
			...allowance,
			readyParticipants: [
				createNavigationParticipant(),
				createNavigationParticipant( 'participant-b', 'page-a', true, 1 ),
			],
		} ).success ).toBe( false );
	} );

	it( 'keeps stored participant-origin mappings exhaustive and rejects identity collisions', () => {
		expect( StoredProtectionParticipantOriginByProtectionParticipantOrigin ).toEqual( {
			[ ProtectionParticipantOrigin.NAVIGATION ]: StoredProtectionParticipantOrigin.NAVIGATION,
			[ ProtectionParticipantOrigin.ALLOWANCE_EXPIRY ]:
				StoredProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
		} );
		expect( ProtectionParticipantOriginByStoredProtectionParticipantOrigin ).toEqual( {
			[ StoredProtectionParticipantOrigin.NAVIGATION ]: ProtectionParticipantOrigin.NAVIGATION,
			[ StoredProtectionParticipantOrigin.ALLOWANCE_EXPIRY ]:
				ProtectionParticipantOrigin.ALLOWANCE_EXPIRY,
		} );

		const participant = Mock_StoredProtectionParticipant_Navigation;

		expect( StoredProtectionParticipantsSchema.safeParse( [
			participant,
			{ ...participant, pageId: 'page-b' },
		] ).success ).toBe( false );
		expect( StoredProtectionParticipantsSchema.safeParse( [
			participant,
			{ ...participant, participantId: 'participant-b' },
		] ).success ).toBe( false );
	} );

	it( 'enforces stored-state versions and allowance intervals', () => {
		expect( StoredDurableProtectionStateSchema.safeParse( {
			...Mock_StoredProtectionState_Durable,
			schemaVersion: 3,
		} ).success ).toBe( false );
		expect( StoredSessionProtectionStateSchema.safeParse( {
			...Mock_StoredProtectionState_Session,
			schemaVersion: 2,
		} ).success ).toBe( false );
		expect( StoredProtectionAllowanceSchema.safeParse( {
			allowanceId: 'allowance-a',
			startedAtEpochMilliseconds: 100,
			expiresAtEpochMilliseconds: 100,
		} ).success ).toBe( false );
	} );

	it( 'normalizes null-prototype stored scope records', () => {
		const durableScopes = { ...Mock_StoredProtectionState_Durable.scopes };
		Object.setPrototypeOf( durableScopes, null );
		const parsed = StoredDurableProtectionStateSchema.parse( {
			...Mock_StoredProtectionState_Durable,
			scopes: durableScopes,
		} );

		expect( parsed.scopes ).toStrictEqual( Mock_StoredProtectionState_Durable.scopes );
		expect( Object.getPrototypeOf( parsed.scopes ) ).toBe( Object.prototype );
	} );

	it( 'enforces timing order and freezes the default configuration', () => {
		expect( TimingConfigurationSchema.safeParse( {
			...DefaultTimingConfiguration,
			initialWaitMilliseconds: 60_000,
			maximumWaitMilliseconds: 10_000,
		} ).success ).toBe( false );
		expect( TimingConfigurationSchema.parse( DefaultTimingConfiguration ) )
			.toStrictEqual( DefaultTimingConfiguration );
		expect( Object.isFrozen( DefaultTimingConfiguration ) ).toBe( true );
	} );
} );
