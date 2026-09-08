import { BrowserChromeIconPath, type BrowserChromeIconProps, type BrowserChromeProps } from './types';

/**
 * Draws a decorative browser control with shared stroke geometry.
 * @param props - Catalog-owned vector path.
 * @param props.path - Geometry on the common 24-unit grid.
 * @return A non-interactive icon inheriting the browser chrome color.
 * @since 0.1.0
 */
function BrowserChromeIcon( { path }: BrowserChromeIconProps ) {
	return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
		strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
		<path d={ path } />
	</svg>;
}

/**
 * Frames the local scene with decorative browser chrome and drawn controls.
 * @param props - Illustrative tab and address labels.
 * @param props.title - Current scene title.
 * @param props.address - Local-only illustrative address.
 * @return Browser chrome excluded from assistive navigation.
 * @since 0.1.0
 */
export function BrowserChrome( { title, address }: BrowserChromeProps ) {
	return <div className="product-demo-browser-chrome" aria-hidden="true">
		<div className="product-demo-browser-tabs">
			<span className="product-demo-window-dots"><i /><i /><i /></span>
			<span className="product-demo-browser-tab">
				{ title } <span><BrowserChromeIcon path={ BrowserChromeIconPath.CLOSE } /></span>
			</span>
			<span><BrowserChromeIcon path={ BrowserChromeIconPath.ADD } /></span>
		</div>
		<div className="product-demo-address-row">
			<span><BrowserChromeIcon path={ BrowserChromeIconPath.BACK } /></span>
			<span><BrowserChromeIcon path={ BrowserChromeIconPath.FORWARD } /></span>
			<span><BrowserChromeIcon path={ BrowserChromeIconPath.RELOAD } /></span>
			<span className="product-demo-address">{ address }</span>
			<span><BrowserChromeIcon path={ BrowserChromeIconPath.MORE } /></span>
		</div>
	</div>;
}
