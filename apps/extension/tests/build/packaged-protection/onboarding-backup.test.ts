import { expect, test } from './__fixtures__';
import type { ExtensionWorkerGlobal } from './types';
import { createBackupDocument } from '../../../src/domains/local-data/utils/backup-document';
import { createBackupSource } from '../../../src/domains/local-data/utils/backup-document/__fixtures__';
import { BackupImportReceiptSchema } from '../../../src/domains/local-data/types/backup-operation';
import { BackupImportJournalKey, BackupImportReceiptKey } from '../../../src/domains/local-data/types/backup-storage-key';
import { LocalDataGenerationSchema, LocalDataGenerationStorageKey } from '../../../src/domains/local-data/services/local-data-generation';
import { PreferencesStorageKey } from '../../../src/domains/preferences/services/preferences-storage';
import { Language, Palette, PreferencesDocumentSchema, ThemeMode } from '../../../src/domains/preferences/types';
import { ProtectionConfigurationStorageKey } from '../../../src/domains/protection/services/protection-configuration-storage';
import { ProtectionConfigurationDocumentSchema } from '../../../src/domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../src/domains/protection/types/protection-value';
import { StatisticsStorageKey } from '../../../src/domains/statistics/services/statistics-storage';
import { StatisticsDocumentSchema } from '../../../src/domains/statistics/types/statistics-document';

test( 'restores a local backup through packaged onboarding and the real background authority', async ( {
	context, worker, extensionRoot,
} ) => {
	const onboarding = context.pages().find( page => page.url() === new URL( 'onboarding.html', extensionRoot ).href );
	if ( ! onboarding ) {
		throw new Error( 'Expected the disposable installation to open its packaged onboarding page.' );
	}
	const source = createBackupSource();
	source.configuration.sites = [ {
		identityHost: 'example.test',
		rule: { host: 'example.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
	} ];
	source.preferences = { ...source.preferences, language: Language.ENGLISH,
		theme: ThemeMode.DARK, palette: Palette.BLUE };
	const backup = createBackupDocument( source );

	await onboarding.getByRole( 'button', { name: 'Have a backup?', exact: true } ).click();
	await expect( onboarding.getByRole( 'dialog', { name: 'Import a backup', exact: true } ) ).toBeVisible();
	await onboarding.locator( 'input[type=file]' ).setInputFiles( {
		name: 'onboarding-backup.json', mimeType: 'application/json', buffer: Buffer.from( JSON.stringify( backup ) ),
	} );
	const review = onboarding.getByRole( 'dialog', { name: 'Restore this backup?', exact: true } );
	await expect( review ).toContainText( 'onboarding-backup.json' );
	await expect( review ).toContainText( '7 reconsidered visits' );
	await review.getByRole( 'button', { name: 'Restore backup', exact: true } ).click();
	await expect( onboarding.getByRole( 'heading', { name: 'Your backup is restored', exact: true } ) ).toBeVisible();
	await expect( onboarding.locator( '[data-tocus-ui][data-tocus-theme="dark"][data-tocus-palette="blue"]' ) ).toBeVisible();
	await expect( onboarding.getByRole( 'button', { name: 'Continue', exact: true } ) ).toHaveCount( 0 );

	const records = await worker.evaluate( async ( keys ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return chrome.storage.local.get( keys );
	}, [ PreferencesStorageKey.PREFERENCES, ProtectionConfigurationStorageKey.CONFIGURATION,
		StatisticsStorageKey.STATISTICS, LocalDataGenerationStorageKey,
		BackupImportReceiptKey, BackupImportJournalKey ] );
	const preferences = PreferencesDocumentSchema.parse( records[ PreferencesStorageKey.PREFERENCES ] );
	const configuration = ProtectionConfigurationDocumentSchema.parse(
		records[ ProtectionConfigurationStorageKey.CONFIGURATION ],
	);
	const statistics = StatisticsDocumentSchema.parse( records[ StatisticsStorageKey.STATISTICS ] );
	const generation = LocalDataGenerationSchema.parse( records[ LocalDataGenerationStorageKey ] );
	const receipt = BackupImportReceiptSchema.parse( records[ BackupImportReceiptKey ] );
	expect( preferences ).toMatchObject( backup.preferences );
	expect( configuration.sites ).toEqual( backup.settings.sites );
	expect( configuration.timingConfiguration ).toEqual( backup.settings.timingConfiguration );
	expect( statistics.scopes[ DefaultProtectionScopeId ]?.totals )
		.toEqual( backup.statistics.scopes[ DefaultProtectionScopeId ] );
	expect( generation ).toEqual( { generation: receipt.generation, pending: false, needsOnboarding: false } );
	expect( records[ BackupImportJournalKey ] ).toBeUndefined();

	const [ settings ] = await Promise.all( [
		context.waitForEvent( 'page' ),
		onboarding.getByRole( 'button', { name: 'Open Settings', exact: true } ).click(),
	] );
	await expect( settings ).toHaveURL( new URL( 'options.html', extensionRoot ).href );
	await expect( settings.getByRole( 'heading', { name: 'Websites', exact: true } ) ).toBeVisible();
	await expect( settings.getByText( 'example.test', { exact: true } ).first() ).toBeVisible();
} );
