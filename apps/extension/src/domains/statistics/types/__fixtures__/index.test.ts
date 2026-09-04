import { describe, expect, it } from 'vitest';
import { StatisticsDocumentSchema } from '../statistics-document';
import {
	createMockActiveScopeStatistics,
	createMockActiveStatisticsDocument,
	createMockScopeStatistics,
	createMockStatisticsDocument,
} from './index';

describe( 'statistics type fixtures', () => {
	it( 'creates valid independent statistics documents', () => {
		const first = createMockStatisticsDocument();
		const second = createMockStatisticsDocument();

		expect( StatisticsDocumentSchema.parse( first ) ).toEqual( first );
		expect( StatisticsDocumentSchema.parse( createMockActiveStatisticsDocument() ) ).toEqual(
			createMockActiveStatisticsDocument(),
		);
		expect( first ).not.toBe( second );
		expect( first.scopes ).not.toBe( second.scopes );
		expect( createMockScopeStatistics().activeAllowance ).toBeUndefined();
		expect( createMockActiveScopeStatistics().activeAllowance?.allowanceId ).toBe( 'allowance_1' );
	} );
} );
