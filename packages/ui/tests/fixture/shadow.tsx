import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, TocusAppearance, TocusProvider, createShadowStyleSheet } from '../../src';
import styles from '../../src/styles.scss?inline';

const host = document.getElementById( 'shadow-host' );
if ( ! host ) {
	throw new Error( 'Missing owned shadow fixture host.' );
}
const root = host.attachShadow( { mode: 'open' } );
root.adoptedStyleSheets = [ createShadowStyleSheet( styles ) ];

/**
 * Exercises both initial and React-updated Mantine inline dimension props under host CSP.
 * @return Packaged controls with explicit rem dimensions inside an owned provider.
 */
function ShadowFixture() {
	const [ changed, setChanged ] = useState( false );
	return <TocusProvider shadowRoot={root} appearance={TocusAppearance.LIGHT} reducedMotion>
		<Button size={changed ? '3rem' : '2rem'} radius=".5rem" style={{ width: changed ? '12rem' : '10rem' }}
			onClick={() => {
				setChanged( true );
			}}>Change dimensions</Button>
		<Alert color="red" p={changed ? '2rem' : '1.25rem'} radius=".5rem">Could not save</Alert>
		{changed && <Alert color="green" p="1rem" role="note">New notice</Alert>}
	</TocusProvider>;
}

createRoot( root ).render( <ShadowFixture /> );
