import type { MouseEvent } from 'react';
import { useSettingsNavigation } from '../../services/settings-navigation';
import { Brand, Icon, IconName, NavLink, TocusProvider } from '@tocus/ui';
import { useDocumentAppearance } from '../../../preferences/services/document-appearance';
import {
	SettingsDestination,
	type SettingsShellCopy,
} from './types';
import { Confirmation } from '../confirmation';
import { Timing } from '../timing-screen';
import { ScheduleScreen } from '../schedule-screen';
import { Preferences } from '../preferences-screen';
import { Websites } from '../../../protected-sites/components/screen';
import { About } from '../about-screen';
import { Privacy } from '../privacy-screen';
import { Statistics } from '../../../statistics/components/settings-screen';
import type {
	SettingsDestinationProperties,
	SettingsNavigationItem,
	SettingsShellProperties,
} from './types';

/**
 * Creates navigation items from canonical destinations, localized labels, and shared icons.
 * @param copy - Current Settings navigation messages.
 * @return Eight destinations in their approved navigation order.
 * @since 0.1.0
 */
function getNavigationItems( copy: Readonly<SettingsShellCopy> ): readonly SettingsNavigationItem[] {
	return [
		{ id: SettingsDestination.PROTECTED_SITES, name: copy.protectedSites, icon: IconName.LIST },
		{ id: SettingsDestination.SCHEDULE, name: copy.schedule, icon: IconName.CALENDAR_CLOCK },
		{ id: SettingsDestination.TIMING, name: copy.timing, icon: IconName.STOPWATCH },
		{ id: SettingsDestination.APPEARANCE, name: copy.appearance, icon: IconName.PALETTE },
		{ id: SettingsDestination.LANGUAGE, name: copy.language, icon: IconName.LETTERS },
		{ id: SettingsDestination.STATISTICS, name: copy.statistics, icon: IconName.CHART_COLUMN },
		{ id: SettingsDestination.PRIVACY, name: copy.privacy, icon: IconName.SHIELD_HALVED },
		{ id: SettingsDestination.ABOUT, name: copy.about, icon: IconName.HEART },
	];
}

/**
 * Mounts one Settings destination with the service dependencies it already consumes.
 * @param properties - Accepted destination, loaded shell, and guard/access bridges.
 * @return Selected Settings page.
 * @since 0.1.0
 */
function SettingsDestinationContent( properties: SettingsDestinationProperties ) {
	const { destination, shell, register, accessRef } = properties;
	switch ( destination ) {
		case SettingsDestination.TIMING:
			return <Timing shell={ shell } register={ register } />;
		case SettingsDestination.SCHEDULE:
			return <ScheduleScreen shell={ shell } register={ register } />;
		case SettingsDestination.APPEARANCE:
			return <Preferences shell={ shell } register={ register } />;
		case SettingsDestination.LANGUAGE:
			return <Preferences shell={ shell } register={ register } language />;
		case SettingsDestination.STATISTICS:
			return <Statistics shell={ shell } />;
		case SettingsDestination.PRIVACY:
			return <Privacy shell={ shell } />;
		case SettingsDestination.ABOUT:
			return <About shell={ shell } />;
		case SettingsDestination.PROTECTED_SITES:
			return <Websites shell={ shell } register={ register } accessRef={ accessRef } />;
	}
}

/**
 * Composes shared navigation, guarded destination content, and one discard confirmation.
 * @param properties - Loaded page-service contract and current access-refresh bridge.
 * @return One Settings React tree using the shared appearance observer and UI provider.
 * @since 0.1.0
 */
export function SettingsShell( properties: SettingsShellProperties ) {
	const { shell, accessRef } = properties;
	const theme = useDocumentAppearance();
	const navigation = useSettingsNavigation();
	const items = getNavigationItems( shell.copy );

	/**
	 * Routes a navigation click through draft protection before changing browser history.
	 * @param event - Click on a packaged navigation anchor.
	 * @since 0.1.0
	 */
	function handleNavigation( event: MouseEvent<HTMLAnchorElement> ): void {
		event.preventDefault();
		navigation.navigate( event.currentTarget.hash, event.currentTarget );
	}

	/**
	 * Begins the confirmed discard while leaving asynchronous draft ownership with its page.
	 * @since 0.1.0
	 */
	function handleDiscard(): void {
		void navigation.discard();
	}

	return (
		<TocusProvider { ...theme }>
			<div className="settings-layout">
				<aside className="settings-navigation">
					<Brand />
					<nav aria-label={ shell.copy.navigationLabel }>
						{ items.map( ( item ) => (
							<NavLink
								key={ item.id }
								component="a"
								href={ `#${ item.id }` }
								active={ navigation.destination === item.id }
								aria-current={ navigation.destination === item.id ? 'page' : undefined }
								label={ item.name }
								leftSection={ <Icon name={ item.icon } /> }
								onClick={ handleNavigation }
							/>
						) ) }
					</nav>
				</aside>
				<div className="settings-content" key={ navigation.destination }>
					<SettingsDestinationContent
						destination={ navigation.destination }
						shell={ shell }
						register={ navigation.register }
						accessRef={ accessRef }
					/>
				</div>
				<Confirmation
					opened={ navigation.pending !== null }
					title={ shell.copy.unsavedChangesTitle }
					description={ shell.copy.unsavedChangesDescription }
					cancel={ shell.copy.stay }
					confirm={ shell.copy.discard }
					onCancel={ navigation.stay }
					onConfirm={ handleDiscard }
				/>
			</div>
		</TocusProvider>
	);
}

export * from './types';
