import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserProtectionConfigurationEditor, type BrowserProtectionConfigurationMutationLock } from '../../../../domains/protection/services/browser-protection-configuration-editor';
import { ProtectionConfigurationStorageKey } from '../../../../domains/protection/services/protection-configuration-storage';
import { createProtectedSiteEnrollmentService, ProtectedSiteEnrollmentStatus } from '../../../protected-sites/services/protected-site-enrollment';
import { createSitePermissionManager } from '../../../protected-sites/services/site-permission-manager';
import { PopupSiteEnrollmentRequestType } from '../../types/site-enrollment';
import { createPopupEnrollmentController } from './index';
import { type PopupEnrollmentMessageListener } from './types';

const POPUP_PAGE_URL = 'chrome-extension://extension-id/popup.html';
const REQUEST = {
	type: PopupSiteEnrollmentRequestType,
	siteInput: 'https://github.com/agustinbarrientos/TOCus',
	independent: false,
};

/**
 * Creates the real enrollment stack with browser storage and native consent boundaries.
 * @return Background controller, pending consent, persisted state, and message delivery.
 * @since 0.1.0 Initial implementation.
 */
function createHarness() {
	const values: Record<string, unknown> = {};
	const consent = Promise.withResolvers<boolean>();
	let granted = false;
	let listener: PopupEnrollmentMessageListener | null = null;
	const set = vi.fn( ( input: Record<string, unknown> ) => {
		Object.assign( values, input );
		return Promise.resolve();
	} );
	const area = {
		get: vi.fn( () => Promise.resolve( { ...values } ) ),
		set,
	};
	const request = vi.fn( async () => {
		granted = await consent.promise;
		return granted;
	} );
	const permissions = {
		contains: vi.fn( () => Promise.resolve( granted ) ),
		request,
		remove: vi.fn().mockResolvedValue( true ),
		getAll: vi.fn().mockResolvedValue( { permissions: [], origins: [] } ),
	};
	const protection = createBrowserProtectionConfigurationEditor( {
		area,
		cryptography: crypto,
		locks: { request: vi.fn<BrowserProtectionConfigurationMutationLock['request']>( ( _name, mutation ) => mutation() ) },
	} );
	const enrollment = createProtectedSiteEnrollmentService( {
		editor: protection.editor,
		permissionManager: createSitePermissionManager( { permissions } ),
	} );
	const add = vi.spyOn( enrollment, 'add' );
	const controller = createPopupEnrollmentController( {
		enrollment,
		popupPageUrl: POPUP_PAGE_URL,
		runtime: {
			onMessage: {
				/**
				 * Captures the background-owned listener before messages are delivered.
				 * @param candidate - Runtime listener registered by the controller.
				 * @since 0.1.0 Initial implementation.
				 */
				addListener: ( candidate ) => {
					listener = candidate;
				},
			},
		},
	} );
	controller.start();

	return {
		add,
		consent,
		permissions,
		protection,
		request,
		set,
		values,
		/**
		 * Delivers a local runtime message to the background-owned listener.
		 * @param input - Unknown request payload.
		 * @param sender - Browser-authenticated sender URL.
		 * @param respond - Response callback that may outlive the popup.
		 * @return Whether the controller owns the asynchronous response.
		 * @since 0.1.0 Initial implementation.
		 */
		deliver( input: unknown = REQUEST, sender = { url: POPUP_PAGE_URL }, respond = vi.fn() ) {
			if ( listener === null ) {
				throw new Error( 'Expected a synchronously registered enrollment listener.' );
			}
			return listener( input, sender, respond );
		},
	};
}

describe( 'createPopupEnrollmentController', () => {
	beforeEach( () => {
		vi.clearAllMocks();
	} );

	it( 'starts the native permission request before yielding the message gesture', () => {
		const harness = createHarness();
		expect( harness.deliver() ).toBe( true );
		expect( harness.request ).toHaveBeenCalledExactlyOnceWith( {
			permissions: [ 'webNavigation' ],
			origins: [ '*://*.github.com/*' ],
		} );
		expect( harness.set ).not.toHaveBeenCalled();
	} );

	it( 'saves GitHub once after consent even when the popup response channel is destroyed', async () => {
		const harness = createHarness();
		const respond = vi.fn( () => {
			throw new Error( 'Popup closed.' );
		} );
		harness.deliver( REQUEST, { url: POPUP_PAGE_URL }, respond );
		harness.consent.resolve( true );
		await vi.waitFor( () => {
			expect( respond ).toHaveBeenCalledOnce();
		} );
		const configuration = await harness.protection.storage.load();
		expect( configuration?.sites ).toHaveLength( 1 );
		expect( configuration?.sites[ 0 ]?.rule.host ).toBe( 'github.com' );
		expect( harness.set ).toHaveBeenCalledOnce();
		expect( respond ).toHaveBeenCalledWith( { status: ProtectedSiteEnrollmentStatus.ADDED } );
	} );

	it( 'does not save a denied request after the popup closes or a later permission grant occurs', async () => {
		const harness = createHarness();
		const respond = vi.fn( () => {
			throw new Error( 'Popup closed.' );
		} );
		harness.deliver( REQUEST, { url: POPUP_PAGE_URL }, respond );
		harness.consent.resolve( false );
		await vi.waitFor( () => {
			expect( respond ).toHaveBeenCalledOnce();
		} );
		harness.permissions.contains.mockResolvedValue( true );
		await Promise.resolve();
		expect( harness.values[ ProtectionConfigurationStorageKey.CONFIGURATION ] ).toBeUndefined();
		expect( harness.set ).not.toHaveBeenCalled();
		expect( respond ).toHaveBeenCalledWith( { status: ProtectedSiteEnrollmentStatus.PERMISSION_DENIED } );
	} );

	it( 'preserves permission errors without creating a website', async () => {
		const harness = createHarness();
		const respond = vi.fn();
		harness.deliver( REQUEST, { url: POPUP_PAGE_URL }, respond );
		harness.consent.reject( new Error( 'Native permission request failed.' ) );
		await vi.waitFor( () => {
			expect( respond ).toHaveBeenCalledWith( { status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR } );
		} );
		expect( harness.set ).not.toHaveBeenCalled();
	} );

	it( 'returns domain rejections without requesting browser access', async () => {
		const harness = createHarness();
		const respond = vi.fn();
		harness.deliver( { ...REQUEST, siteInput: 'not a website' }, { url: POPUP_PAGE_URL }, respond );
		await vi.waitFor( () => {
			expect( respond ).toHaveBeenCalledWith( { status: 'rejected', reason: 'invalid-site' } );
		} );
		expect( harness.request ).not.toHaveBeenCalled();
	} );

	it( 'rechecks browser access inside the coordinated save', async () => {
		const harness = createHarness();
		const respond = vi.fn();
		harness.permissions.contains.mockResolvedValue( false );
		harness.deliver( REQUEST, { url: POPUP_PAGE_URL }, respond );
		harness.consent.resolve( true );
		await vi.waitFor( () => {
			expect( respond ).toHaveBeenCalledWith( { status: ProtectedSiteEnrollmentStatus.PERMISSION_ERROR } );
		} );
		expect( harness.set ).not.toHaveBeenCalled();
	} );

	it( 'reports an unexpected enrollment failure without exposing internal details', async () => {
		const harness = createHarness();
		const respond = vi.fn();
		harness.add.mockRejectedValue( new Error( 'Storage unavailable.' ) );
		harness.deliver( REQUEST, { url: POPUP_PAGE_URL }, respond );
		await vi.waitFor( () => {
			expect( respond ).toHaveBeenCalledWith( { status: ProtectedSiteEnrollmentStatus.SAVE_ERROR } );
		} );
	} );

	it.each( [
		[ REQUEST, { url: 'https://github.com/' } ],
		[ REQUEST, { url: `${ POPUP_PAGE_URL }#unexpected` } ],
		[ REQUEST, { url: '' } ],
		[ { ...REQUEST, independent: 'false' }, { url: POPUP_PAGE_URL } ],
		[ { ...REQUEST, extra: true }, { url: POPUP_PAGE_URL } ],
		[ { type: 'read-popup-status', currentTab: null }, { url: POPUP_PAGE_URL } ],
	] )( 'ignores invalid or unauthenticated additions', ( input, sender ) => {
		const harness = createHarness();
		expect( harness.deliver( input, sender ) ).toBeUndefined();
		expect( harness.add ).not.toHaveBeenCalled();
		expect( harness.request ).not.toHaveBeenCalled();
	} );
} );
