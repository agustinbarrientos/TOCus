import { createRoot } from 'react-dom/client';
import { TocusAppearance, TocusProvider } from '../../src';
import { SnackbarFixture } from './snackbar-controls';
import '../../src/components/provider/style.scss';
import '../../src/components/snackbar/style.scss';

const main = document.querySelector( 'main' );
if ( ! main ) {
	throw new Error( 'Missing snackbar fixture root.' );
}
createRoot( main ).render( <TocusProvider appearance={TocusAppearance.LIGHT}>
	<SnackbarFixture />
</TocusProvider> );
