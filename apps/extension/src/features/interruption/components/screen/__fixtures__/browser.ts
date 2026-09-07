import { createTestI18n } from '../../../../../localization/__fixtures__/create-test-i18n';
import { createInterruptionCopy } from '../../../../../localization/utils/create-interruption-copy';
import { createProtectedPageLayerCopy } from '../../../../../localization/utils/create-protected-page-layer-copy';
import { ComponentProtectedPageLayer } from '../../protected-page-layer';
import { ComponentInterruptionScreen } from '..';
import { createManualInterruptionScreenEnvironment } from '.';
import { InterruptionContinueRequestEventName, InterruptionRetryRequestEventName, InterruptionScreenState } from '../types';
import { ThemeMode, Palette } from '../../../../../domains/preferences/types';
import './browser-types';

const environment = createManualInterruptionScreenEnvironment();
const i18n = createTestI18n();
const copy = createInterruptionCopy( i18n );
const injected = new URLSearchParams( location.search ).has( 'injected' );
const warning = new URLSearchParams( location.search ).has( 'warning' );
if ( ! injected ) {
	// The archived standalone runner loaded this bundled font globally before capturing components.
	// Host-page/CSP fixtures intentionally keep their original no-font environment.
	await import( './font.scss' );
	const fonts = await document.fonts.load( '600 2rem "Fredoka Variable"', 'TOCus' );
	if ( fonts.length === 0 ) {
		throw new Error( 'The standalone pause fixture requires the bundled Fredoka font.' );
	}
}
if ( injected ) {
	const hostileStyles = document.createElement( 'style' );
	hostileStyles.textContent = 'html {font-size:40px} button {font-size:99px!important;color:red!important} * {line-height:4}';
	if ( new URLSearchParams( location.search ).has( 'responsive' ) ) {
		hostileStyles.textContent += '@media(min-width:900px){html{font-size:20px}}';
	}
	document.head.append( hostileStyles );
}
if ( new URLSearchParams( location.search ).has( 'csp' ) ) {
	const policy = document.createElement( 'meta' );
	policy.httpEquiv = 'Content-Security-Policy';
	policy.content = "style-src 'none'; font-src 'none'; object-src 'none'";
	document.head.append( policy );
}
const layer = injected || warning ? new ComponentProtectedPageLayer() : null;
let screen: ComponentInterruptionScreen;
if ( layer ) {
	layer.copy = createProtectedPageLayerCopy( i18n );
	layer.interruptionCopy = copy;
	layer.interruptionLayerPresented = ! warning;
	layer.warningRemainingSeconds = warning ? 8 : null;
	document.querySelector<HTMLButtonElement>( '#website' )?.focus();
	document.body.append( layer );
	await layer.updateComplete;
	screen = layer.getInterruptionScreen();
} else {
	screen = new ComponentInterruptionScreen( environment );
	screen.copy = copy;
	screen.progressing = true;
	document.body.append( screen );
}
window.pauseFixture = {
	screen, layer, environment, continues: 0, retries: 0,
	states: InterruptionScreenState, themes: ThemeMode, palettes: Palette,
};
screen.addEventListener( InterruptionContinueRequestEventName, () => {
	window.pauseFixture.continues += 1;
} );
screen.addEventListener( InterruptionRetryRequestEventName, () => {
	window.pauseFixture.retries += 1;
} );
await screen.updateComplete;
document.documentElement.dataset.ready = 'true';
