import { describe, expect, it, vi } from 'vitest';
import { readBackupFile, downloadBackup } from '.';
import { BackupMaximumBytes } from '../../../../domains/local-data/types/backup-document';
import { createBackupDocument, parseBackupText } from '../../../../domains/local-data/utils/backup-document';
import { createBackupSource, createBackupVisitOutcomes } from '../../../../domains/local-data/utils/backup-document/__fixtures__';

describe( 'local backup files', () => {
	it( 'accepts optional aggregate history in the existing format and rejects malformed buckets', async () => {
		const backup = createBackupDocument( createBackupSource() );
		const outcomes = createBackupVisitOutcomes();
		Reflect.set( backup.statistics, 'visitOutcomes', outcomes );
		const value = JSON.stringify( backup );
		await expect( readBackupFile( { size: value.length, text: vi.fn().mockResolvedValue( value ) } ) )
			.resolves.toMatchObject( { statistics: { visitOutcomes: outcomes } } );
		const invalid = JSON.stringify( { ...backup, statistics: { ...backup.statistics,
			visitOutcomes: { ...outcomes, dailyHours: [ { ...outcomes.dailyHours[ 0 ], hour: 24 } ] },
		} } );
		await expect( readBackupFile( { size: invalid.length, text: vi.fn().mockResolvedValue( invalid ) } ) )
			.rejects.toThrow( 'invalid' );
	} );

	it( 'checks size before reading and validates actual bytes independently of the MIME label', async () => {
		const backup = createBackupDocument( createBackupSource() );
		const text = vi.fn().mockResolvedValue( JSON.stringify( backup ) );
		await expect( readBackupFile( { size: BackupMaximumBytes + 1, text } ) ).rejects.toThrow( 'oversize' );
		expect( text ).not.toHaveBeenCalled();
		await expect( readBackupFile( { size: 1, text: vi.fn().mockResolvedValue( 'x'.repeat( BackupMaximumBytes + 1 ) ) } ) )
			.rejects.toThrow( 'oversize' );
		await expect( readBackupFile( { size: 20, text } ) ).resolves.toEqual( backup );
	} );

	it.each( [ [ '{', 'json' ], [ '{}', 'invalid' ],
		[ '{"application":"Another"}', 'application' ],
		[ '{"application":"TOCus","dataFormatVersion":"9"}', 'unsupported' ] ] )(
		'rejects %s with a precise safe reason', async ( value, reason ) => {
			await expect( readBackupFile( { size: value.length, text: vi.fn().mockResolvedValue( value ) } ) )
				.rejects.toThrow( reason );
		},
	);

	it( 'contains file read failures', async () => {
		await expect( readBackupFile( { size: 10, text: vi.fn().mockRejectedValue( new Error( 'disk' ) ) } ) )
			.rejects.toThrow( 'read' );
	} );

	it( 'downloads portable JSON and revokes its object URL even if the browser click fails', () => {
		const backup = createBackupDocument( createBackupSource() );
		const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
		const createObjectURL = vi.fn().mockReturnValue( 'blob:backup' );
		const revokeObjectURL = vi.fn();
		vi.stubGlobal( 'document', { createElement: vi.fn().mockReturnValue( anchor ), body: { append: vi.fn() } } );
		vi.stubGlobal( 'URL', { createObjectURL, revokeObjectURL } );
		vi.useFakeTimers();
		try {
			downloadBackup( backup );
			expect( anchor.download ).toBe( 'TOCus-backup-2026-10-17.json' );
			expect( createObjectURL.mock.calls[ 0 ]?.[ 0 ] ).toBeInstanceOf( Blob );
			vi.runAllTimers();
			expect( revokeObjectURL ).toHaveBeenCalledWith( 'blob:backup' );
			anchor.click.mockImplementationOnce( () => {
				throw new Error( 'blocked' );
			} );
			expect( () => {
				downloadBackup( backup );
			} ).toThrow( 'blocked' );
			vi.runAllTimers();
			expect( revokeObjectURL ).toHaveBeenCalledTimes( 2 );
		} finally {
			vi.useRealTimers();
			vi.unstubAllGlobals();
		}
	} );
} );


it( 'downloads the bounded serialization so large valid backups remain importable', async () => {
	const backup = createBackupDocument( createBackupSource() );
	const totals = backup.statistics.scopes.scope_default;
	if ( ! totals ) {
		throw new Error( 'Missing history.' );
	}
	backup.statistics.scopes = Object.fromEntries( Array.from( { length: 50_000 },
		( _, index ) => [ `historical_${ String( index ) }`, totals ] ) );
	const validated = parseBackupText( JSON.stringify( backup ) );
	let downloaded: Blob | undefined;
	let text = '';
	const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
	vi.stubGlobal( 'document', { createElement: vi.fn().mockReturnValue( anchor ), body: { append: vi.fn() } } );
	vi.stubGlobal( 'URL', { createObjectURL: vi.fn( ( blob: Blob ) => {
		downloaded = blob; return 'blob:backup';
	} ),
	revokeObjectURL: vi.fn() } );
	vi.useFakeTimers();
	try {
		downloadBackup( validated );
		text = await downloaded?.text() ?? '';
		if ( ! text ) {
			throw new Error( 'No downloaded bytes.' );
		}
	} finally {
		vi.runAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
	}
	expect( () => parseBackupText( text ) ).not.toThrow();
} );
