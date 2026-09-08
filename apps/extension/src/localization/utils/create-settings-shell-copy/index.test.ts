import { describe, expect, it } from 'vitest';
import { createTestI18n } from '../../__fixtures__';
import { createSettingsShellCopy } from './index';

describe( 'createSettingsShellCopy', () => {
	it( 'creates settings navigation copy', () => {
		const copy = createSettingsShellCopy( createTestI18n() );

		expect( copy.navigationLabel ).toBe( 'Settings' );
		expect( copy.protectedSites ).toBe( 'Websites' );
		expect( copy.timing ).toBe( 'Pause timing' );
		expect( copy.privacy ).toBe( 'Privacy and local data' );
		expect( copy.about ).toBe( 'About' );
		expect( copy.unsavedChangesTitle ).toBe( 'Discard unsaved changes?' );
		expect( copy.stay ).toBe( 'Stay' );
		expect( copy.discard ).toBe( 'Discard' );
	} );
} );
