import { describe, expect, it, vi } from 'vitest';
import {
	StatisticsProjectionStatus,
	type StatisticsProjection,
} from '../../../../domains/statistics/types/statistics-projection';
import { StatisticsRuntimeRequestType } from '../../../statistics/types/runtime-message';
import {
	INTERRUPTION_PAGE_URL,
	OPTIONS_PAGE_URL,
	createHarness,
} from './__fixtures__';

describe( 'createProtectionBackgroundController statistics messages', () => {
	it( 'serves statistics from the exact options page after denied navigation startup', async () => {
		const harness = createHarness( false, false );
		const response: StatisticsProjection = {
			status: StatisticsProjectionStatus.AVAILABLE,
			estimatedReclaimedMilliseconds: 120_000,
			focusedPauseMilliseconds: 8_000,
			reconsideredVisitCount: 3,
			completedWaitCount: 2,
			allowanceGrantedCount: 2,
		};
		const readResponse = vi.fn();
		const resetResponse = vi.fn();

		harness.readStatistics.mockResolvedValue( response );
		harness.resetStatistics.mockResolvedValue( {
			...response,
			estimatedReclaimedMilliseconds: null,
			focusedPauseMilliseconds: 0,
			reconsideredVisitCount: 0,
			completedWaitCount: 0,
			allowanceGrantedCount: 0,
		} );
		harness.controller.start();

		expect( harness.message.emit( {
			type: StatisticsRuntimeRequestType.READ_STATISTICS,
		}, {
			frameId: 0,
			url: `${ OPTIONS_PAGE_URL }#statistics`,
		}, readResponse ) ).toBe( true );
		expect( harness.message.emit( {
			type: StatisticsRuntimeRequestType.RESET_STATISTICS,
		}, {
			frameId: 0,
			url: OPTIONS_PAGE_URL,
		}, resetResponse ) ).toBe( true );

		await vi.waitFor( () => {
			expect( readResponse ).toHaveBeenCalledWith( response );
			expect( resetResponse ).toHaveBeenCalledWith( expect.objectContaining( {
				status: StatisticsProjectionStatus.AVAILABLE,
				reconsideredVisitCount: 0,
			} ) );
		} );
		expect( harness.readStatistics ).toHaveBeenCalledOnce();
		expect( harness.resetStatistics ).toHaveBeenCalledOnce();
		expect( harness.failOpen ).toHaveBeenCalledOnce();
	} );

	it.each( [
		'prepare-scope-statistics-deletion',
		'cancel-scope-statistics-deletion',
		'delete-scope-statistics',
	] )( 'ignores the removed %s command', ( type ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type,
			scopeId: 'scope_example',
		}, {
			frameId: 0,
			url: OPTIONS_PAGE_URL,
		}, sendResponse ) ).toBeUndefined();
		expect( sendResponse ).not.toHaveBeenCalled();
	} );

	it.each( [
		[ 'an interruption page', { frameId: 0, tab: { id: 7 }, url: INTERRUPTION_PAGE_URL } ],
		[ 'a protected page', { frameId: 0, tab: { id: 7 }, url: 'https://example.com/' } ],
	] )( 'allows read-only statistics from %s', async ( _label, sender ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type: StatisticsRuntimeRequestType.READ_STATISTICS,
		}, sender, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( harness.readStatistics ).toHaveBeenCalledOnce();
			expect( sendResponse ).toHaveBeenCalledWith( {
				status: StatisticsProjectionStatus.UNAVAILABLE,
			} );
		} );
	} );

	it.each( [
		[ 'an interruption page', { frameId: 0, tab: { id: 7 }, url: INTERRUPTION_PAGE_URL } ],
		[ 'an options iframe', { frameId: 2, url: OPTIONS_PAGE_URL } ],
		[ 'another extension', { frameId: 0, url: 'chrome-extension://another/options.html' } ],
		[ 'a malformed URL', { frameId: 0, url: 'not a URL' } ],
	] )( 'rejects statistics reset from %s', ( _label, sender ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type: StatisticsRuntimeRequestType.RESET_STATISTICS,
		}, sender, sendResponse ) ).toBeUndefined();
		expect( harness.resetStatistics ).not.toHaveBeenCalled();
		expect( sendResponse ).not.toHaveBeenCalled();
	} );

	it( 'contains statistics failures without weakening browser protection', async () => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();
		await vi.waitFor( () => {
			expect( harness.start ).toHaveBeenCalledOnce();
		} );
		harness.failOpen.mockClear();
		harness.readStatistics.mockRejectedValue( new Error( 'Statistics unavailable.' ) );

		expect( harness.message.emit( {
			type: StatisticsRuntimeRequestType.READ_STATISTICS,
		}, {
			frameId: 0,
			url: OPTIONS_PAGE_URL,
		}, sendResponse ) ).toBe( true );
		await vi.waitFor( () => {
			expect( sendResponse ).toHaveBeenCalledWith( {
				status: StatisticsProjectionStatus.UNAVAILABLE,
			} );
		} );
		expect( harness.failOpen ).not.toHaveBeenCalled();
	} );

	it( 'ignores malformed statistics requests from the options page', () => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.controller.start();

		expect( harness.message.emit( {
			type: StatisticsRuntimeRequestType.READ_STATISTICS,
			unexpected: true,
		}, {
			frameId: 0,
			url: OPTIONS_PAGE_URL,
		}, sendResponse ) ).toBeUndefined();
		expect( harness.readStatistics ).not.toHaveBeenCalled();
		expect( sendResponse ).not.toHaveBeenCalled();
	} );
} );
