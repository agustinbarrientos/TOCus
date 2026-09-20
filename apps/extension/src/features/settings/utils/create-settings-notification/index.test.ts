import { describe, expect, it } from 'vitest';
import { SnackbarTone } from '@tocus/ui/types';
import { TestEnglishLocalizationBundle } from '../../../../localization/__fixtures__';
import { SettingsFeedbackAction } from '../../services/settings-feedback/types';
import { createSettingsNotification } from './index';

describe( 'createSettingsNotification', () => {
	it.each( [
		[ SettingsFeedbackAction.SAVED, 'Changes saved.', SnackbarTone.SUCCESS ],
		[ SettingsFeedbackAction.DISCARDED, 'Changes discarded.', SnackbarTone.INFO ],
		[ SettingsFeedbackAction.SITE_ADDED, 'Site added. Save to apply your changes.', SnackbarTone.INFO ],
		[ SettingsFeedbackAction.SITE_UPDATED, 'Site updated. Save to apply your changes.', SnackbarTone.INFO ],
		[ SettingsFeedbackAction.SITE_REMOVED, 'Site removed. Save to apply your changes.', SnackbarTone.INFO ],
		[ SettingsFeedbackAction.SITES_REMOVED, 'Selected websites removed. Save to apply.', SnackbarTone.INFO ],
		[ SettingsFeedbackAction.DUPLICATE_SITE, 'This site is already in your list.', SnackbarTone.INFO ],
	] as const )( 'maps %s to its completion or draft message and tone', ( action, message, tone ) => {
		expect( createSettingsNotification( action, TestEnglishLocalizationBundle.settingsShell ) )
			.toEqual( { message, tone } );
	} );

	it( 'uses the supplied active-language message for a confirmed save', () => {
		const copy = { ...TestEnglishLocalizationBundle.settingsShell, changesSaved: 'Cambios guardados.' };
		expect( createSettingsNotification( SettingsFeedbackAction.SAVED, copy ) ).toEqual( {
			message: 'Cambios guardados.', tone: SnackbarTone.SUCCESS,
		} );
	} );
} );
