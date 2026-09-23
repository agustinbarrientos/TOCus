/**
 * Document-owned icon displayed by the browser tab.
 * @since 1.0.0 Initial implementation.
 */
const favicon = document.querySelector<HTMLLinkElement>( 'link[rel="icon"]' );

if ( favicon !== null ) {
	/**
	 * Browser appearance independent of the document's selected theme and palette.
	 * @since 1.0.0 Initial implementation.
	 */
	const appearance = window.matchMedia( '(prefers-color-scheme: dark)' );

	/**
	 * Selects artwork that contrasts with the browser's requested appearance.
	 * @since 1.0.0 Initial implementation.
	 */
	const synchronizeFavicon = (): void => {
		favicon.href = appearance.matches ? '/icons/tab-light.png' : '/icons/tab-dark.png';
	};

	synchronizeFavicon();
	appearance.addEventListener( 'change', synchronizeFavicon );
}
