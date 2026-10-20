import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { resolveSitePolicy } from '../../../../domains/protection/utils/resolve-site-policy';
import { serializeWebsiteDraft } from '../../utils/website-draft';
import type { WebsiteListPresentation } from '../site-list/types';
import { LoadState } from '../../../settings/components/recovery/types';
import {
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	Button,
	Group,
	Stack,
	TextInput,
	Icon,
	IconName,
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
import { useSettingsFeedback } from '../../../settings/services/settings-feedback';
import { SettingsFeedbackAction } from '../../../settings/services/settings-feedback/types';


export type { AccessRefresh } from './types';


/**
 * Presents grouped website identities and their complete page-level draft.
 * @param props - Canonical site services, localized content and access-refresh registration.
 * @return Editable websites destination with gesture-safe Save and access recovery.
 * @since 1.0.0
 */
export function Websites( props: WebsitesScreenProps ) {
	const { shell } = props;
	const copy = shell.protectedSitesCopy;
	const itemCopy = shell.protectedSiteItemCopy;
	const state = useWebsitesState( props );
	const { notify } = useSettingsFeedback();
	const { draft, value, status, saving, configuration, pendingAccess, access } = state;
	const [ editing, setEditing ] = useState<string | null>( null );
	const [ removing, setRemoving ] = useState<ProtectedSiteConfiguration | null>( null );
	const [ removingKeys, setRemovingKeys ] = useState<ReadonlySet<string>>( new Set() );
	const [ selected, setSelected ] = useState<ReadonlySet<string>>( new Set() );
	const [ removingSelected, setRemovingSelected ] = useState<ReadonlySet<string> | null>( null );
	const addressInput = useRef<HTMLInputElement>( null );
	const rows = useRef( new Map<string, HTMLLIElement>() );
	const [ highlighted, setHighlighted ] = useState<string | null>( null );
	const disabled = saving || shell.permissionManager === null;
	const savedIdentities = new Set( configuration?.sites.map( ( site ) =>
		getProtectedSiteRuleKey( site.rule ) ) ?? [] );
	const selectedSites = value.sites.filter( ( site ) =>
		selected.has( getProtectedSiteRuleKey( site.rule ) ) );

	useEffect( () => {
		const hosts = new Set<string>( value.sites.map( ( site ) => getProtectedSiteRuleKey( site.rule ) ) );
		setSelected( ( previous ) => {
			const remaining = new Set( [ ...previous ].filter( ( host ) => hosts.has( host ) ) );
			return remaining.size === previous.size ? previous : remaining;
		} );
	}, [ value.sites ] );

	useEffect( () => {
		if ( state.duplicate === null ) {
			return;
		}
		const host = state.duplicate.ruleKey;
		const row = rows.current.get( host );
		if ( ! row ) {
			return;
		}
		setHighlighted( host );
		const reducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		row.scrollIntoView( { block: 'center', behavior: reducedMotion ? 'instant' : 'smooth' } );
		// Keep attention on the match without moving keyboard focus away from the add action.
		const timeout = window.setTimeout( () => {
			setHighlighted( null );
		}, 2200 );
		return () => {
			window.clearTimeout( timeout );
		};
	}, [ state.duplicate ] );

	/**
	 * Stages confirmed removals together without touching storage or permissions.
	 * @param hosts - Exact identities captured when the confirmation opened.
	 */
	function removeFromDraft( hosts: ReadonlySet<string> ): void {
		state.change( { ...value,
			sites: value.sites.filter( ( site ) => ! hosts.has( getProtectedSiteRuleKey( site.rule ) ) ),
			detailsByRuleKey: Object.fromEntries( Object.entries( value.detailsByRuleKey )
				.filter( ( [ host ] ) => ! hosts.has( host ) ) ),
		} );
		setSelected( ( previous ) => new Set( [ ...previous ].filter( ( host ) => ! hosts.has( host ) ) ) );
		if ( editing !== null && hosts.has( editing ) ) {
			setEditing( null );
		}
		// The removed row cannot receive the dialog's restored focus.
		addressInput.current?.focus();
	}

	/** Removes the confirmed row from the draft without changing storage or permissions. */
	function confirmRemoval(): void {
		if ( removing === null || saving ) {
			return;
		}
		removeFromDraft( removingKeys );
		notify( SettingsFeedbackAction.SITE_REMOVED );
		setRemoving( null );
	}

	/** Stages the confirmed selection as one change in the existing Save/Discard transaction. */
	function confirmSelectedRemoval(): void {
		if ( removingSelected === null || saving ) {
			return;
		}
		removeFromDraft( removingSelected );
		notify( SettingsFeedbackAction.SITES_REMOVED );
		setRemovingSelected( null );
	}

	/**
	 * Binds one grouped row to the page's unchanged Save/Discard transaction.
	 * @param site - Website configuration currently staged in the page draft.
	 * @param presentation - Exact group membership and exception presentation.
	 * @return Keyed row with permission and dialog editor callbacks.
	 */
	function renderSite( site: ProtectedSiteConfiguration, presentation?: WebsiteListPresentation ) {
		if ( configuration === null ) {
			return null;
		}
		const key = getProtectedSiteRuleKey( site.rule );
		const groupMembers = presentation && ! presentation.exception && ! presentation.rootPeer
			? presentation.members : [ site ];
		const groupKeys = groupMembers.map( ( member ) => getProtectedSiteRuleKey( member.rule ) );
		const effective = resolveSitePolicy( { ...configuration, sites: serializeWebsiteDraft( value ) }, site.rule );
		return <WebsiteItem presentation={ presentation } timingCopy={ shell.timingCopy }
			inheritedTiming={ effective?.timingConfiguration } key={ key } site={ site } copy={ itemCopy }
			highlighted={ ! presentation?.presentationOnly && highlighted === key }
			selection={ { checked: groupKeys.every( ( key ) => selected.has( key ) ), active: selectedSites.length > 0,
				/**
				 * Changes only this row's page-local selection.
				 * @param checked - Whether the row belongs to the next bulk action.
				 */
				onChange: ( checked ) => {
					if ( saving ) {
						return;
					}
					setSelected( ( previous ) => {
						const next = new Set( previous );
						if ( checked ) {
							groupKeys.forEach( ( key ) => next.add( key ) );
						} else {
							groupKeys.forEach( ( key ) => next.delete( key ) );
						}
						return next;
					} );
				} } }
			itemRef={ ( element ) => {
				if ( element ) {
					if ( ! presentation?.presentationOnly ) {
						rows.current.set( key, element );
					}
				} else {
					rows.current.delete( key );
				}
			} }
			scheduleCopy={ shell.scheduleCopy } globalSchedule={ configuration.schedule }
			{ ...( value.detailsByRuleKey[ key ] === undefined
				? {} : { details: value.detailsByRuleKey[ key ] } ) }
			validate={ state.validate }
			favicon={ shell.faviconProvider?.getSource( presentation?.groupHost ?? site.identityHost ) ?? null }
			faviconProvider={ shell.faviconProvider }
			editing={ ! presentation?.presentationOnly && editing === key &&
				( removing === null || getProtectedSiteRuleKey( removing.rule ) !== key ) }
			disabled={ saving }
			accessRequired={ ! presentation?.presentationOnly &&
				savedIdentities.has( key ) && access.get( key ) !== true }
			accessPending={ pendingAccess === key }
			accessDisabled={ disabled || pendingAccess !== null }
			onEdit={ () => {
				setEditing( key );
			} }
			onDone={ () => {
				setEditing( null );
			} }
			onGrant={ () => {
				state.grant( site );
			} }
			onRemove={ () => {
				setRemovingKeys( new Set( groupKeys ) );
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
				{ selectedSites.length > 0 && <Group className="settings-site-selection-actions">
					<Button type="button" size="sm" variant="outline" color="red" disabled={ saving }
						leftSection={ <Icon name={ IconName.TRASH } /> } onClick={ () => {
							setRemovingSelected( new Set( selectedSites.map( ( site ) =>
								getProtectedSiteRuleKey( site.rule ) ) ) );
						} }>{ copy.formatRemoveSelected( selectedSites.length ) }</Button>
				</Group> }
				<WebsiteList sites={ value.sites } copy={ copy } exceptionsLabel={ itemCopy.exceptionsLabel }
					renderItem={ renderSite }
					hasCustomSchedule={ ( site ) =>
						value.detailsByRuleKey[ getProtectedSiteRuleKey( site.rule ) ]?.schedule !== null } />
				<DraftActions draft={ draft } copy={ { ...copy, saving: itemCopy.saving } }
					onSave={ state.save } onDiscard={ () => {
						state.discard();
						setSelected( new Set() );
					} } />
				<Feedback error={ state.errorMessage } success={ state.accessMessage } />
				{ state.retained && <p role="status">{ copy.savedWithRetainedAccess }</p> }
				<Confirmation opened={ removingSelected !== null } pending={ saving }
					title={ copy.formatRemoveSelectedQuestion( removingSelected?.size ?? 0 ) }
					description={ copy.removeSelectedDescription }
					cancel={ copy.cancelRemoveSelected } confirm={ copy.confirmRemoveSelected }
					onCancel={ () => {
						setRemovingSelected( null );
					} } onConfirm={ confirmSelectedRemoval } />
				<Confirmation opened={ removing !== null } focusConfirm pending={ saving }
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
