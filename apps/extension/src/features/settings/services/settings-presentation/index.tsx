import { createRoot } from 'react-dom/client';
import { createPresentationPort } from '../../../../shared/utils/presentation-port';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import type { SettingsPageShell } from '../settings-page/types';
import { SettingsShell } from '../../components/shell';
import type { SettingsAccessReference } from '../../components/shell/types';
import { SettingsPresentationState } from './types';

/**
 * Prevents partially initialized localized state from reaching any destination component.
 * @param shell - Current immutable snapshot of the mutable page-service port.
 * @return Whether every required navigation and destination catalog is available.
 * @since 0.1.0
 */
function isSettingsReady( shell: Readonly<SettingsPageShell> ): boolean {
	return isLocalizationReady(
		shell.copy,
		shell.aboutCopy,
		shell.privacyCopy,
		shell.appearanceCopy,
		shell.languageCopy,
		shell.protectedSitesCopy,
		shell.protectedSiteItemCopy,
		shell.scheduleCopy,
		shell.statisticsCopy,
		shell.timingCopy,
	);
}

/**
 * Mounts an owned Settings React tree behind the existing two-phase page-service contract.
 * @param container - Extension-owned root receiving the complete localized Settings application.
 * @return Mutable shell whose controller assignments trigger coherent React snapshots.
 * @since 0.1.0
 */
export function mountSettings( container: HTMLElement ): SettingsPageShell {
	const root = createRoot( container );
	const accessRef: SettingsAccessReference = { current: unavailableAccess };

	/**
	 * Represents the absence of a mounted Protected Sites destination without querying permissions.
	 * @return Resolved null until the destination registers its real refresh operation.
	 * @since 0.1.0
	 */
	function unavailableAccess(): Promise<null> {
		return Promise.resolve( null );
	}

	/**
	 * Delegates permission refresh to the active destination instead of searching component internals.
	 * @return Latest access map, or null when the destination is unavailable.
	 * @since 0.1.0
	 */
	function refreshAccessState(): ReturnType<SettingsPageShell['refreshAccessState']> {
		return accessRef.current();
	}

	/**
	 * Renders only after bootstrap has supplied every required localized catalog.
	 * @param shell - Immutable controller snapshot produced by the shared presentation port.
	 * @since 0.1.0
	 */
	function renderSnapshot( shell: Readonly<SettingsPageShell> ): void {
		if ( isSettingsReady( shell ) ) {
			root.render( <SettingsShell shell={ shell } accessRef={ accessRef } /> );
		}
	}

	return createPresentationPort( new SettingsPresentationState( refreshAccessState ), renderSnapshot );
}

export * from './types';
