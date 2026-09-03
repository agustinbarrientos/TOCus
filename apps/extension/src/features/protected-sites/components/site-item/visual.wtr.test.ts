import { assert, fixture, html } from '@open-wc/testing';
import { emulateMedia } from '@web/test-runner-commands';
import { visualDiff } from '@web/test-runner-visual-regression';
import { type ProtectionConfigurationDocument } from '../../../../domains/protection/types/protected-site-configuration';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import {
	SitePermissionGrantProvenance,
	SitePermissionReleaseStatus,
	SitePermissionRequestStatus,
	type SitePermissionManager,
} from '../../services/site-permission-manager';
import './index';
import { type ComponentProtectedSiteItem } from './index';

/** Protected-site configuration rendered by focused visual fixtures. */
const VISUAL_SITE = {
	identityHost: 'www.instagram.com',
	rule: {
		host: 'instagram.com',
		includeSubdomains: true,
		scopeId: DefaultProtectionScopeId,
	},
};

/** Local display identity rendered by focused visual fixtures. */
const VISUAL_IDENTITY = {
	name: 'Instagram',
	monogram: 'I',
	colorIndex: 2,
};

/**
 * Grants one configured site in visual fixtures.
 * @return Successful existing-permission result.
 * @since 0.1.0 Initial implementation.
 */
function requestSitePermission(): ReturnType<SitePermissionManager[ 'request' ]> {
	return Promise.resolve( {
		status: SitePermissionRequestStatus.GRANTED,
		provenance: SitePermissionGrantProvenance.EXISTING,
	} );
}

/**
 * Releases one configured site in visual fixtures.
 * @return Successful permission-release result.
 * @since 0.1.0 Initial implementation.
 */
function releaseSitePermission(): ReturnType<SitePermissionManager[ 'release' ]> {
	return Promise.resolve( SitePermissionReleaseStatus.RELEASED );
}

/**
 * Returns the supplied configuration unchanged in visual fixtures.
 * @param configuration - Validated persisted configuration.
 * @return Unchanged configuration.
 * @since 0.1.0 Initial implementation.
 */
function filterPermissionConfiguration(
	configuration: ProtectionConfigurationDocument,
): Promise<ProtectionConfigurationDocument> {
	return Promise.resolve( configuration );
}

/**
 * Reports complete browser access in focused visual fixtures.
 * @return True for the deterministic granted-access fixture.
 * @since 0.1.0 Initial implementation.
 */
function hasSiteAccess(): Promise<boolean> {
	return Promise.resolve( true );
}

/** Browser permission manager used by focused site-item visual fixtures. */
const PERMISSION_MANAGER: SitePermissionManager = {
	filterConfiguration: filterPermissionConfiguration,
	hasAccess: hasSiteAccess,
	request: requestSitePermission,
	release: releaseSitePermission,
};

/**
 * Configures one deterministic explicit appearance for a visual case.
 * @param theme - Explicit light or dark appearance.
 * @return Promise resolved after browser media emulation is applied.
 * @since 0.1.0 Initial implementation.
 */
async function configureAppearance( theme: 'light' | 'dark' ): Promise<void> {
	document.documentElement.setAttribute( 'data-tocus-palette', 'brown' );
	document.documentElement.setAttribute( 'data-tocus-theme', theme );
	await emulateMedia( {
		colorScheme: theme,
		forcedColors: 'none',
		reducedMotion: 'reduce',
	} );
}

describe( 'tocus-f-protected-site-item visual', () => {
	before( async () => {
		const loadedFonts = await document.fonts.load( '600 1rem "Fredoka Variable"', 'Instagram' );

		assert.isAbove( loadedFonts.length, 0 );
	} );

	afterEach( () => {
		document.documentElement.removeAttribute( 'data-tocus-palette' );
		document.documentElement.removeAttribute( 'data-tocus-theme' );
	} );

	for ( const theme of [ 'light', 'dark' ] as const ) {
		it( `matches the access-required state in the ${ theme } appearance`, async () => {
			await configureAppearance( theme );
			const element = await fixture<ComponentProtectedSiteItem>( html`
				<tocus-f-protected-site-item
					style="width: 46rem;"
					.site=${ VISUAL_SITE }
					.identity=${ VISUAL_IDENTITY }
					.accessGranted=${ false }
					.permissionManager=${ PERMISSION_MANAGER }
				></tocus-f-protected-site-item>
			` );

			assert.isTrue( element.isConnected );
			await visualDiff( element, `protected-site-item-access-required-${ theme }` );
		} );

		it( `matches the inline operation error in the ${ theme } appearance`, async () => {
			await configureAppearance( theme );
			const element = await fixture<ComponentProtectedSiteItem>( html`
				<tocus-f-protected-site-item
					style="width: 46rem;"
					.site=${ VISUAL_SITE }
					.identity=${ VISUAL_IDENTITY }
				></tocus-f-protected-site-item>
			` );
			const editAction = element.shadowRoot?.querySelector( '.edit-action' );

			assert.instanceOf( editAction, HTMLButtonElement );
			if ( ! ( editAction instanceof HTMLButtonElement ) ) {
				throw new TypeError( 'Expected the visual site item to render Edit.' );
			}
			editAction.click();
			await element.updateComplete;
			const form = element.shadowRoot?.querySelector( 'form' );

			assert.instanceOf( form, HTMLFormElement );
			if ( ! ( form instanceof HTMLFormElement ) ) {
				throw new TypeError( 'Expected the visual site item to render its editor.' );
			}
			form.requestSubmit();
			await element.updateComplete;

			await visualDiff( element, `protected-site-item-operation-error-${ theme }` );
		} );
	}
} );
