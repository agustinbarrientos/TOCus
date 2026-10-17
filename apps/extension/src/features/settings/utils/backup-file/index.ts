import { BackupMaximumBytes, BackupDataFormatVersion, type BackupDocument } from '../../../../domains/local-data/types/backup-document';
import { parseBackupText } from '../../../../domains/local-data/utils/backup-document';
import { BackupFileFailure, type BackupFile } from './types';

/**
 * Carries a safe failure category without displaying untrusted file contents.
 * @since 1.1.0
 */
export class BackupFileError extends Error {
	/**
	 * Retains the localized failure category.
	 * @param reason - Safe presentation key.
	 * @since 1.1.0
	 */
	constructor( readonly reason: BackupFileFailure ) {
		super( reason );
	}
}

/**
 * Checks the selected file before decoding and validates portable backup contents.
 * @param file - Local file chosen through the browser input.
 * @return Complete validated portable document.
 * @since 1.1.0
 */
export async function readBackupFile( file: BackupFile ): Promise<BackupDocument> {
	if ( file.size > BackupMaximumBytes ) {
		throw new BackupFileError( BackupFileFailure.OVERSIZE );
	}
	let text: string;
	try {
		text = await file.text();
	} catch {
		throw new BackupFileError( BackupFileFailure.READ );
	}
	if ( new TextEncoder().encode( text ).byteLength > BackupMaximumBytes ) {
		throw new BackupFileError( BackupFileFailure.OVERSIZE );
	}
	let input: unknown;
	try {
		input = JSON.parse( text );
	} catch {
		throw new BackupFileError( BackupFileFailure.JSON );
	}
	if ( typeof input === 'object' && input !== null && 'application' in input ) {
		if ( input.application !== 'TOCus' ) {
			throw new BackupFileError( BackupFileFailure.APPLICATION );
		}
		if ( 'dataFormatVersion' in input && input.dataFormatVersion !== BackupDataFormatVersion ) {
			throw new BackupFileError( BackupFileFailure.UNSUPPORTED );
		}
	}
	try {
		return parseBackupText( text );
	} catch {
		throw new BackupFileError( BackupFileFailure.INVALID );
	}
}

/**
 * Downloads a validated backup locally without a network request or downloads permission.
 * @param backup - Portable document returned by the authority.
 * @since 1.1.0
 */
export function downloadBackup( backup: BackupDocument ): void {
	const blob = new Blob( [ JSON.stringify( backup ) ], { type: 'application/json' } );
	const url = URL.createObjectURL( blob );
	const anchor = document.createElement( 'a' );
	try {
		anchor.href = url;
		anchor.download = `TOCus-backup-${ backup.exportedAt.slice( 0, 10 ) }.json`;
		document.body.append( anchor );
		anchor.click();
	} finally {
		anchor.remove();
		setTimeout( () => {
			URL.revokeObjectURL( url );
		}, 1_000 );
	}
}

export * from './types';
