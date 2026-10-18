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
			schemaVersion: 4,
			focusLinks: [],
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


describe( 'focus link preferences', () => {
	const link = { id: 'focus_link_docs-1', label: 'Read docs', url: 'https://example.com/docs' };

	it( 'normalizes trimmed links while preserving stable identities and order', () => {
		const preferences = PreferencesDocumentSchema.parse( {
			...DefaultPreferencesDocument,
			focusLinks: [ { ...link, label: '  Read docs  ', url: '  HTTPS://EXAMPLE.COM:443/docs  ' },
				{ id: 'focus_link_mail', label: 'Mail', url: 'http://example.com' } ],
		} );
		expect( preferences.focusLinks ).toEqual( [ link,
			{ id: 'focus_link_mail', label: 'Mail', url: 'http://example.com/' } ] );
	} );

	it( 'accepts the exact link size and count boundaries and duplicate destinations', () => {
		const preferences = PreferencesDocumentSchema.safeParse( {
			...DefaultPreferencesDocument,
			focusLinks: [
				{ id: `focus_link_${ 'a'.repeat( 69 ) }`, label: 'a'.repeat( 64 ), url: `https://example.com/${ 'a'.repeat( 2028 ) }` },
				{ ...link, id: 'focus_link_second' }, { ...link, id: 'focus_link_third' },
			],
		} );
		expect( preferences.success ).toBe( true );
	} );

	it.each( [
		{ ...link, id: 'other_1' }, { ...link, id: 'focus_link_' },
		{ ...link, id: 'focus_link_bad space' }, { ...link, id: 'focus_link_\u00e9' }, { ...link, id: `focus_link_${ 'a'.repeat( 70 ) }` },
		{ ...link, label: ' ' }, { ...link, label: 'a'.repeat( 65 ) },
		{ ...link, label: 'Read\nnow' }, { ...link, label: '\tRead' },
		{ ...link, label: 'Read\u007f' }, { ...link, label: 'Read\u0085' },
		{ ...link, url: 'javascript:alert(1)' }, { ...link, url: 'file:///tmp/file' },
		{ ...link, url: '/relative' }, { ...link, url: 'https://user:password@example.com' },
		{ ...link, url: 'https://user@example.com' }, { ...link, url: 'https://:password@example.com' },
		{ ...link, url: 'https://example.com/\npath' }, { ...link, url: '\thttps://example.com' },
		{ ...link, url: `https://example.com/${ 'a'.repeat( 2029 ) }` },
		{ ...link, url: `https://example.com/${ '\u00e9'.repeat( 1_000 ) }` },
		{ ...link, url: 'https:example.com' }, { ...link, url: 'https://' }, { ...link, extra: true },
	] )( 'rejects unsafe or malformed focus links', ( invalid ) => {
		expect( PreferencesDocumentSchema.safeParse( {
			...DefaultPreferencesDocument, focusLinks: [ invalid ],
		} ).success ).toBe( false );
	} );

	it( 'rejects duplicate link identities and more than three links', () => {
		for ( const focusLinks of [ [ link, link ],
			[ link, ...[ 'two', 'three', 'four' ].map( ( id ) => ( { ...link, id: `focus_link_${ id }` } ) ) ] ] ) {
			expect( PreferencesDocumentSchema.safeParse( {
				...DefaultPreferencesDocument, focusLinks,
			} ).success ).toBe( false );
		}
	} );
} );
