import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createDocumentCopy } from './index';

describe( 'createDocumentCopy', () => {
	it( 'creates every localized document title', () => {
		expect( createDocumentCopy( createTestI18n() ) ).toEqual( {
			interruptionTitle: 'TOCus',
			onboardingTitle: 'Welcome to TOCus',
			popupTitle: 'TOCus',
			settingsTitle: 'TOCus settings',
		} );
	} );
} );
