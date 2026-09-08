import { StatisticsProjectionStatus } from '../../../../domains/statistics/types/statistics-projection';
import { describe, expect, it, vi } from 'vitest';
import { createPrivacyDataActions } from './index';

describe( 'privacy data actions', () => {
	it( 'sends a full-reset request only when its action is invoked', async () => {
		const runtime = { sendMessage: vi.fn().mockResolvedValue( true ) };
		const actions = createPrivacyDataActions( { runtime } );
		expect( runtime.sendMessage ).not.toHaveBeenCalled();
		await expect( actions.resetAllData() ).resolves.toBe( true );
		expect( runtime.sendMessage ).toHaveBeenCalledWith( { type: 'reset-all-data' } );
	} );

	it.each( [ false, null, 'true', {} ] )( 'rejects unsuccessful or malformed reset response %j', async ( response ) => {
		const runtime = { sendMessage: vi.fn().mockResolvedValue( response ) };
		await expect( createPrivacyDataActions( { runtime } ).resetAllData() ).resolves.toBe( false );
	} );

	it( 'keeps full reset retryable after messaging failure', async () => {
		const runtime = { sendMessage: vi.fn().mockRejectedValueOnce( new Error( 'offline' ) ).mockResolvedValue( true ) };
		const actions = createPrivacyDataActions( { runtime } );
		await expect( actions.resetAllData() ).resolves.toBe( false );
		await expect( actions.resetAllData() ).resolves.toBe( true );
	} );

	it( 'uses the existing statistics authority without requesting full deletion', async () => {
		const runtime = {
			sendMessage: vi.fn().mockResolvedValue( { status: StatisticsProjectionStatus.UNAVAILABLE } ),
		};
		await expect( createPrivacyDataActions( { runtime } ).resetStatistics() ).resolves.toBe( false );
		expect( runtime.sendMessage ).toHaveBeenCalledWith( { type: 'reset-statistics' } );
	} );
} );
