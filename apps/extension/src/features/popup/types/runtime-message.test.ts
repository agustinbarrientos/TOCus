import { describe, expect, it } from 'vitest';
import {
	PopupRuntimeRequestSchema,
	PopupRuntimeRequestType,
} from './runtime-message';

describe( 'PopupRuntimeRequestSchema', () => {
	it.each( [
		PopupRuntimeRequestType.READ_STATUS,
		PopupRuntimeRequestType.REFRESH_STATUS,
	] )( 'accepts a %s request with explicit active-tab privacy metadata', ( type ) => {
		expect( PopupRuntimeRequestSchema.parse( {
			type,
			currentTab: {
				id: 7,
				incognito: false,
				url: 'https://example.com/',
			},
		} ) ).toEqual( {
			type,
			currentTab: {
				id: 7,
				incognito: false,
				url: 'https://example.com/',
			},
		} );
	} );

	it( 'accepts unavailable active-tab metadata without inventing a website', () => {
		expect( PopupRuntimeRequestSchema.parse( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: null,
		} ) ).toEqual( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab: null,
		} );
	} );

	it.each( [
		{ id: 7, url: 'https://example.com/' },
		{ id: -1, incognito: false, url: 'https://example.com/' },
		{ id: 7, incognito: false, url: '' },
	] )( 'rejects incomplete or malformed current-tab metadata', ( currentTab ) => {
		expect( PopupRuntimeRequestSchema.safeParse( {
			type: PopupRuntimeRequestType.READ_STATUS,
			currentTab,
		} ).success ).toBe( false );
	} );
} );
