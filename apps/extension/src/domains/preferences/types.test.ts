import { describe, expect, it } from 'vitest';
import {
	DefaultPreferencesDocument,
	Palette,
	PauseMode,
	PreferencesDocumentSchema,
	PreferencesDocumentVersion,
	ThemeMode,
} from './types';

describe( 'PreferencesDocumentSchema', () => {
	it( 'accepts the frozen default preferences document', () => {
		expect( PreferencesDocumentSchema.parse( DefaultPreferencesDocument ) ).toEqual( {
			schemaVersion: 1,
			theme: 'system',
			palette: 'brown',
			pauseMode: 'breathing',
			reducedMotion: false,
		} );
		expect( Object.isFrozen( DefaultPreferencesDocument ) ).toBe( true );
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
						reducedMotion: true,
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
		{ ...DefaultPreferencesDocument, telemetry: true },
	] )( 'rejects unsupported or malformed preferences', ( preferences ) => {
		expect( PreferencesDocumentSchema.safeParse( preferences ).success ).toBe( false );
	} );
} );
