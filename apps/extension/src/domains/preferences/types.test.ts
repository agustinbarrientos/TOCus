import { describe, expect, it } from 'vitest';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	PauseMode,
	PreferencesDocumentSchema,
	PreferencesDocumentVersion,
	ThemeMode,
} from './types';

describe( 'PreferencesDocumentSchema', () => {
	it( 'rejects a persisted motion override instead of retaining legacy preferences', () => {
		expect( PreferencesDocumentSchema.safeParse( {
			...DefaultPreferencesDocument, reducedMotion: true,
		} ).success ).toBe( false );
	} );
	it( 'accepts the frozen default preferences document', () => {
		expect( PreferencesDocumentSchema.parse( DefaultPreferencesDocument ) ).toEqual( {
			schemaVersion: 3,
			theme: ThemeMode.SYSTEM,
			palette: Palette.BROWN,
			pauseMode: PauseMode.BREATHING,
			language: null,
		} );
		expect( Object.isFrozen( DefaultPreferencesDocument ) ).toBe( true );
	} );

	it( 'accepts automatic language selection and every explicit supported language', () => {
		for ( const language of [ null, ...Object.values( Language ) ] ) {
			expect( PreferencesDocumentSchema.safeParse( {
				...DefaultPreferencesDocument,
				language,
			} ).success ).toBe( true );
		}
	} );

	it( 'accepts every approved appearance preference', () => {
		for ( const theme of Object.values( ThemeMode ) ) {
			for ( const palette of Object.values( Palette ) ) {
				for ( const pauseMode of Object.values( PauseMode ) ) {
					expect( PreferencesDocumentSchema.safeParse( {
						...DefaultPreferencesDocument,
						theme,
						palette,
						pauseMode,
					} ).success ).toBe( true );
				}
			}
		}
	} );

	it.each( [
		{ ...DefaultPreferencesDocument, schemaVersion: PreferencesDocumentVersion + 1 },
		{ ...DefaultPreferencesDocument, theme: 'sepia' },
		{ ...DefaultPreferencesDocument, palette: 'teal' },
		{ ...DefaultPreferencesDocument, pauseMode: 'skip' },
		{ ...DefaultPreferencesDocument, reducedMotion: 'yes' },
		{ ...DefaultPreferencesDocument, language: 'es-MX' },
		{ ...DefaultPreferencesDocument, telemetry: true },
	] )( 'rejects unsupported or malformed preferences', ( preferences ) => {
		expect( PreferencesDocumentSchema.safeParse( preferences ).success ).toBe( false );
	} );
} );
