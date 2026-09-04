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
		{ field: 'reducedMotion', value: true },
		{ field: 'language', value: Language.GERMAN },
	] )( 'rejects a projection whose $field differs', ( { field, value } ) => {
		expect( arePreferencesEqual(
			DefaultPreferencesDocument,
			{ ...DefaultPreferencesDocument, [ field ]: value },
		) ).toBe( false );
	} );
} );
