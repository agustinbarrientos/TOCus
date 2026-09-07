import { ProtectedSiteEnrollmentStatus } from '../../protected-sites/services/protected-site-enrollment/types';
import { describe, expect, it } from 'vitest';
import {
	PopupSiteEnrollmentRequestSchema,
	PopupSiteEnrollmentRequestType,
	PopupSiteEnrollmentResultSchema,
} from './site-enrollment';

describe( 'popup website enrollment contracts', () => {
	it( 'parses a popup addition and its configuration-free success outcome', () => {
		const request = {
			type: PopupSiteEnrollmentRequestType,
			siteInput: 'https://github.com/',
			independent: false,
		};
		expect( PopupSiteEnrollmentRequestSchema.parse( request ) ).toEqual( request );
		expect( PopupSiteEnrollmentResultSchema.parse( { status: ProtectedSiteEnrollmentStatus.ADDED } ) )
			.toEqual( { status: ProtectedSiteEnrollmentStatus.ADDED } );
	} );
} );
