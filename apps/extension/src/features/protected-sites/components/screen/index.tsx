import { LoadState } from '../../../settings/components/recovery/types';
import {
	useRef,
	useState,
} from 'react';
import {
	Button,
	Group,
	Stack,
	TextInput,
} from '@tocus/ui';
import type {
	ProtectedSiteConfiguration,
} from '../../../../domains/protection/types/protected-site-configuration';
import {
	resolveSiteDisplayIdentity,
} from '../../utils/site-display-name-resolver';
import {
	Confirmation,
} from '../../../settings/components/confirmation';
import {
	DraftActions,
} from '../../../settings/components/draft-actions';
import {
	Feedback,
} from '../../../settings/components/feedback';
import {
	Page,
} from '../../../settings/components/page';
import {
	Recovery,
} from '../../../settings/components/recovery';
import {
	WebsiteDetails,
} from '../website-details';
import {
	WebsiteItem,
} from '../site-item';
import {
	useWebsitesState,
} from '../../services/settings-screen-state';
import type {
	WebsitesScreenProps,
} from './types';
import './style.scss';
import { WebsiteList } from '../site-list';


export type { AccessRefresh } from './types';


/**
 * Presents grouped website identities and their complete page-level draft.
 * @param props - Canonical site services, localized content and access-refresh registration.
 * @return Editable websites destination with gesture-safe Save and access recovery.
 * @since 0.1.0
 */
export function Websites( props: WebsitesScreenProps ) {
	const { shell } = props;
	const copy = shell.protectedSitesCopy;
	const itemCopy = shell.protectedSiteItemCopy;
	const state = useWebsitesState( props );
	const { draft, value, status, saving, saved, configuration, pendingAccess, access } = state;
	const [ editing, setEditing ] = useState<string | null>( null );
	const [ removing, setRemoving ] = useState<ProtectedSiteConfiguration | null>( null );
	const addressInput = useRef<HTMLInputElement>( null );
	const disabled = saving || shell.permissionManager === null;
	const savedIdentities = new Set( configuration?.sites.map( ( site ) => site.identityHost ) ?? [] );

	/** Removes the confirmed row from the draft without changing storage or permissions. */
	function confirmRemoval(): void {
		const remaining = value.sites.filter( ( site ) => site.identityHost !== removing?.identityHost );
		state.change( { ...value, sites: remaining } );
		setRemoving( null );
		setEditing( null );
		// The removed row cannot receive the dialog's restored focus.
		addressInput.current?.focus();
	}

	/**
	 * Binds one grouped row to the page's unchanged Save/Discard transaction.
	 * @param site - Website configuration currently staged in the page draft.
	 * @return Keyed row with permission and dialog editor callbacks.
	 */
	function renderSite( site: ProtectedSiteConfiguration ) {
		if ( configuration === null ) {
			return null;
		}
		return <WebsiteItem key={ site.identityHost } site={ site } copy={ itemCopy }
			scheduleCopy={ shell.scheduleCopy } globalSchedule={ configuration.schedule }
			{ ...( value.detailsByHost[ site.identityHost ] === undefined
				? {} : { details: value.detailsByHost[ site.identityHost ] } ) }
			validate={ state.validate }
			favicon={ shell.faviconProvider?.getSource( site.identityHost ) ?? null }
			editing={ editing === site.identityHost && removing?.identityHost !== site.identityHost }
			disabled={ saving }
			accessRequired={ savedIdentities.has( site.identityHost ) && access.get( site.identityHost ) !== true }
			accessPending={ pendingAccess === site.identityHost }
			accessDisabled={ disabled || pendingAccess !== null }
			onEdit={ () => {
				setEditing( site.identityHost );
			} }
			onDone={ () => {
				setEditing( null );
			} }
			onGrant={ () => {
				state.grant( site );
			} }
			onRemove={ () => {
				setRemoving( site );
			} }
			onChange={ ( details ) => {
				state.updateSite( site, details );
			} } />;
	}

	return (
		<Page title={ copy.title }>
			<Recovery status={ status } copy={ copy } retry={ () => {
				void state.load();
			} } />
			{ status === LoadState.READY && <>
				<form className="settings-site-form" onSubmit={ ( event ) => {
					event.preventDefault(); state.stage();
				} }>
					<Stack gap={ 0 }>
						<Group className="settings-site-add" align="stretch" gap="var(--tocus-space-3)">
							<TextInput ref={ addressInput } className="settings-site-address tocus-native-field" id="site-address" name="site-address"
								classNames={ { input: 'settings-native-input' } }
								aria-label={ copy.addressLabel } placeholder={ copy.addressPlaceholder } autoComplete="url"
								aria-describedby="site-address-error" value={ value.address } disabled={ disabled }
								error={ state.addressError !== null }
								onChange={ ( event ) => {
									state.change( { ...value, address: event.currentTarget.value } );
								} } />
							<Button className="tocus-native-button" h="auto" type="submit" variant="outline"
								disabled={ disabled }>{ copy.addSite }</Button>
						</Group>
						<p id="site-address-error" className="settings-site-address-error"
							role={ state.addressError ? 'alert' : undefined }>{ state.addressError }</p>
						{ value.address.trim() !== '' && <WebsiteDetails idPrefix="new-site" copy={ copy } scheduleCopy={ shell.scheduleCopy }
							value={ value.newSite } disabled={ disabled } validate={ state.validate }
							onChange={ ( newSite ) => {
								state.change( { ...value, newSite } );
							} } /> }
					</Stack>
				</form>
				<WebsiteList sites={ value.sites } copy={ copy } renderItem={ renderSite }
					hasCustomSchedule={ ( site ) => value.detailsByHost[ site.identityHost ]?.schedule !== null } />
				<DraftActions draft={ draft } copy={ { ...copy, saving: itemCopy.saving } } onSave={ state.save } />
				<Feedback error={ state.errorMessage } success={ saved ? copy.saved : state.accessMessage } />
				{ state.retained && <p role="status">{ copy.savedWithRetainedAccess }</p> }
				<Confirmation opened={ removing !== null } focusConfirm
					title={ removing
						? itemCopy.formatRemoveQuestion( resolveSiteDisplayIdentity( removing ).name )
						: itemCopy.removeSite }
					description={ removing?.rule.host ?? '' }
					cancel={ itemCopy.keepSite } confirm={ itemCopy.confirmRemove }
					onCancel={ () => {
						setRemoving( null );
					} } onConfirm={ confirmRemoval } />
			</> }
		</Page>
	);
}
