import { describe, expect, it, vi } from 'vitest';
import { createBackupFixture } from '../../../../domains/local-data/services/local-data-backup/__fixtures__';
import { SitePermissionRequestStatus } from '../../../protected-sites/services/site-permission-manager';
import type { PrivacyDataRuntime } from '../../../settings/services/privacy-data-actions/types';
import { createOnboardingBackupActions } from '.';

describe( 'onboarding backup actions', () => {
	it( 'previews without writes and restores after synchronous denied consent', async () => {
		const fixture = createBackupFixture();
		const permissions = {
			requestMany: vi.fn().mockResolvedValue( { status: SitePermissionRequestStatus.DENIED } ),
			hasAccess: vi.fn().mockResolvedValue( false ),
		};
		const actions = createOnboardingBackupActions( {
			runtime: { sendMessage: vi.fn<PrivacyDataRuntime[ 'sendMessage' ]>( ( request ) =>
				request.type === 'read-local-backup-state'
					? Promise.resolve( { status: 'ready', generation: null } ) : fixture.backup.import( request ) ) },
			permissions, createId: vi.fn().mockReturnValue( 'import_1' ),
			onImported: vi.fn().mockResolvedValue( undefined ), getProtectedSites: vi.fn().mockReturnValue( [] ),
		} );
		const preview = await actions.preview( fixture.request.backup );
		expect( fixture.writeCount() ).toBe( 0 );
		const restored = actions.confirmImport( preview );
		expect( permissions.requestMany ).toHaveBeenCalledOnce();
		await expect( restored ).resolves.toMatchObject( { status: 'completed', missingAccess: true } );
	} );

	it( 'requests current authoritative rules immediately and verifies actual access', async () => {
		const fixture = createBackupFixture();
		let sites = fixture.request.backup.settings.sites;
		const permissions = {
			requestMany: vi.fn().mockResolvedValue( {
				status: SitePermissionRequestStatus.GRANTED, previousGrant: {},
			} ),
			hasAccess: vi.fn().mockResolvedValue( false ),
		};
		const actions = createOnboardingBackupActions( {
			runtime: { sendMessage: vi.fn().mockResolvedValue( {} ) }, permissions,
			createId: vi.fn().mockReturnValue( 'import_1' ), onImported: vi.fn().mockResolvedValue( undefined ),
			getProtectedSites: vi.fn( () => sites ),
		} );
		const denied = actions.requestAccess();
		expect( permissions.requestMany ).toHaveBeenCalledWith( sites.map( ( site ) => site.rule ) );
		await expect( denied ).resolves.toBe( false );
		permissions.hasAccess.mockResolvedValue( true );
		await expect( actions.requestAccess() ).resolves.toBe( true );
		sites = [];
		await expect( actions.requestAccess() ).resolves.toBe( true );
		expect( permissions.requestMany ).toHaveBeenLastCalledWith( [] );
	} );

	it( 'contains denied, rejected and failed permission requests and verification failures', async () => {
		const fixture = createBackupFixture();
		const permissions = {
			requestMany: vi.fn().mockResolvedValue( { status: SitePermissionRequestStatus.DENIED } ),
			hasAccess: vi.fn().mockResolvedValue( true ),
		};
		const actions = createOnboardingBackupActions( {
			runtime: { sendMessage: vi.fn().mockResolvedValue( {} ) }, permissions,
			createId: vi.fn().mockReturnValue( 'import_1' ), onImported: vi.fn().mockResolvedValue( undefined ),
			getProtectedSites: vi.fn().mockReturnValue( fixture.request.backup.settings.sites ),
		} );
		await expect( actions.requestAccess() ).resolves.toBe( false );
		permissions.requestMany.mockResolvedValueOnce( { status: SitePermissionRequestStatus.ERROR } );
		await expect( actions.requestAccess() ).resolves.toBe( false );
		permissions.requestMany.mockRejectedValueOnce( new Error( 'Permission API unavailable.' ) );
		await expect( actions.requestAccess() ).resolves.toBe( false );
		permissions.requestMany.mockResolvedValueOnce( {
			status: SitePermissionRequestStatus.GRANTED, previousGrant: {},
		} );
		permissions.hasAccess.mockRejectedValueOnce( new Error( 'Verification failed.' ) );
		await expect( actions.requestAccess() ).resolves.toBe( false );
	} );
} );
