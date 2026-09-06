import { type WebsiteAccessRevocationApi } from './types';

/**
 * Revokes every actual website grant and optional live-navigation capability, including orphaned grants.
 * @param permissions - Browser inventory and optional-permission removal operations.
 * @return Whether no website or optional navigation access remains.
 * @since 0.1.0 Initial implementation.
 */
export async function revokeWebsiteAccess( permissions: WebsiteAccessRevocationApi ): Promise<boolean> {
	const granted = await permissions.getAll();
	const origins = granted.origins ?? [];
	const navigation = granted.permissions?.includes( 'webNavigation' ) ?? false;
	if ( origins.length === 0 && ! navigation ) {
		return true;
	}
	if ( ! await permissions.remove( { origins, permissions: navigation ? [ 'webNavigation' ] : [] } ) ) {
		return false;
	}
	const remaining = await permissions.getAll();
	return ( remaining.origins?.length ?? 0 ) === 0 && ! remaining.permissions?.includes( 'webNavigation' );
}

export * from './types';
