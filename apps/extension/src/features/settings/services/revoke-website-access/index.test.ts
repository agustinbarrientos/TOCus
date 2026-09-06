import { describe, expect, it, vi } from 'vitest';
import { revokeWebsiteAccess } from './index';

describe( 'revoke website access', () => {
	it( 'removes orphaned host grants and optional navigation but preserves required capabilities', async () => {
		const permissions = {
			getAll: vi.fn().mockResolvedValueOnce( { origins: [ '*://*.github.com/*' ], permissions: [ 'storage', 'activeTab', 'favicon', 'webNavigation' ] } ).mockResolvedValue( { permissions: [ 'storage', 'activeTab', 'favicon' ] } ),
			remove: vi.fn().mockResolvedValue( true ),
		};
		await expect( revokeWebsiteAccess( permissions ) ).resolves.toBe( true );
		expect( permissions.remove ).toHaveBeenCalledWith( { origins: [ '*://*.github.com/*' ], permissions: [ 'webNavigation' ] } );
	} );

	it( 'does not request removal when no optional access remains', async () => {
		const permissions = { getAll: vi.fn().mockResolvedValue( {} ), remove: vi.fn() };
		await expect( revokeWebsiteAccess( permissions ) ).resolves.toBe( true );
		expect( permissions.remove ).not.toHaveBeenCalled();
	} );

	it.each( [ false, true ] )( 'rejects denied removal or remaining grants after removal result %s', async ( removed ) => {
		const permissions = { getAll: vi.fn().mockResolvedValue( { origins: [ '*://*.github.com/*' ] } ), remove: vi.fn().mockResolvedValue( removed ) };
		await expect( revokeWebsiteAccess( permissions ) ).resolves.toBe( false );
	} );

	it( 'does not report success while navigation access remains', async () => {
		const permissions = { getAll: vi.fn().mockResolvedValue( { permissions: [ 'webNavigation' ] } ), remove: vi.fn().mockResolvedValue( true ) };
		await expect( revokeWebsiteAccess( permissions ) ).resolves.toBe( false );
	} );

	it( 'propagates permission API errors for reset recovery', async () => {
		const permissions = { getAll: vi.fn().mockRejectedValue( new Error( 'unavailable' ) ), remove: vi.fn() };
		await expect( revokeWebsiteAccess( permissions ) ).rejects.toThrow( 'unavailable' );
	} );
} );
