import { ProtectedSiteCanonicalizationStatus } from '../../../../domains/protection/utils/protected-site-canonicalizer/types';
import { SitePermissionRequestStatus, SitePermissionReleaseStatus } from '../site-permission-manager/types';
import { ProtectedSiteEnrollmentStatus } from '../protected-site-enrollment/types';
import {
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	DefaultProtectionScopeId,
	ProtectionScopeIdSchema,
} from '../../../../domains/protection/types/protection-value';
import {
	ProtectedSiteConfigurationSetSchema,
	ProtectedSiteDisplayNameInputSchema,
	type ProtectedSiteConfiguration,
	type ProtectionConfigurationDocument,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	canonicalizeProtectedSite,
} from '../../../../domains/protection/utils/protected-site-canonicalizer';
import {
	createProtectedSiteEnrollmentService,
} from '../protected-site-enrollment';
import {
	resolveSiteDisplayIdentity,
} from '../../utils/site-display-name-resolver';
import {
	useDraft,
} from '../../../settings/services/settings-draft';
import {
	LoadState,
} from '../../../settings/components/recovery/types';
import type {
	WebsitesDraft,
	WebsitesScreenProps,
} from '../../components/screen/types';


/**
 * Coordinates a complete website draft with authoritative permission-aware enrollment.
 * @param props - Canonical editor, permission manager, localized feedback and service refresh port.
 * @return Observable website state and explicit stage/save/access actions.
 * @since 0.1.0
 */
export function useWebsitesState( props: WebsitesScreenProps ) {
	const { shell, register, accessRef } = props;
	const copy = shell.protectedSitesCopy;
	const state = useDraft<WebsitesDraft>( { sites: [], address: '' }, register );
	const { draft, value, saving, error } = state;
	const [ configuration, setConfiguration ] = useState<ProtectionConfigurationDocument | null>( null );
	const [ status, setStatus ] = useState<LoadState>( LoadState.LOADING );
	const [ independent, setIndependent ] = useState( false );
	const [ inputError, setInputError ] = useState<string | null>( null );
	const [ access, setAccess ] = useState<ReadonlyMap<string, boolean>>( new Map() );
	const [ pendingAccess, setPendingAccess ] = useState<string | null>( null );
	const [ accessMessage, setAccessMessage ] = useState<string | null>( null );
	const [ retained, setRetained ] = useState( false );
	const scopeIds = useRef( new Map<string, string>() );
	const generation = useRef( 0 );

	/**
	 * Refreshes visible access without replacing the unsaved website draft.
	 * @param config - Authoritative configuration to check, defaulting to the loaded baseline.
	 * @return Access map, or null if a newer read superseded this result.
	 */
	async function refresh( config = configuration ): Promise<ReadonlyMap<string, boolean> | null> {
		const request = ++generation.current;
		if ( ! config ) {
			return null;
		}
		const accessible = await shell.permissionManager?.filterConfiguration( config );
		if ( request !== generation.current ) {
			return null;
		}
		const identities = new Set( accessible?.sites.map( ( site ) => site.identityHost ) ?? [] );
		const snapshot = new Map( config.sites.map( ( site ) =>
			[ site.identityHost, identities.has( site.identityHost ) ] ) );
		setAccess( snapshot );
		return snapshot;
	}

	useEffect( () => {
		accessRef.current = () => refresh();
	}, [ configuration, shell.permissionManager ] );

	useEffect( () => {
		return () => {
			// A new baseline starts its own refresh; only disposal cancels that in-flight read.
			generation.current++;
			accessRef.current = () => Promise.resolve( null );
		};
	}, [ accessRef ] );

	/**
	 * Loads protected sites and their current browser access without repairing malformed data.
	 * @return Completion of the storage and access read.
	 */
	async function load(): Promise<void> {
		setStatus( LoadState.LOADING );
		try {
			const config = await shell.editor?.load();
			if ( config ) {
				setConfiguration( config );
				draft.adopt( { sites: config.sites, address: '' } );
				await refresh( config );
				setStatus( LoadState.READY );
			} else {
				setStatus( config === null ? LoadState.MALFORMED : LoadState.FAILED );
			}
		} catch {
			setStatus( LoadState.FAILED );
		}
	}
	useEffect( () => {
		void load();
	}, [ shell.editor ] );

	/**
	 * Replaces the page draft and clears feedback belonging to older values.
	 * @param next - Complete next staged website set and pending address.
	 */
	function change( next: WebsitesDraft ): void {
		draft.change( next );
		setInputError( null );
		setAccessMessage( null );
		setRetained( false );
	}

	/**
	 * Canonicalizes an address into the page draft without requesting browser access.
	 * @return Staged complete draft, or null for invalid input.
	 */
	function stage(): WebsitesDraft | null {
		if ( ! shell.editor || saving ) {
			return null;
		}
		const scopeInput = independent ? shell.editor.createIndependentScopeId() : DefaultProtectionScopeId;
		const scope = ProtectionScopeIdSchema.safeParse( scopeInput );
		const scopeConflict = scope.success && independent && ( scope.data === DefaultProtectionScopeId
			|| value.sites.some( ( site ) => site.rule.scopeId === scope.data ) );
		if ( ! scope.success || scopeConflict ) {
			setInputError( 'invalid-scope-id' );
			return null;
		}
		const canonical = canonicalizeProtectedSite( value.address, scope.data );
		if ( canonical.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			setInputError( 'invalid-site' );
			return null;
		}
		const sites = ProtectedSiteConfigurationSetSchema.safeParse( [
			...value.sites, { identityHost: canonical.identityHost, rule: canonical.rule },
		] );
		if ( ! sites.success ) {
			setInputError( 'already-protected' );
			return null;
		}
		const next = { sites: sites.data, address: '' };
		change( next );
		setIndependent( false );
		return next;
	}

	/** Requests browser access synchronously from Save before committing the complete site set. */
	function save(): void {
		if ( ! configuration || ! shell.editor || ! shell.permissionManager || saving ) {
			return;
		}
		if ( value.address.trim() && ! stage() ) {
			return;
		}
		const service = createProtectedSiteEnrollmentService( {
			editor: shell.editor, permissionManager: shell.permissionManager,
		} );
		// No awaited work may precede saveDraft: Firefox requires the original Save gesture.
		void draft.save( async ( next ) => {
			const result = await service.saveDraft( configuration.sites, next.sites );
			if ( result.status !== ProtectedSiteEnrollmentStatus.SAVED ) {
				throw new Error( result.status === ProtectedSiteEnrollmentStatus.REJECTED
					? result.reason : result.status );
			}
			setConfiguration( result.configuration );
			scopeIds.current.clear();
			setRetained( result.permissionReleaseStatus !== SitePermissionReleaseStatus.RELEASED );
			await refresh( result.configuration ).catch( () => null );
			return { sites: result.configuration.sites, address: '' };
		} );
	}

	/**
	 * Stages display-name and independent behavior changes without persistence.
	 * @param site - Current row being edited.
	 * @param name - Raw typed name, including spaces not yet followed by another character.
	 * @param separate - Whether the site uses its own timer and schedule.
	 */
	function updateSite( site: ProtectedSiteConfiguration, name: string, separate: boolean ): void {
		const displayName = ProtectedSiteDisplayNameInputSchema.safeParse( name );
		if ( ! displayName.success ) {
			setInputError( 'invalid-display-name' );
			return;
		}
		let scope = site.rule.scopeId;
		if ( ! separate ) {
			if ( scope !== DefaultProtectionScopeId ) {
				scopeIds.current.set( site.identityHost, scope );
			}
			scope = DefaultProtectionScopeId;
		} else if ( scope === DefaultProtectionScopeId ) {
			const candidateInput = scopeIds.current.get( site.identityHost )
				?? shell.editor?.createIndependentScopeId();
			const candidate = ProtectionScopeIdSchema.safeParse( candidateInput );
			const conflict = candidate.success && ( candidate.data === DefaultProtectionScopeId
				|| value.sites.some( ( other ) => other.rule.scopeId === candidate.data ) );
			if ( ! candidate.success || conflict ) {
				setInputError( 'invalid-scope-id' );
				return;
			}
			scope = candidate.data;
		}
		const replacement = { identityHost: site.identityHost, rule: { ...site.rule, scopeId: scope },
			...( displayName.data ? { displayNameOverride: name } : {} ) };
		change( { ...value,
			sites: value.sites.map( ( other ) => other.identityHost === site.identityHost ? replacement : other ),
		} );
	}

	/**
	 * Requests complete website access directly from the row's explicit recovery gesture.
	 * @param site - Authoritative website whose access is missing.
	 */
	function grant( site: ProtectedSiteConfiguration ): void {
		if ( ! shell.permissionManager || pendingAccess || saving ) {
			return;
		}
		const request = shell.permissionManager.request( site.rule );
		setPendingAccess( site.identityHost );
		setInputError( null );
		void request.then( async ( result ) => {
			if ( result.status !== SitePermissionRequestStatus.GRANTED ) {
				setInputError( 'access-request' );
				return;
			}
			const refreshed = await refresh();
			if ( refreshed?.get( site.identityHost ) ) {
				setAccessMessage( copy.formatAccessRestoredAnnouncement( resolveSiteDisplayIdentity( site ).name ) );
			} else {
				setInputError( 'access-request' );
			}
		} ).catch( () => {
			setInputError( 'access-request' );
		} ).finally( () => {
			setPendingAccess( null );
		} );
	}

	const errors: Record<string, string> = {
		'invalid-site': copy.invalidSiteError, 'already-protected': copy.alreadyProtectedError,
		'invalid-scope-id': copy.invalidScopeError, 'invalid-display-name': copy.invalidDisplayNameError,
		'invalid-configuration': copy.invalidConfigurationError, 'site-not-found': copy.siteNotFoundError,
		'sites-changed': copy.configurationChangedError, 'permission-denied': copy.permissionDeniedError,
		'permission-error': copy.permissionRequestError, 'permission-retained': copy.permissionRetainedError,
		'access-request': shell.protectedSiteItemCopy.accessRequestError,
	};
	const issue = inputError ?? error;
	const addressError = inputError === 'invalid-site' || inputError === 'already-protected'
		? errors[ inputError ] ?? copy.invalidSiteError : null;
	return { ...state, configuration, status, independent, access, pendingAccess, accessMessage, retained,
		addressError, errorMessage: issue && ! addressError ? errors[ issue ] ?? copy.saveError : null,
		change, load, save, stage, updateSite, grant, setIndependent };
}
