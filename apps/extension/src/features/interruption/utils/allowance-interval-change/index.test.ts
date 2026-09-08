import { StoredProtectionStatisticsDeliveryStatus } from '../../../../domains/protection/types/stored-protection-statistics-delivery';
import { describe, expect, it } from 'vitest';
import { createAllowanceStorageEnvelope } from './__fixtures__';
import { hasAllowanceIntervalChange } from './index';

/**
 * Running allowance whose three interval fields are independently observable.
 * @since 0.1.0 Initial implementation.
 */
const RUNNING_ALLOWANCE = {
	allowanceId: 'allowance-a',
	startedAtEpochMilliseconds: 600_000,
	expiresAtEpochMilliseconds: 900_000,
};

describe( 'hasAllowanceIntervalChange', () => {
	it.each( [
		{ allowanceId: 'allowance-b' },
		{ startedAtEpochMilliseconds: 660_000 },
		{ expiresAtEpochMilliseconds: 960_000 },
	] )( 'detects each change to a durable running interval', ( change ) => {
		expect( hasAllowanceIntervalChange(
			createAllowanceStorageEnvelope( RUNNING_ALLOWANCE ),
			createAllowanceStorageEnvelope( { ...RUNNING_ALLOWANCE, ...change } ),
		) ).toBe( true );
	} );

	it( 'detects interval creation, expiry removal, and durable storage removal', () => {
		const running = createAllowanceStorageEnvelope( RUNNING_ALLOWANCE );
		const pending = createAllowanceStorageEnvelope();
		expect( hasAllowanceIntervalChange( pending, running ) ).toBe( true );
		expect( hasAllowanceIntervalChange( running, pending ) ).toBe( true );
		expect( hasAllowanceIntervalChange( undefined, running ) ).toBe( true );
		expect( hasAllowanceIntervalChange( running, undefined ) ).toBe( true );
	} );

	it( 'ignores snapshot, ladder, and statistics changes with identical allowance intervals', () => {
		const original = createAllowanceStorageEnvelope( RUNNING_ALLOWANCE );
		const updated = {
			...original,
			snapshotId: '00000000-0000-4000-8000-000000000002',
			document: {
				schemaVersion: 2,
				statisticsDelivery: { status: StoredProtectionStatisticsDeliveryStatus.INCOMPLETE, outbox: [] },
				scopes: {
					'scope-default': {
						ladder: { completedWaits: 2, greatestObservedLocalDate: '2026-09-06' },
						allowance: RUNNING_ALLOWANCE,
					},
					'scope-other': { ladder: { completedWaits: 0, greatestObservedLocalDate: '2026-09-06' } },
				},
			},
		};
		expect( hasAllowanceIntervalChange( original, updated ) ).toBe( false );
		expect( hasAllowanceIntervalChange( undefined, createAllowanceStorageEnvelope() ) ).toBe( false );
	} );

	it( 'detects a running allowance moving to another scope', () => {
		const original = createAllowanceStorageEnvelope( RUNNING_ALLOWANCE );
		const updated = {
			...original,
			document: {
				schemaVersion: 2,
				statisticsDelivery: { status: StoredProtectionStatisticsDeliveryStatus.COMPLETE, outbox: [] },
				scopes: { 'scope-other': {
					ladder: { completedWaits: 1, greatestObservedLocalDate: '2026-09-05' },
					allowance: RUNNING_ALLOWANCE,
				} },
			},
		};
		expect( hasAllowanceIntervalChange( original, updated ) ).toBe( true );
	} );

	it.each( [ null, {}, { snapshotId: '00000000-0000-4000-8000-000000000001', document: {} } ] )(
		'ignores malformed storage rather than creating synchronization traffic',
		( malformed ) => {
			const running = createAllowanceStorageEnvelope( RUNNING_ALLOWANCE );
			expect( hasAllowanceIntervalChange( malformed, running ) ).toBe( false );
			expect( hasAllowanceIntervalChange( running, malformed ) ).toBe( false );
		},
	);
} );
