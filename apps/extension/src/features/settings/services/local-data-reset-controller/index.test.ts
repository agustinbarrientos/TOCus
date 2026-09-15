import { describe, expect, it, vi } from 'vitest';
import { createLocalDataResetController } from './index';
import { LocalDataGenerationStorageKey } from '../../../../domains/local-data/services/local-data-generation';
import type { ProtectionBackgroundMessageListener, ProtectionBackgroundMessageSender } from '../../../protection-runtime/services/protection-background-controller';

/**
 * Creates an isolated background reset boundary with observable message ownership.
 * @return Controller dependencies and message dispatch helper.
 * @since 0.1.0 Initial implementation.
 */
function createFixture() {
	let listener: ProtectionBackgroundMessageListener | undefined;
	const values: Record<string, unknown> = {};
	const options = {
		optionsPageUrl: 'chrome-extension://test/options.html',
		localArea: {
			get: vi.fn( ( key: string ) => Promise.resolve( { [ key ]: values[ key ] } ) ),
			set: vi.fn( ( update: Record<string, unknown> ) => {
				Object.assign( values, update );
				return Promise.resolve();
			} ),
			remove: vi.fn().mockResolvedValue( undefined ),
		},
		reset: { reset: vi.fn().mockResolvedValue( true ), recover: vi.fn().mockResolvedValue( true ) },
		onMessage: { addListener: vi.fn( ( handler: ProtectionBackgroundMessageListener ) => {
			listener = handler;
		} ) },
		resume: vi.fn().mockResolvedValue( undefined ),
		openOnboarding: vi.fn().mockResolvedValue( undefined ),
		closeSettingsTab: vi.fn<( tabId: number ) => Promise<void>>().mockResolvedValue( undefined ),
	};
	const controller = createLocalDataResetController( options );
	/**
	 * Dispatches one synthetic browser-authenticated reset message.
	 * @param sender - Sender metadata supplied by the browser.
	 * @param input - Unknown message payload.
	 * @return Listener ownership and response boundary.
	 * @since 0.1.0 Initial implementation.
	 */
	function send( sender: ProtectionBackgroundMessageSender = {
		url: `${ options.optionsPageUrl }#privacy`, frameId: 0, tab: { id: 7, incognito: false },
	}, input: unknown = { type: 'reset-all-data' } ) {
		const response = vi.fn();
		return { claimed: listener?.( input, sender, response ), response };
	}
	return { controller, options, values, send };
}

describe( 'local data reset controller', () => {
	it( 'reports not ready before listener registration', async () => {
		const { controller, options } = createFixture();
		await expect( controller.waitUntilReady() ).resolves.toBe( false );
		expect( options.onMessage.addListener ).not.toHaveBeenCalled();
		expect( options.reset.recover ).not.toHaveBeenCalled();
	} );

	it( 'keeps a failed explicit reset retryable when its authority rejects', async () => {
		const { controller, options, send } = createFixture();
		options.reset.reset.mockRejectedValueOnce( new Error( 'unavailable' ) );
		controller.start();
		await controller.waitUntilReady();
		const failed = send();
		await vi.waitFor( () => {
			expect( failed.response ).toHaveBeenCalledWith( false );
		} );
		const retry = send();
		await vi.waitFor( () => {
			expect( retry.response ).toHaveBeenCalledWith( true );
		} );
	} );
	it( 'registers synchronously and resumes only after recovery succeeds', async () => {
		const { controller, options } = createFixture();
		const recovery = Promise.withResolvers<boolean>();
		options.reset.recover.mockReturnValue( recovery.promise );
		controller.start();
		controller.start();
		expect( options.onMessage.addListener ).toHaveBeenCalledTimes( 1 );
		expect( options.resume ).not.toHaveBeenCalled();
		recovery.resolve( true );
		await expect( controller.waitUntilReady() ).resolves.toBe( true );
		expect( options.resume ).toHaveBeenCalledTimes( 1 );
	} );

	it.each( [ false, new Error( 'unavailable' ) ] )( 'leaves protection suspended after recovery failure', async ( outcome ) => {
		const { controller, options } = createFixture();
		if ( outcome instanceof Error ) {
			options.reset.recover.mockRejectedValue( outcome );
		} else {
			options.reset.recover.mockResolvedValue( outcome );
		}
		controller.start();
		await expect( controller.waitUntilReady() ).resolves.toBe( false );
		expect( options.resume ).not.toHaveBeenCalled();
	} );

	it( 'ignores other pages, frames, query strings, and malformed messages', () => {
		const { controller, send, options } = createFixture();
		controller.start();
		expect( send( { url: 'https://example.com/options.html', frameId: 0 } ).claimed ).toBeUndefined();
		expect( send( { url: options.optionsPageUrl, frameId: 1 } ).claimed ).toBeUndefined();
		expect( send( { url: `${ options.optionsPageUrl }?from=site`, frameId: 0 } ).claimed ).toBeUndefined();
		expect( send( undefined, { type: 'reset-all-data', extra: true } ).claimed ).toBeUndefined();
		expect( options.reset.reset ).not.toHaveBeenCalled();
	} );

	it( 'owns confirmed reset even if its settings page disappears', async () => {
		const { controller, options, send } = createFixture();
		controller.start();
		await controller.waitUntilReady();
		const { claimed, response } = send();
		response.mockImplementation( () => {
			throw new Error( 'page closed' );
		} );
		expect( claimed ).toBe( true );
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( true );
		} );
		expect( options.reset.reset ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'closes only the originating settings tab after onboarding and its marker are complete', async () => {
		const { controller, options, values, send } = createFixture();
		controller.start();
		await controller.waitUntilReady();
		values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: false, needsOnboarding: true };
		const deletion = Promise.withResolvers<boolean>();
		const onboarding = Promise.withResolvers<undefined>();
		const marker = Promise.withResolvers<undefined>();
		options.reset.reset.mockReturnValueOnce( deletion.promise );
		options.openOnboarding.mockReturnValueOnce( onboarding.promise );
		options.localArea.set.mockReturnValueOnce( marker.promise );
		const first = send();
		const second = send( { url: options.optionsPageUrl, frameId: 0, tab: { id: 8, incognito: false } } );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
		deletion.resolve( true );
		await vi.waitFor( () => {
			expect( options.openOnboarding ).toHaveBeenCalledOnce();
		} );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
		onboarding.resolve( undefined );
		await vi.waitFor( () => {
			expect( options.localArea.set ).toHaveBeenCalledWith( {
				[ LocalDataGenerationStorageKey ]: { generation: 'reset', pending: false, needsOnboarding: false },
			} );
		} );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
		marker.resolve( undefined );
		await vi.waitFor( () => {
			expect( first.response ).toHaveBeenCalledWith( true );
		} );
		expect( second.response ).toHaveBeenCalledWith( true );
		expect( options.reset.reset ).toHaveBeenCalledOnce();
		expect( options.closeSettingsTab ).toHaveBeenCalledExactlyOnceWith( 7 );
	} );

	it( 'reopens onboarding during startup recovery without closing settings', async () => {
		const { controller, options, values } = createFixture();
		values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: false, needsOnboarding: true };
		controller.start();
		await expect( controller.waitUntilReady() ).resolves.toBe( true );
		expect( options.openOnboarding ).toHaveBeenCalledOnce();
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
	} );

	it.each( [ undefined, {} ] )( 'completes reset without closing a tab when sender identity is absent: %j', async ( tab ) => {
		const { controller, options, send } = createFixture();
		controller.start();
		await controller.waitUntilReady();
		const { response } = send( { url: options.optionsPageUrl, frameId: 0, tab } );
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( true );
		} );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
	} );

	it.each( [ false, new Error( 'reset unavailable' ) ] )( 'keeps settings open after unsuccessful deletion: %j', async ( outcome ) => {
		const { controller, options, send } = createFixture();
		controller.start();
		await controller.waitUntilReady();
		if ( outcome instanceof Error ) {
			options.reset.reset.mockRejectedValueOnce( outcome );
		} else {
			options.reset.reset.mockResolvedValueOnce( outcome );
		}
		const { response } = send();
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( false );
		} );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
	} );

	it( 'keeps settings open when onboarding cannot open', async () => {
		const { controller, options, values, send } = createFixture();
		controller.start();
		await controller.waitUntilReady();
		values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: false, needsOnboarding: true };
		options.openOnboarding.mockRejectedValueOnce( new Error( 'tabs unavailable' ) );
		const { response } = send();
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( false );
		} );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
		expect( values[ LocalDataGenerationStorageKey ] ).toHaveProperty( 'needsOnboarding', true );
	} );

	it( 'keeps settings open when onboarding completion cannot be persisted', async () => {
		const { controller, options, values, send } = createFixture();
		controller.start();
		await controller.waitUntilReady();
		values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: false, needsOnboarding: true };
		options.localArea.set.mockRejectedValueOnce( new Error( 'storage unavailable' ) );
		const { response } = send();
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( false );
		} );
		expect( options.closeSettingsTab ).not.toHaveBeenCalled();
	} );

	it( 'coalesces repeated requests while deletion is pending', async () => {
		const { controller, options, send } = createFixture();
		const completion = Promise.withResolvers<boolean>();
		options.reset.reset.mockReturnValue( completion.promise );
		controller.start();
		await controller.waitUntilReady();
		const first = send();
		const second = send();
		completion.resolve( false );
		await vi.waitFor( () => {
			expect( second.response ).toHaveBeenCalledWith( false );
		} );
		expect( first.response ).toHaveBeenCalledWith( false );
		expect( options.reset.reset ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'honors a new deletion request after an earlier onboarding launch failed', async () => {
		const { controller, options, values, send } = createFixture();
		values[ LocalDataGenerationStorageKey ] = { generation: 'reset', pending: false, needsOnboarding: true };
		options.openOnboarding.mockRejectedValueOnce( new Error( 'tabs unavailable' ) );
		controller.start();
		await expect( controller.waitUntilReady() ).resolves.toBe( false );
		const { response } = send();
		await vi.waitFor( () => {
			expect( response ).toHaveBeenCalledWith( true );
		} );
		expect( options.reset.reset ).toHaveBeenCalledTimes( 1 );
		expect( values[ LocalDataGenerationStorageKey ] ).toHaveProperty( 'needsOnboarding', false );
	} );
} );
