import { readLocalDataGeneration } from '../../../../domains/local-data/services/local-data-generation';
import { OnboardingResetQueryParameter, type OnboardingResetCompletionOptions } from './types';

/**
 * Consumes a reset handoff only when durable metadata confirms that exact cleanup completed.
 * @param options - Current extension-page URL, history, and local reset metadata.
 * @return Whether this page should announce a completed reset once.
 * @since 0.1.0
 */
export async function consumeOnboardingResetCompletion( options: OnboardingResetCompletionOptions ): Promise<boolean> {
	try {
		const url = new URL( options.pageWindow.location.href );
		const generations = url.searchParams.getAll( OnboardingResetQueryParameter );
		if ( generations.length === 0 ) {
			return false;
		}
		url.searchParams.delete( OnboardingResetQueryParameter );
		options.pageWindow.history.replaceState( options.pageWindow.history.state, '', url.href );
		if ( generations.length !== 1 || ! generations[ 0 ] ) {
			return false;
		}
		const marker = await readLocalDataGeneration( options.storageArea );
		return marker?.generation === generations[ 0 ] && ! marker.pending;
	} catch {
		return false;
	}
}

export * from './types';
