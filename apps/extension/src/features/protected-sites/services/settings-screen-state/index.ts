import { DraftSaveResult } from '../../../settings/utils/draft-controller/types';
import { createWebsiteDetails, createWebsiteDraft, serializeWebsiteDraft } from '../../utils/website-draft';
import { useSettingsFeedback } from '../../../settings/services/settings-feedback';
import { SettingsFeedbackAction } from '../../../settings/services/settings-feedback/types';
import type { DuplicateSiteNotice } from './types';
import type { WebsitesDraft, WebsiteDetailsDraft } from '../../utils/website-draft/types';
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
} from '../../../../domains/protection/types/protection-value';
import {
	ProtectedSiteConfigurationSetSchema,
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
	WebsitesScreenProps,
} from '../../components/screen/types';


/**
 * Coordinates a complete website draft with authoritative permission-aware enrollment.
 * @param props - Canonical editor, permission manager, localized feedback and service refresh port.
 * @return Observable website state and explicit stage/save/access actions.
 * @since 1.0.0
 */
export function useWebsitesState( props: WebsitesScreenProps ) {
	const { shell, register, accessRef } = props;
	const copy = shell.protectedSitesCopy;
	const { notify } = useSettingsFeedback();
	const state = useDraft<WebsitesDraft>( createWebsiteDraft( [] ), register, save );
	const { draft, value, saving, error } = state;
	const [ configuration, setConfiguration ] = useState<ProtectionConfigurationDocument | null>( null );
	const [ status, setStatus ] = useState<LoadState>( LoadState.LOADING );
	const [ validate, setValidate ] = useState( false );
	const [ inputError, setInputError ] = useState<string | null>( null );
	const [ access, setAccess ] = useState<ReadonlyMap<string, boolean>>( new Map() );
	const [ pendingAccess, setPendingAccess ] = useState<string | null>( null );
	const [ accessMessage, setAccessMessage ] = useState<string | null>( null );
	const [ retained, setRetained ] = useState( false );
	const [ duplicate, setDuplicate ] = useState<DuplicateSiteNotice | null>( null );
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
				draft.adopt( createWebsiteDraft( config.sites ) );
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
		draft.change( { ...next,
			newSite: next.address.trim() ? next.newSite : { displayName: '', schedule: null },
		} );
		setInputError( null );
		setAccessMessage( null );
		setRetained( false );
	}

	/**
	 * Canonicalizes an address into the page draft without requesting browser access.
	 * @param savingDraft - Allows an unchanged, already-listed address to be ignored during Save.
	 * @return Staged complete draft, or null for invalid input.
	 */
	function stage( savingDraft = false ): WebsitesDraft | null {
		if ( ! shell.editor || saving ) {
			return null;
		}
		const canonical = canonicalizeProtectedSite( value.address, DefaultProtectionScopeId );
		if ( canonical.status === ProtectedSiteCanonicalizationStatus.REJECTED ) {
			setInputError( 'invalid-site' );
			return null;
		}
		const alreadyListed = value.sites.find( ( site ) => site.rule.host === canonical.rule.host
			&& site.rule.includeSubdomains === canonical.rule.includeSubdomains );
		if ( savingDraft && alreadyListed && ! value.newSite.displayName.trim() && value.newSite.schedule === null ) {
			// Repeating an address must not block other edits or overwrite the existing site's details.
			const next = { ...value, address: '' };
			change( next );
			return next;
		}
		if ( alreadyListed ) {
			setInputError( null );
			setDuplicate( { identityHost: alreadyListed.identityHost } );
			notify( SettingsFeedbackAction.DUPLICATE_SITE );
			return null;
		}
		const sites = ProtectedSiteConfigurationSetSchema.safeParse( [
			...value.sites, { identityHost: canonical.identityHost, rule: canonical.rule },
		] );
		if ( ! sites.success ) {
			setInputError( 'already-protected' );
			return null;
		}
		const next: WebsitesDraft = { ...value, sites: sites.data, address: '',
			detailsByHost: { ...value.detailsByHost, [ canonical.identityHost ]: value.newSite },
			newSite: { displayName: '', schedule: null } };
		try {
			serializeWebsiteDraft( next );
		} catch {
			setValidate( true );
			setInputError( 'invalid-schedule' );
			return null;
		}
		change( next );
		if ( ! savingDraft ) {
			notify( SettingsFeedbackAction.SITE_ADDED );
		}
		return next;
	}

	/**
	 * Requests browser access synchronously from Save before committing the complete site set.
	 * @return Explicit persistence success or a retained invalid draft.
	 */
	function save(): Promise<DraftSaveResult> {
		if ( ! configuration || ! shell.editor || ! shell.permissionManager || saving ) {
			return Promise.resolve( DraftSaveResult.FAILED );
		}
		setValidate( true );
		const candidate = value.address.trim() ? stage( true ) : value;
		if ( candidate === null ) {
			return Promise.resolve( DraftSaveResult.FAILED );
		}
		if ( candidate.newSite.displayName.trim() || candidate.newSite.schedule !== null ) {
			setInputError( 'invalid-site' );
			return Promise.resolve( DraftSaveResult.FAILED );
		}
		try {
			serializeWebsiteDraft( candidate );
		} catch {
			setInputError( 'invalid-schedule' );
			return Promise.resolve( DraftSaveResult.FAILED );
		}
		const service = createProtectedSiteEnrollmentService( {
			editor: shell.editor, permissionManager: shell.permissionManager,
		} );
		// No awaited work may precede saveDraft: Firefox requires the original Save gesture.
		return draft.save( async ( next ) => {
			const result = await service.saveDraft( configuration.sites, serializeWebsiteDraft( next ) );
			if ( result.status !== ProtectedSiteEnrollmentStatus.SAVED ) {
				throw new Error( result.status === ProtectedSiteEnrollmentStatus.REJECTED
					? result.reason : result.status );
			}
			setConfiguration( result.configuration );
			setValidate( false );
			setRetained( result.permissionReleaseStatus !== SitePermissionReleaseStatus.RELEASED );
			await refresh( result.configuration ).catch( () => null );
			return createWebsiteDraft( result.configuration.sites );
		} );
	}

	/**
	 * Stages editable naming and active hours without changing countdown ownership.
	 * @param site - Current row being edited.
	 * @param details - Complete controlled details, including incomplete schedule fields.
	 */
	function updateSite( site: ProtectedSiteConfiguration, details: WebsiteDetailsDraft ): void {
		const previous = value.detailsByHost[ site.identityHost ] ?? createWebsiteDetails( site );
		if ( JSON.stringify( previous ) === JSON.stringify( details ) ) {
			return;
		}
		const { displayNameOverride: previousName, ...withoutName } = site;
		const replacement = { ...withoutName,
			...( details.displayName.trim() ? { displayNameOverride: details.displayName } : {} ) };
		change( { ...value,
			sites: value.sites.map( ( other ) => other.identityHost === site.identityHost ? replacement : other ),
			detailsByHost: { ...value.detailsByHost, [ site.identityHost ]: details },
		} );
		notify( SettingsFeedbackAction.SITE_UPDATED );
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
		'invalid-schedule': copy.invalidScheduleError, 'invalid-display-name': copy.invalidDisplayNameError,
		'invalid-configuration': copy.invalidConfigurationError, 'site-not-found': copy.siteNotFoundError,
		'sites-changed': copy.configurationChangedError, 'permission-denied': copy.permissionDeniedError,
		'permission-error': copy.permissionRequestError, 'permission-retained': copy.permissionRetainedError,
		'access-request': shell.protectedSiteItemCopy.accessRequestError,
	};
	const issue = inputError ?? error;
	const addressError = inputError === 'invalid-site' || inputError === 'already-protected'
		? errors[ inputError ] ?? copy.invalidSiteError : null;
	return { ...state, configuration, status, validate, access, pendingAccess, accessMessage, retained, duplicate,
		addressError, errorMessage: issue && ! addressError ? errors[ issue ] ?? copy.saveError : null,
		change, load, save, stage, updateSite, grant };
}
