import { expect, it } from 'vitest';
import { createRuntimeHarness, createActiveStatisticsDocument, reconcileRuntime } from './__fixtures__';

it( 'reads detached committed history without checkpointing or ending active measurements', async () => {
	const source = createActiveStatisticsDocument();
	const harness = createRuntimeHarness( undefined, source );
	await reconcileRuntime( harness.runtime );
	const trace = [ ...harness.trace ];
	const first = await harness.runtime.readBackupDocument();
	expect( first?.scopes.scope_default?.activeAllowance ).toBeDefined();
	if ( ! first ) {
		throw new Error( 'Expected historical snapshot.' );
	}
	first.dailyTotals.length = 0;
	first.scopes = {};
	const second = await harness.runtime.readBackupDocument();
	expect( second?.scopes.scope_default?.activeAllowance ).toBeDefined();
	expect( harness.trace.slice( trace.length ) ).toEqual( [] );
} );

it( 'does not turn unavailable historical persistence into an empty successful backup', async () => {
	const harness = createRuntimeHarness( undefined, null );
	await expect( harness.runtime.readBackupDocument() ).resolves.toBeNull();
} );
