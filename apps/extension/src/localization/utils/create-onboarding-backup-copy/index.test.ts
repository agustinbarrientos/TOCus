import { describe, expect, it } from 'vitest';
import { Language } from '../../../domains/preferences/types';
import { createTestI18n } from '../../__fixtures__';
import { loadLocalizationMessages } from '../../services/load-localization-messages';
import { createLocalizationBundle } from '../create-localization-bundle';
import { createOnboardingCopy } from '../create-onboarding-copy';

const EnglishMessages = {
	entryLabel: 'Have a backup?',
	importTitle: 'Import a backup',
	importDescription: 'Choose a JSON backup exported from TOCus on this or another browser.',
	chooseFile: 'Choose backup file',
	reviewTitle: 'Restore this backup?',
	reviewDescription: 'Use this backup to finish setting up TOCus.',
	restoreBackup: 'Restore backup',
	chooseDifferentFile: 'Choose a different file',
	websitesLabel: 'Websites and exceptions',
	settingsLabel: 'Settings',
	statisticsLabel: 'Statistics',
	includedLabel: 'Included',
	replacementDescription: 'This replaces your current TOCus data.',
	successTitle: 'Your backup is restored',
	successDescription: 'Your websites, settings and statistics are ready. You can make changes in Settings.',
	accessTitle: 'One more step for your websites',
	accessDescription: 'Your settings and statistics are restored. Allow website access so TOCus can pause the sites in your backup.',
	allowAccess: 'Allow website access',
	later: 'Do this later',
	accessError: "Website access wasn't granted. Try again, or continue in Settings.",
};

describe( 'createOnboardingBackupCopy', () => {
	it( 'provides complete import and access recovery copy through the onboarding bundle', () => {
		const copy = createOnboardingCopy( createTestI18n() ).backup;

		expect( copy ).toMatchObject( EnglishMessages );
		expect( copy.common.cancel ).toBe( 'Cancel' );
		expect( copy.common.retry ).toBe( 'Try again' );
		expect( copy.common.importingBackup ).toBe( 'Importing backup...' );
		expect( copy.common.backupJsonError ).toBe( "This file isn't valid JSON. Choose a TOCus backup." );
		expect( copy.common.websiteCountLabel ).toBe( 'Website count' );
		expect( copy.common.backupStaleError ).toBe( 'Your local data changed. Review the backup again before restoring it.' );
		expect( copy.common.missingPermissionDescription ).toContain( 'websites without access will remain unprotected' );
		expect( Object.isFrozen( copy ) ).toBe( true );
		expect( Object.isFrozen( copy.common ) ).toBe( true );
	} );

	it( 'formats creation dates and complete reconsidered visit totals for English', () => {
		const copy = createOnboardingCopy( createTestI18n() ).backup;

		expect( copy.formatCreatedAt( '2026-10-17T00:00:00.000Z' ) ).toBe( 'Created Oct 17, 2026' );
		expect( copy.formatReconsideredVisits( 0 ) ).toBe( '0 reconsidered visits' );
		expect( copy.formatReconsideredVisits( 1 ) ).toBe( '1 reconsidered visit' );
		expect( copy.formatReconsideredVisits( 7 ) ).toBe( '7 reconsidered visits' );
		expect( copy.formatReconsideredVisits( 1000 ) ).toBe( '1,000 reconsidered visits' );
	} );

	it.each( [
		[ Language.ENGLISH, 'Created Oct 17, 2026', '7 reconsidered visits' ],
		[ Language.SPANISH_TU, 'Creada el 17 oct 2026', '7 visitas reconsideradas' ],
		[ Language.SPANISH_VOS, 'Creada el 17 de oct de 2026', '7 visitas reconsideradas' ],
		[ Language.PORTUGUESE_BRAZIL, 'Criado em 17 de out. de 2026', '7 visitas reconsideradas' ],
		[ Language.PORTUGUESE_PORTUGAL, 'Criada em 17/10/2026', '7 visitas reconsideradas' ],
		[ Language.ITALIAN, 'Creato il 17 ott 2026', '7 visite riconsiderate' ],
		[ Language.FRENCH, 'Cr\u00e9\u00e9e le 17 oct. 2026', '7 visites reconsid\u00e9r\u00e9es' ],
		[ Language.GERMAN, 'Erstellt am 17. Okt. 2026', '7 neu \u00fcberdachte Besuche' ],
		[ Language.JAPANESE, '2026\u5e7410\u670817\u65e5\u306b\u4f5c\u6210', '\u518d\u8003\u3057\u305f\u30a2\u30af\u30bb\u30b9 7 \u4ef6' ],
		[ Language.RUSSIAN, '\u0421\u043e\u0437\u0434\u0430\u043d\u0430 17 \u043e\u043a\u0442. 2026 \u0433.', '7 \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043d\u044b\u0445 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u0439' ],
	] as const )( 'loads complete onboarding import copy from the %s packaged catalog', async ( language, date, visits ) => {
		const messages = await loadLocalizationMessages( language );
		const copy = createLocalizationBundle( language, messages ).onboarding.backup;

		for ( const [ key, source ] of Object.entries( EnglishMessages ) ) {
			const translated = copy[ key as keyof typeof EnglishMessages ];

			expect( translated, `${ language }: ${ key }` ).toBeTruthy();
			if ( language === Language.ENGLISH ) {
				expect( translated ).toBe( source );
			} else {
				expect( translated, `${ language }: ${ key }` ).not.toBe( source );
			}
		}
		expect( copy.formatCreatedAt( '2026-10-17T00:00:00.000Z' ) ).toBe( date );
		expect( copy.formatReconsideredVisits( 7 ) ).toBe( visits );
		if ( language !== Language.ENGLISH ) {
			expect( copy.formatCreatedAt( '2026-10-17T00:00:00.000Z' ) ).not.toBe( 'Created Oct 17, 2026' );
			expect( copy.formatReconsideredVisits( 7 ) ).not.toBe( '7 reconsidered visits' );
			expect( copy.common.backupStaleError ).not.toBe( 'Your local data changed. Review the backup again before restoring it.' );
		}
	} );
	it( 'preserves the distinct Russian singular, few and many visit forms', async () => {
		const messages = await loadLocalizationMessages( Language.RUSSIAN );
		const copy = createLocalizationBundle( Language.RUSSIAN, messages ).onboarding.backup;

		expect( copy.formatReconsideredVisits( 1 ) ).toBe( '1 \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043d\u043e\u0435 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u0435' );
		expect( copy.formatReconsideredVisits( 2 ) ).toBe( '2 \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043d\u044b\u0445 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u044f' );
		expect( copy.formatReconsideredVisits( 5 ) ).toBe( '5 \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043d\u044b\u0445 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u0439' );
		expect( copy.formatReconsideredVisits( 21 ) ).toBe( '21 \u043f\u0435\u0440\u0435\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043d\u043e\u0435 \u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u0435' );
	} );
} );
