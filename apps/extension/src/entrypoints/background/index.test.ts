import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { TestInstant } from '../../domains/protection/types/__fixtures__/protection-event';

const backgroundMocks = vi.hoisted( () => ( {
	createProtectionCoordinator: vi.fn(),
	createProtectionStorageService: vi.fn(),
	initialize: vi.fn(),
} ) );

vi.mock( 'wxt/browser', async () => {
	const { fakeBrowser: mockedBrowser } = await import( 'wxt/testing/fake-browser' );

	return { browser: mockedBrowser };
} );

vi.mock( '../../domains/protection', () => ( {
	createProtectionCoordinator: backgroundMocks.createProtectionCoordinator,
	createProtectionStorageService: backgroundMocks.createProtectionStorageService,
} ) );

import backgroundDefinition from './index';

describe( 'protection background entrypoint', () => {
	beforeEach( () => {
		fakeBrowser.reset();
		vi.clearAllMocks();
		vi.spyOn( Date, 'now' ).mockReturnValue( TestInstant );
	} );

	afterEach( () => {
		vi.restoreAllMocks();
	} );

	it( 'starts one coordinator with local and session storage', () => {
		const storage = {
			load: vi.fn(),
			save: vi.fn(),
		};
		const coordinator = {
			dispatch: vi.fn(),
			initialize: backgroundMocks.initialize,
		};

		backgroundMocks.createProtectionStorageService.mockReturnValue( storage );
		backgroundMocks.createProtectionCoordinator.mockReturnValue( coordinator );

		const runBackground: () => unknown = backgroundDefinition.main.bind( backgroundDefinition );
		const mainResult = runBackground();

		expect( mainResult ).toBeUndefined();
		expect( backgroundMocks.createProtectionStorageService ).toHaveBeenCalledOnce();
		expect( backgroundMocks.createProtectionCoordinator ).toHaveBeenCalledOnce();

		const storageOptions: unknown = backgroundMocks.createProtectionStorageService.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof storageOptions !== 'object' ||
			storageOptions === null ||
			! ( 'durableArea' in storageOptions ) ||
			! ( 'sessionArea' in storageOptions ) ||
			! ( 'createSnapshotId' in storageOptions )
		) {
			throw new TypeError( 'Expected complete protection storage options.' );
		}

		expect( storageOptions.durableArea ).toBe( fakeBrowser.storage.local );
		expect( storageOptions.sessionArea ).toBe( fakeBrowser.storage.session );
		expect( typeof storageOptions.createSnapshotId ).toBe( 'function' );

		const coordinatorOptions: unknown = backgroundMocks.createProtectionCoordinator.mock.calls[ 0 ]?.[ 0 ];

		if (
			typeof coordinatorOptions !== 'object' ||
			coordinatorOptions === null ||
			! ( 'storage' in coordinatorOptions ) ||
			! ( 'createSessionContinuityId' in coordinatorOptions )
		) {
			throw new TypeError( 'Expected complete protection coordinator options.' );
		}

		expect( coordinatorOptions.storage ).toBe( storage );
		expect( typeof coordinatorOptions.createSessionContinuityId ).toBe( 'function' );
		expect( backgroundMocks.initialize ).toHaveBeenCalledOnce();
		expect( backgroundMocks.initialize ).toHaveBeenCalledWith( {
			nowEpochMilliseconds: TestInstant,
			readyObservations: [],
		} );
	} );
} );
