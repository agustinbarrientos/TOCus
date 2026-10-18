import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createBackupResetScreenCopy } from './index';

describe( 'createBackupResetScreenCopy', () => {
	it( 'separates backup and reset labels while preserving explicit destructive confirmations', () => {
		const copy = createBackupResetScreenCopy( createTestI18n() );
		expect( copy.title ).toBe( 'Backup and reset' );
		expect( copy.exportBackup ).toBe( 'Export backup' );
		expect( copy.importBackup ).toBe( 'Import backup' );
		expect( copy.backupDescription ).toBe( 'Your backup includes your sites, settings, and stats, and it\u2019s created entirely on your device. TOCus never collects your browsing history or page contents.' );
		expect( copy.statisticsDescription ).toContain( 'Your websites and settings stay the same' );
		expect( copy.statisticsConfirmation ).toBe( "All recorded statistics will be deleted. This can't be undone." );
		expect( copy.allConfirmation ).toContain( 'The setup will begin again.' );
		expect( copy.allConfirmation ).toContain( "This can't be reversed." );
		expect( copy.allSuccess ).toBe( 'All TOCus data reset.' );
		expect( Object.isFrozen( copy ) ).toBe( true );
	} );
} );
