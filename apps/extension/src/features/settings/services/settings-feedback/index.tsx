import { createContext, useCallback, useContext, useMemo } from 'react';
import { SnackbarProvider, useSnackbar } from '@tocus/ui';
import type { SettingsFeedbackAction, SettingsFeedback, SettingsFeedbackProviderProps } from './types';
import { createSettingsNotification } from '../../utils/create-settings-notification';

/** Shares confirmed settings outcomes across destination changes. */
const SettingsFeedbackContext = createContext<SettingsFeedback | null>( null );

/**
 * Maps destination actions to localized messages within the shared snackbar provider.
 * @param props - Current copy and persistent settings content.
 * @return Stable settings feedback context.
 */
function SettingsFeedbackBridge( props: SettingsFeedbackProviderProps ) {
	const { copy, children } = props;
	const { show } = useSnackbar();
	/**
	 * Announces one confirmed action without conflating staged edits with persistence.
	 * @param action - Outcome produced by the owning settings controller.
	 */
	const notify = useCallback( ( action: SettingsFeedbackAction ): void => {
		show( createSettingsNotification( action, copy ) );
	}, [ copy, show ] );
	const feedback = useMemo( () => ( { notify } ), [ notify ] );
	return <SettingsFeedbackContext.Provider value={ feedback }>{ children }</SettingsFeedbackContext.Provider>;
}

/**
 * Keeps settings notifications mounted while the selected destination changes.
 * @param props - Localized shell labels and all settings destinations.
 * @return Settings action feedback backed by the shared snackbar provider.
 * @since 0.1.0
 */
export function SettingsFeedbackProvider( props: SettingsFeedbackProviderProps ) {
	return <SnackbarProvider closeLabel={ props.copy.dismissNotification }>
		<SettingsFeedbackBridge { ...props } />
	</SnackbarProvider>;
}

/**
 * Reads the stable settings action notification boundary.
 * @return Current shell's localized feedback service.
 * @since 0.1.0
 */
export function useSettingsFeedback(): SettingsFeedback {
	const feedback = useContext( SettingsFeedbackContext );
	if ( feedback === null ) {
		throw new Error( 'Settings feedback requires its provider.' );
	}
	return feedback;
}

export * from './types';
