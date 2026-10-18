import { expect, it } from 'vitest';
import { createStatisticsRuntime } from './index';
import { createRuntimeHarness, reconcileRuntime } from './__fixtures__';

it( 'starts empty default-enabled breakdown coverage without inventing older detail', async () => {
	const harness = createRuntimeHarness();
	const before = await harness.storage.load();
	await reconcileRuntime( harness.runtime );
	const saved = await harness.storage.load();
	expect( saved?.visitOutcomes ).toEqual( {
		recordedFromDate: harness.options.getLocalDate(), dailySites: [], dailyHours: [],
	} );
	expect( saved?.scopes.scope_default?.totals ).toEqual( before?.scopes.scope_default?.totals );
	const coverage = saved?.visitOutcomes;
	harness.clock.nowEpochMilliseconds += 86_400_000;
	await reconcileRuntime( harness.runtime );
	expect( ( await harness.storage.load() )?.visitOutcomes ).toEqual( coverage );
	const restarted = createStatisticsRuntime( harness.options );
	await reconcileRuntime( restarted );
	expect( ( await harness.storage.load() )?.visitOutcomes ).toEqual( coverage );
} );

it( 'starts fresh coverage on reset and clears every old website and hourly bucket', async () => {
	const harness = createRuntimeHarness();
	await reconcileRuntime( harness.runtime );
	harness.clock.nowEpochMilliseconds += 86_400_000;
	await expect( harness.runtime.reset() ).resolves.toBe( true );
	expect( ( await harness.storage.load() )?.visitOutcomes ).toEqual( {
		recordedFromDate: harness.options.getLocalDate(), dailySites: [], dailyHours: [],
	} );
} );

it( 'starts empty coverage when recovering unavailable statistics through reset', async () => {
	const harness = createRuntimeHarness( undefined, null );
	await reconcileRuntime( harness.runtime );
	await expect( harness.runtime.reset() ).resolves.toBe( true );
	expect( ( await harness.storage.load() )?.visitOutcomes?.recordedFromDate ).toBe( harness.options.getLocalDate() );
} );

it( 'defers coverage when the clock is unavailable and persists it after recovery', async () => {
	const harness = createRuntimeHarness();
	harness.clock.failure = new Error( 'Clock unavailable' );
	await reconcileRuntime( harness.runtime );
	expect( ( await harness.storage.load() )?.visitOutcomes ).toBeUndefined();
	harness.clock.failure = null;
	await reconcileRuntime( harness.runtime );
	expect( ( await harness.storage.load() )?.visitOutcomes?.recordedFromDate ).toBe( harness.options.getLocalDate() );
} );

it( 'contains a failed deferred-coverage write without overwriting older totals', async () => {
	const harness = createRuntimeHarness();
	harness.clock.failure = new Error( 'Clock unavailable' );
	await reconcileRuntime( harness.runtime );
	harness.clock.failure = null;
	harness.storage.saveFailure = new Error( 'Storage unavailable' );
	await reconcileRuntime( harness.runtime );
	expect( harness.runtime.getSnapshot().projection ).toEqual( { status: 'unavailable' } );
	expect( ( await harness.storage.load() )?.visitOutcomes ).toBeUndefined();
} );
