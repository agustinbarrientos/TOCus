import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TocusAppearance, TocusPalette, TocusProvider } from '@tocus/ui';
import '@tocus/ui/styles.scss';
import '../../../../../entrypoints/options/styles.scss';
import '../../page/style.scss';
import { WebsiteList } from '../../../../protected-sites/components/site-list';
import { PersistedWebsiteItem } from '../../../../protected-sites/components/persisted-site-item';
import { createEnglishLocalizationBundle } from '../../../../../localization';
import type { ProtectedSiteConfiguration } from '../../../../../domains/protection/types/protected-site-configuration';
import { originalConfiguration } from './original-settings';
import './original-settings.scss';

const params = new URLSearchParams( location.search );
document.body.classList.add( 'original-settings-document' );
const name = params.get( 'original' ) ?? '';
const appearance = name.includes( 'dark' ) ? TocusAppearance.DARK : TocusAppearance.LIGHT;
document.documentElement.style.colorScheme = appearance;
const copy = createEnglishLocalizationBundle();

/**
 * Owns standalone list state while retaining each item's real persisted-editor boundary.
 * @return The same grouped list used by Settings, without unrelated page framing.
 */
function OriginalWebsiteList() {
	const [ configuration, setConfiguration ] = useState( originalConfiguration( name ) );
	const [ granted, setGranted ] = useState( new Set( configuration.sites.map( ( site ) => site.identityHost ) ) );
	/**
	 * Connects a standalone item to the fixture's observable configuration and access owners.
	 * @param site - Current grouped website identity.
	 * @return Actual item presentation with its missing-editor failure behavior preserved.
	 */
	function renderSite( site: ProtectedSiteConfiguration ) {
		return <PersistedWebsiteItem key={ site.identityHost } site={ site } editor={ null }
			onSaved={ setConfiguration } copy={ copy.protectedSiteItem } favicon={ null } disabled={ false }
			accessRequired={ ! granted.has( site.identityHost ) } accessPending={ false } accessDisabled={ false }
			onGrant={ () => {
				setGranted( new Set( granted ).add( site.identityHost ) );
			} }
			onRemove={ () => {
				setConfiguration( { ...configuration,
					sites: configuration.sites.filter( ( candidate ) => candidate.identityHost !== site.identityHost ),
				} );
			} } />;
	}
	return <TocusProvider transparent appearance={ appearance } palette={ TocusPalette.BROWN }>
		<main className="settings-page" style={ { width: Number( params.get( 'width' ) ?? 736 ) } }>
			<WebsiteList sites={ configuration.sites } copy={ copy.protectedSites } renderItem={ renderSite } />
		</main>
	</TocusProvider>;
}

const root = document.getElementById( 'settings-root' );
if ( ! root ) {
	throw new TypeError( 'The standalone list fixture requires its mount element.' );
}
createRoot( root ).render( <OriginalWebsiteList /> );
