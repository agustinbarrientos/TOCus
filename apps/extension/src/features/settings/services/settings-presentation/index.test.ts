import { describe, expect, it, vi } from 'vitest';
import { SettingsPresentationState } from './types';
import { createPresentationPort } from '../../../../shared/utils/presentation-port';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { Language } from '../../../../domains/preferences/types';
import { SettingsPlatform } from '../../components/shell/types';

describe( 'Settings bootstrap presentation state', () => {
	it( 'declares late-bound catalogs as observable own fields and retains the access bridge', async () => {
		const refresh = vi.fn().mockResolvedValue( null );
		const state = new SettingsPresentationState( refresh );
		expect( state.browserLanguage ).toBe( Language.ENGLISH );
		expect( state.platform ).toBe( SettingsPlatform.CHROME );
		expect( state.copy ).toBeUndefined();
		expect( state.editor ).toBeNull();
		expect( state.supportsCachedFavicons ).toBe( false );
		const render = vi.fn();
		const port = createPresentationPort( state, render );
		port.copy = TestEnglishLocalizationBundle.settingsShell;
		port.aboutCopy = TestEnglishLocalizationBundle.aboutCopy;
		await Promise.resolve();
		expect( render ).toHaveBeenCalledWith( expect.objectContaining( {
			copy: TestEnglishLocalizationBundle.settingsShell,
			aboutCopy: TestEnglishLocalizationBundle.aboutCopy,
		} ) );
		await expect( port.refreshAccessState() ).resolves.toBeNull();
		expect( refresh ).toHaveBeenCalledOnce();
	} );
} );
