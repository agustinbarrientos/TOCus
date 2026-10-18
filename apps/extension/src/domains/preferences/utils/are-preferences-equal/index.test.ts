import { describe, expect, it } from 'vitest';
import {
	DefaultPreferencesDocument,
	Language,
	Palette,
	PauseMode,
	ThemeMode,
} from '../../types';
import { arePreferencesEqual } from './index';

describe( 'arePreferencesEqual', () => {
	it( 'recognizes equivalent preferences documents from separate projections', () => {
		expect( arePreferencesEqual(
			{ ...DefaultPreferencesDocument },
			{ ...DefaultPreferencesDocument },
		) ).toBe( true );
	} );

	it.each( [
		{ field: 'theme', value: ThemeMode.DARK },
		{ field: 'palette', value: Palette.GREEN },
		{ field: 'pauseMode', value: PauseMode.QUIET },
		{ field: 'language', value: Language.GERMAN },
	] )( 'rejects a projection whose $field differs', ( { field, value } ) => {
		expect( arePreferencesEqual(
			DefaultPreferencesDocument,
			{ ...DefaultPreferencesDocument, [ field ]: value },
		) ).toBe( false );
	} );
} );


it( 'notices link additions, removals, edits and reorders while accepting detached copies', () => {
	const first = { id: 'focus_link_docs', label: 'Docs', url: 'https://example.com/docs' };
	const second = { id: 'focus_link_tasks', label: 'Tasks', url: 'https://example.com/tasks' };
	const preferences = { ...DefaultPreferencesDocument, focusLinks: [ first, second ] };
	expect( arePreferencesEqual( preferences, structuredClone( preferences ) ) ).toBe( true );
	for ( const focusLinks of [ [], [ first ], [ second, first ],
		[ { ...first, id: 'focus_link_new' }, second ], [ { ...first, label: 'Read' }, second ],
		[ { ...first, url: 'https://example.com/new' }, second ] ] ) {
		expect( arePreferencesEqual( preferences, { ...preferences, focusLinks } ) ).toBe( false );
	}
} );
