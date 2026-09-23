import { readInterruptionNavigationDestination } from '../../../../shared/utils/interruption-navigation-destination';
import { InterruptionDocumentPath } from '../../../../shared/utils/interruption-document-url';
import type { NavigationRedirectOptions } from './types';

/**
 * Resolves a navigation carrier before the ordinary interruption page authenticates or mounts.
 * @param options - Current location and extension runtime boundaries.
 * @return Whether the current document is a navigation carrier owned by this handshake.
 * @since 1.0.0 Initial implementation.
 */
export async function resolveNavigationRedirect( options: NavigationRedirectOptions ): Promise<boolean> {
	const currentUrl = options.runtime.getURL( InterruptionDocumentPath.CURRENT );
	const carrierUrl = options.location.href;
	const destination = readInterruptionNavigationDestination( carrierUrl, currentUrl );

	if ( destination === null ) {
		return false;
	}

	const response: unknown = await options.runtime.sendMessage( { type: 'resolve-navigation-redirect' } );

	if ( options.location.href !== carrierUrl ) {
		return true;
	}
	if ( typeof response !== 'object' || response === null ) {
		throw new TypeError( 'Expected an authorized navigation redirect response.' );
	}

	const url = 'url' in response ? response.url : undefined;

	if ( url !== currentUrl && url !== destination ) {
		throw new TypeError( 'Expected an authorized navigation redirect URL.' );
	}
	options.location.replace( url );

	return true;
}

export * from './types';
