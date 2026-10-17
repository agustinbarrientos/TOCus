import { describe, expect, it, vi } from 'vitest';
import type { PrivacyDataRuntime } from '../privacy-data-actions/types';
import { createBackupDataActions } from '.';
import { createBackupFixture } from '../../../../domains/local-data/services/local-data-backup/__fixtures__';
import { SitePermissionRequestStatus } from '../../../protected-sites/services/site-permission-manager';

/**
 * Connects the client to a real map-backed import authority and observable browser consent.
 * @return Client, permission boundary and saved records.
 * @since 1.1.0
 */
function createFixture() {
	const fixture = createBackupFixture();
	const runtime = { sendMessage: vi.fn<PrivacyDataRuntime['sendMessage']>( ( request: unknown ) => {
		if ( typeof request === 'object' && request && 'type' in request ) {
			if ( request.type === 'read-local-backup-state' ) {
				return Promise.resolve( { status: 'ready', generation: null } );
			}
			if ( request.type === 'export-local-backup' ) {
				return fixture.backup.export();
			}
		}
		return fixture.backup.import( request );
	} ) };
	const permissions = {
		requestMany: vi.fn().mockResolvedValue( { status: SitePermissionRequestStatus.GRANTED, previousGrant: {} } ),
		hasAccess: vi.fn().mockResolvedValue( true ),
	};
	const onImported = vi.fn().mockResolvedValue( undefined );
	const actions = createBackupDataActions( { runtime, permissions, createId: vi.fn().mockReturnValue( 'confirmed_1' ), onImported } );
	return { ...fixture, runtime, permissions, onImported, actions };
}

describe( 'backup settings client', () => {
	it( 'previews without writes and starts consent synchronously before background replacement', async () => {
		const fixture = createFixture();
		const preview = await fixture.actions.preview( fixture.request.backup );
		expect( fixture.writeCount() ).toBe( 0 );
		const consent = Promise.withResolvers<{ status: 'denied' }>();
		fixture.permissions.requestMany.mockReturnValueOnce( consent.promise );
		fixture.permissions.hasAccess.mockResolvedValue( false );
		const first = fixture.actions.confirmImport( preview );
		const second = fixture.actions.confirmImport( preview );
		expect( fixture.permissions.requestMany ).toHaveBeenCalledTimes( 1 );
		expect( fixture.writeCount() ).toBe( 0 );
		consent.resolve( { status: 'denied' } );
		await expect( first ).resolves.toMatchObject( { status: 'completed', missingAccess: true } );
		await expect( second ).resolves.toMatchObject( { status: 'completed' } );
		expect( fixture.onImported ).toHaveBeenCalledOnce();
	} );

	it( 'exports validated portable history', async () => {
		const fixture = createFixture();
		await expect( fixture.actions.export() ).resolves.toMatchObject( { status: 'available',
			backup: { application: 'TOCus' } } );
	} );

	it( 'never imports after a browser consent API error', async () => {
		const fixture = createFixture();
		const preview = await fixture.actions.preview( fixture.request.backup );
		fixture.permissions.requestMany.mockResolvedValueOnce( { status: SitePermissionRequestStatus.ERROR } );
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toEqual( { status: 'permission-error' } );
		expect( fixture.writeCount() ).toBe( 0 );
	} );

	it( 'keeps the same request identity after a lost response without overwriting later history', async () => {
		const fixture = createFixture();
		const preview = await fixture.actions.preview( fixture.request.backup );
		const send = fixture.runtime.sendMessage.getMockImplementation();
		fixture.runtime.sendMessage.mockImplementationOnce( async ( request ) => {
			await send?.( request );
			throw new Error( 'Channel closed' );
		} );
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toEqual( { status: 'recovery-pending' } );
		const writes = fixture.writeCount();
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toMatchObject( { status: 'completed' } );
		expect( fixture.writeCount() ).toBe( writes );
	} );
} );

describe( 'backup response failures', () => {
	it.each( [ 'stale', 'busy', 'invalid', 'failed', 'recovery-pending' ] )( 'keeps %s visible without refreshing editors', async ( status ) => {
		const fixture = createFixture();
		const preview = await fixture.actions.preview( fixture.request.backup );
		fixture.runtime.sendMessage.mockResolvedValueOnce( { status } );
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toEqual( { status } );
		expect( fixture.onImported ).not.toHaveBeenCalled();
	} );

	it( 'contains thrown consent, malformed responses and mismatched completion identities', async () => {
		const fixture = createFixture();
		const preview = await fixture.actions.preview( fixture.request.backup );
		fixture.permissions.requestMany.mockRejectedValueOnce( new Error( 'Browser failed' ) );
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toEqual( { status: 'permission-error' } );
		fixture.runtime.sendMessage.mockResolvedValueOnce( { status: 'completed', requestId: 'other', generation: 'data' } );
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toEqual( { status: 'recovery-pending' } );
		fixture.runtime.sendMessage.mockResolvedValueOnce( { status: 'not-real' } );
		await expect( fixture.actions.confirmImport( preview ) ).resolves.toEqual( { status: 'recovery-pending' } );
		fixture.runtime.sendMessage.mockRejectedValueOnce( new Error( 'Channel' ) );
		await expect( fixture.actions.export() ).resolves.toEqual( { status: 'unavailable' } );
		fixture.runtime.sendMessage.mockResolvedValueOnce( { status: 'unavailable' } );
		await expect( fixture.actions.preview( fixture.request.backup ) ).rejects.toThrow( 'pending' );
	} );
} );
