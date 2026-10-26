import { readInterruptionNavigationDestination } from '../../../../shared/utils/interruption-navigation-destination';
import { InterruptionDocumentPath } from '../../../../shared/utils/interruption-document-url';
import { isMatchingBrowserDocumentUrl } from '../../../../shared/utils/browser-document-url';
import type { NavigationRedirectOptions, NavigationRedirectRetainedHistory } from './types';

/**
 * Reads a destination retained by this extension's canonical pause history entry.
 * @param state - Untrusted state from the active browser-history entry.
 * @param currentUrl - Exact packaged pause document URL.
 * @return Valid retained HTTP(S) destination and bootstrap phase, or null for unrelated or malformed state.
 * @since 1.1.0
 */
function readHistoryNavigation( state: unknown, currentUrl: string ): NavigationRedirectRetainedHistory | null {
	if ( typeof state !== 'object' || state === null || ! ( 'tocusInterruptionNavigation' in state ) ) {
		return null;
	}

	const retained = state.tocusInterruptionNavigation;
	if ( typeof retained !== 'object' || retained === null ||
		! ( 'documentUrl' in retained ) || retained.documentUrl !== currentUrl ||
		! ( 'destination' in retained ) || typeof retained.destination !== 'string' ) {
		return null;
	}

	const destination = readInterruptionNavigationDestination(
		`${ currentUrl }#destination=${ retained.destination }`, currentUrl,
	);
	return destination === null ? null : {
		destination, pendingBootstrap: 'pendingBootstrap' in retained && retained.pendingBootstrap === true,
	};
}

/**
 * Resolves a navigation carrier before the ordinary interruption page authenticates or mounts.
 * @param options - Current location and extension runtime boundaries.
 * @return Whether navigation or a changed document prevents ordinary page bootstrap.
 * @since 1.0.0 Initial implementation.
 */
export async function resolveNavigationRedirect( options: NavigationRedirectOptions ): Promise<boolean> {
	const currentUrl = options.runtime.getURL( InterruptionDocumentPath.CURRENT );
	if ( options.location.href === currentUrl ) {
		const retained = readHistoryNavigation( options.history.state, currentUrl );
		if ( retained !== null ) {
			// Consume the authorized canonical reload once so its next history visit is revalidated.
			if ( options.recoverRetainedHistory !== true && retained.pendingBootstrap &&
				( options.navigationType === 'reload' || options.navigationType === undefined ) ) {
				options.history.replaceState( {
					tocusInterruptionNavigation: {
						documentUrl: currentUrl, destination: retained.destination, pendingBootstrap: false,
					},
				}, '', currentUrl );
				return false;
			}
			options.history.replaceState(
				options.history.state, '', `${ currentUrl }#destination=${ retained.destination }`,
			);
			options.location.reload();
			return true;
		}
	}
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

	if ( typeof url !== 'string' || ( url !== currentUrl && ! isMatchingBrowserDocumentUrl(
		carrierUrl, `${ currentUrl }#destination=${ url }`,
	) ) ) {
		throw new TypeError( 'Expected an authorized navigation redirect URL.' );
	}
	if ( url === currentUrl ) {
		const retainedDestination = 'retainedDestination' in response ? response.retainedDestination : destination;
		if ( typeof retainedDestination !== 'string' || ! isMatchingBrowserDocumentUrl(
			carrierUrl, `${ currentUrl }#destination=${ retainedDestination }`,
		) ) {
			throw new TypeError( 'Expected an authorized navigation redirect destination.' );
		}
		options.history.replaceState( {
			tocusInterruptionNavigation: {
				documentUrl: currentUrl, destination: retainedDestination, pendingBootstrap: true,
			},
		}, '', currentUrl );
		// Reload so runtime messages identify the canonical document, preserving its history state.
		options.location.reload();
		return true;
	}
	options.location.replace( url );

	return true;
}

export * from './types';
