import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createBackupDocument } from '../../../../domains/local-data/utils/backup-document';
import { createBackupSource } from '../../../../domains/local-data/utils/backup-document/__fixtures__';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import type { SettingsPageShell } from '../../services/settings-page/types';
import { BackupPreviewContent } from './preview';

afterEach( () => vi.unstubAllGlobals() );

it( 'counts private-aware website groups while rendering each distinct exception address', () => {
	vi.stubGlobal( 'document', { documentElement: { lang: 'en' } } );
	const backup = createBackupDocument( createBackupSource() );
	const main = backup.settings.sites[ 0 ];
	if ( ! main ) {
		throw new Error( 'Missing main fixture.' );
	}
	backup.settings.sites = [ main,
		{ ...main, rule: { ...main.rule, pathPrefix: '/shorts' } },
		{ ...main, identityHost: 'studio.youtube.com', rule: { ...main.rule, host: 'studio.youtube.com', includeSubdomains: false } },
		{ identityHost: 'alice.github.io', rule: { ...main.rule, host: 'alice.github.io' } },
		{ identityHost: 'bob.github.io', rule: { ...main.rule, host: 'bob.github.io' } },
	];
	const copy = TestEnglishLocalizationBundle;
	const shell = { copy: copy.settingsShell, backupResetCopy: copy.backupResetCopy, timingCopy: copy.timing,
		appearanceCopy: copy.appearance, statisticsCopy: copy.statistics, scheduleCopy: copy.schedule,
		languageCopy: copy.languageScreen } as SettingsPageShell;
	const markup = renderToStaticMarkup( <BackupPreviewContent shell={ shell } backup={ backup } /> );
	expect( markup ).toContain( `<dt>${ copy.backupResetCopy.websiteCountLabel }</dt><dd>3</dd>` );
	expect( markup ).toContain( 'youtube.com/shorts' );
	expect( markup ).toContain( 'studio.youtube.com' );
} );
