import { createRoot } from 'react-dom/client';
import { TocusAppearance, TocusProvider, createShadowStyleSheet } from '../../src';
import { SnackbarFixture } from './snackbar-controls';
import styles from '../../src/styles.scss?inline';
import notificationStyles from '../../src/notifications.scss?inline';

for ( const id of [ 'first-shadow', 'second-shadow' ] ) {
	const host = document.getElementById( id );
	if ( ! host ) {
		throw new Error( 'Missing owned snackbar shadow host.' );
	}
	const shadowRoot = host.attachShadow( { mode: 'open' } );
	shadowRoot.adoptedStyleSheets = [ createShadowStyleSheet( styles ), createShadowStyleSheet( notificationStyles ) ];
	const content = document.createElement( 'main' );
	const portals = document.createElement( 'aside' );
	portals.setAttribute( 'data-owned-portals', '' );
	shadowRoot.append( content, portals );
	createRoot( content ).render( <TocusProvider shadowRoot={shadowRoot} portalTarget={portals}
		appearance={TocusAppearance.LIGHT}>
		<SnackbarFixture />
	</TocusProvider> );
}
