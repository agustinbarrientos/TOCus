import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TocusAppearance, TocusPalette, TocusProvider } from '@tocus/ui';
import '@tocus/ui/styles.scss';
import '../../../../../entrypoints/options/styles.scss';
import '../../page/style.scss';
import { PersistedWebsiteItem } from '../../../../protected-sites/components/persisted-site-item';
import { createEnglishLocalizationBundle } from '../../../../../localization';
import { ProtectedSiteConfigurationSchema,
	type ProtectionConfigurationDocument } from '../../../../../domains/protection/types/protected-site-configuration';
import { originalConfiguration } from './original-settings';
import { stageOriginalSiteItemError } from './original-site-item';
import './original-settings.scss';

const params = new URLSearchParams( location.search );
document.body.classList.add( 'original-settings-document' );
const name = params.get( 'original' ) ?? '';
const appearance = name.includes( 'dark' ) ? TocusAppearance.DARK : TocusAppearance.LIGHT;
document.documentElement.style.colorScheme = appearance;
const configuration = originalConfiguration( name );
const initialSite = ProtectedSiteConfigurationSchema.parse( configuration.sites[ 0 ] );
const copy = createEnglishLocalizationBundle().protectedSiteItem;

/**
 * Exercises the original standalone contract, including its real missing-editor failure boundary.
 * @return Production item presentation with observable access and configuration owners.
 */
function OriginalWebsiteItem() {
	const [ site, setSite ] = useState( initialSite );
	const [ accessRequired, setAccessRequired ] = useState( name.includes( 'access-required' ) );
	const [ removed, setRemoved ] = useState( false );
	/**
	 * Adopts the exact configured identity after the production controller reports a successful save.
	 * @param next - Authoritative configuration returned by the existing editor.
	 */
	function saved( next: ProtectionConfigurationDocument ): void {
		const replacement = next.sites.find( ( candidate ) => candidate.identityHost === site.identityHost );
		if ( replacement ) {
			setSite( replacement );
		}
	}
	return <TocusProvider transparent appearance={ appearance }
		palette={ TocusPalette.BROWN }>
		<main className="settings-page" style={ { width: Number( params.get( 'width' ) ?? 736 ) } }>
			{ ! removed && <PersistedWebsiteItem site={ site } editor={ null } onSaved={ saved } copy={ copy }
				favicon={ null } disabled={ false } accessRequired={ accessRequired } accessPending={ false }
				accessDisabled={ false } onGrant={ () => {
					setAccessRequired( false );
				} } onRemove={ () => {
					setRemoved( true );
				} } /> }
		</main>
	</TocusProvider>;
}

const root = document.getElementById( 'settings-root' );
if ( ! root ) {
	throw new TypeError( 'The standalone item fixture requires its mount element.' );
}
stageOriginalSiteItemError( root, name );
createRoot( root ).render( <OriginalWebsiteItem /> );
