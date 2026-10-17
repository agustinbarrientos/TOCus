import { Anchor, Icon, IconName } from '@tocus/ui';
import { Page } from '../page';
import type { SettingsScreenProps } from '../page/types';
import './style.scss';

/**
 * Explains local storage, tracking boundaries and browser access without data-management actions.
 * @param props - Canonical privacy content and browser capabilities.
 * @return Read-only privacy disclosures and browser-permission explanations.
 * @since 1.0.0
 */
export function Privacy( props: SettingsScreenProps ) {
	const { privacyCopy: copy, supportsCachedFavicons } = props.shell;
	const permissions = [ copy.websitePermission, copy.toolbarPermission, copy.navigationPermission,
		copy.localToolsPermission, ...( supportsCachedFavicons ? [ copy.faviconPermission ] : [] ) ];
	return <Page title={ copy.title }>
		<section className="tocus-section">
			<h2>{ copy.storedTitle }</h2>
			<p>{ copy.storedSummary }</p>
			<p>{ copy.storedDescription }</p>
			<p>{ copy.statisticsPrivacy }</p>
			<p>{ copy.offlinePrivacy }</p>
			<p>{ copy.recoveryPrivacy }</p>
			<p className="settings-privacy-source">
				{ copy.trustPrivacy }{ ' ' }
				<Anchor className="tocus-external-link" href="https://github.com/agustinbarrientos/TOCus"
					target="_blank" rel="noopener noreferrer">
					{ copy.sourcePrivacy }<Icon name={ IconName.ARROW_UP_RIGHT_FROM_SQUARE } />
				</Anchor>
			</p>
		</section>
		<section className="tocus-section settings-privacy-permissions">
			<h2>{ copy.permissionsTitle }</h2>
			<ul>{ permissions.map( ( permission ) => <li key={ permission }>{ permission }</li> ) }</ul>
			<p>{ copy.deniedPermission }</p>
		</section>
	</Page>;
}
