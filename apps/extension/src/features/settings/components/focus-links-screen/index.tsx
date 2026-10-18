import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Icon, IconName, Stack, TextInput, Tooltip } from '@tocus/ui';
import {
	FocusLinkMaximumCount,
	FocusLinkSchema,
	FocusLinksSchema,
	type FocusLink,
	type PreferencesDocument,
} from '../../../../domains/preferences/types';
import { usePreferencesState } from '../../services/preferences-screen-state';
import { DraftActions } from '../draft-actions';
import { Feedback } from '../feedback';
import { Page } from '../page';
import { Recovery } from '../recovery';
import { LoadState } from '../recovery/types';
import { DraftSaveResult } from '../../utils/draft-controller/types';
import type { EditableSettingsScreenProps } from '../page/types';
import '../../../protected-sites/components/site-list/style.scss';
import '../../../protected-sites/components/site-item/style.scss';
import './style.scss';

/** Preference fields exclusively owned by the Focus links destination. */
const FocusLinkFields = [ 'focusLinks' ] as const;

/**
 * Edits the optional local destinations offered during a paused visit.
 * @param props - Localized copy, coordinated preferences and navigation registration.
 * @return Bounded link draft with keyboard reordering and guarded validation.
 * @since 1.1.0
 */
export function FocusLinks( props: EditableSettingsScreenProps ) {
	const copy = props.shell.focusLinksCopy;
	const editLabel = copy.edit;
	const form = useRef<HTMLFormElement>( null );
	const pendingFocus = useRef<string | null>( null );
	const [ touched, setTouched ] = useState<ReadonlySet<string>>( new Set() );
	const [ submitted, setSubmitted ] = useState( false );
	const [ validationRequest, setValidationRequest ] = useState( 0 );
	const [ expanded, setExpanded ] = useState<ReadonlySet<string>>( new Set() );
	const state = usePreferencesState( { ...props, fields: FocusLinkFields, validate } );
	const { draft, value, saving, error, status, recovery, load, restore } = state;
	const disabled = saving || recovery.pending;

	useEffect( () => {
		if ( pendingFocus.current !== null ) {
			form.current?.querySelector<HTMLElement>( `#${ CSS.escape( pendingFocus.current ) }` )?.focus();
			pendingFocus.current = null;
		}
	}, [ value, validationRequest, expanded ] );

	/**
	 * Validates all candidates before the shared page and navigation save operation.
	 * @param preferences - Current complete draft, including unfinished text fields.
	 * @return Whether persistence can start with normalized link values.
	 */
	function validate( preferences: PreferencesDocument ): boolean {
		const parsed = FocusLinksSchema.safeParse( preferences.focusLinks );
		if ( ! parsed.success ) {
			setSubmitted( true );
			setValidationRequest( ( request ) => request + 1 );
			setExpanded( ( current ) => new Set( [ ...current, ...preferences.focusLinks
				.filter( ( link ) => ! FocusLinkSchema.safeParse( link ).success ).map( ( link ) => link.id ) ] ) );
			const invalid = preferences.focusLinks.find( ( link ) => ! FocusLinkSchema.safeParse( link ).success );
			if ( invalid ) {
				const field = FocusLinkSchema.shape.label.safeParse( invalid.label ).success ? 'url' : 'label';
				pendingFocus.current = `${ field }-${ invalid.id }`;
			}
			return false;
		}
		draft.change( { ...preferences, focusLinks: parsed.data } );
		return true;
	}

	/**
	 * Collapses successfully saved editors while keeping rejected drafts available for correction.
	 * @return Whether persistence completed with a clean draft.
	 */
	async function save(): Promise<DraftSaveResult> {
		const result = await state.save();
		if ( result === DraftSaveResult.SAVED ) {
			pendingFocus.current = draft.snapshot.value.focusLinks[ 0 ]
				? `focus-link-edit-${ draft.snapshot.value.focusLinks[ 0 ].id }` : 'focus-links-add';
			setExpanded( new Set() );
			setTouched( new Set() );
			setSubmitted( false );
		}
		return result;
	}

	/**
	 * Reveals a row's fields or returns attention to its compact edit action.
	 * @param id - Stable identity of the shortcut being edited.
	 */
	function toggleEditor( id: string ): void {
		if ( disabled ) {
			return;
		}
		const next = new Set( expanded );
		if ( next.has( id ) ) {
			next.delete( id );
			pendingFocus.current = `focus-link-edit-${ id }`;
		} else {
			next.add( id );
			pendingFocus.current = `label-${ id }`;
		}
		setExpanded( next );
	}

	/**
	 * Removes a draft row and keeps focus on the nearest surviving shortcut.
	 * @param id - Stable identity of the shortcut being removed.
	 * @param index - Current position used to select the next editing target.
	 */
	function removeLink( id: string, index: number ): void {
		if ( disabled ) {
			return;
		}
		const links = value.focusLinks.filter( ( current ) => current.id !== id );
		const next = links[ Math.min( index, links.length - 1 ) ];
		pendingFocus.current = next ? `${ expanded.has( next.id ) ? 'label' : 'focus-link-edit' }-${ next.id }` : 'focus-links-add';
		setExpanded( new Set( [ ...expanded ].filter( ( current ) => current !== id ) ) );
		draft.change( { ...value, focusLinks: links } );
	}

	/**
	 * Updates one field while keeping unfinished and rejected text available for correction.
	 * @param id - Stable identity of the edited link.
	 * @param update - Current text from the user's field.
	 */
	function changeLink( id: string, update: Partial<FocusLink> ): void {
		draft.change( { ...value, focusLinks: value.focusLinks.map( ( link ) =>
			link.id === id ? { ...link, ...update } : link ) } );
	}

	/**
	 * Moves a link one position while retaining focus on its active editing target.
	 * @param index - Current position in the displayed order.
	 * @param direction - Adjacent position to exchange with this link.
	 */
	function moveLink( index: number, direction: number ): void {
		const links = [ ...value.focusLinks ];
		const link = links[ index ];
		const adjacent = links[ index + direction ];
		if ( disabled || ! link || ! adjacent ) {
			return;
		}
		links[ index ] = adjacent;
		links[ index + direction ] = link;
		pendingFocus.current = `${ expanded.has( link.id ) ? 'label' : 'focus-link-edit' }-${ link.id }`;
		draft.change( { ...value, focusLinks: links } );
	}

	/** Returns to the latest authoritative links and clears transient validation feedback. */
	function discard(): void {
		pendingFocus.current = draft.baseline.focusLinks[ 0 ]
			? `focus-link-edit-${ draft.baseline.focusLinks[ 0 ].id }` : 'focus-links-add';
		setExpanded( new Set() );
		setTouched( new Set() );
		setSubmitted( false );
		state.discard();
	}

	return <Page title={ copy.title }>
		<Recovery status={ status } copy={ copy } disabled={ recovery.pending }
			retry={ () => {
				void load();
			} } restore={ () => {
				void restore();
			} } />
		<Feedback error={ recovery.failed ? copy.restoreDefaultsError : null }
			success={ recovery.restored ? copy.restoredAnnouncement : null } />
		{ status === LoadState.READY && <form ref={ form } aria-label={ copy.formLabel } aria-busy={ disabled }
			onPointerDown={ ( event ) => {
				// Keep blur validation from moving a pressed action before its click is dispatched.
				if ( event.button === 0 && event.target instanceof Element && event.target.closest( 'button' ) ) {
					event.preventDefault();
				}
			} }
			noValidate onSubmit={ ( event ) => {
				event.preventDefault(); void save();
			} }>
			<Stack gap={ 0 }>
				<Stack gap="var(--tocus-space-5)" className="settings-focus-links">
					{ value.focusLinks.length === 0 ? <section className="settings-sites-empty">
						<h2>{ copy.emptyMessage }</h2><p>{ copy.description }</p>
					</section> : <p>{ copy.description }</p> }
					{ value.focusLinks.length > 0 && <ul className="settings-site-list settings-focus-link-list">
						{ value.focusLinks.map( ( link, index ) => <li key={ link.id } className="settings-site-item">
							<Group className="settings-site-row settings-focus-link-row" wrap="nowrap" gap="var(--tocus-space-3)">
								<div className="settings-site-identity">
									<h2>{ link.label.trim() || copy.addLink }</h2>
									{ link.url !== '' && <p>{ link.url }</p> }
								</div>
								<Group className="settings-site-actions" wrap="nowrap" gap="var(--tocus-space-1)">
									<Tooltip label={ copy.moveUp }
										events={ { hover: true, focus: true, touch: true } } withArrow>
										<ActionIcon variant="subtle" aria-label={ copy.moveUp }
											disabled={ disabled || index === 0 }
											onClick={ () => {
												moveLink( index, -1 );
											} }><Icon name={ IconName.ANGLE_UP } /></ActionIcon>
									</Tooltip>
									<Tooltip label={ copy.moveDown }
										events={ { hover: true, focus: true, touch: true } } withArrow>
										<ActionIcon variant="subtle" aria-label={ copy.moveDown }
											disabled={ disabled || index === value.focusLinks.length - 1 }
											onClick={ () => {
												moveLink( index, 1 );
											} }><Icon name={ IconName.ANGLE_DOWN } /></ActionIcon>
									</Tooltip>
									<Tooltip label={ copy.remove }
										events={ { hover: true, focus: true, touch: true } } withArrow>
										<ActionIcon className="settings-site-remove" color="red" variant="subtle"
											aria-label={ copy.remove }
											disabled={ disabled } onClick={ () => {
												removeLink( link.id, index );
											} }><Icon name={ IconName.TRASH } /></ActionIcon>
									</Tooltip>
									<Tooltip label={ editLabel } multiline maw="calc(100vw - var(--tocus-space-8))"
										events={ { hover: true, focus: true, touch: true } } withArrow>
										<ActionIcon id={ `focus-link-edit-${ link.id }` }
											className="settings-site-manage" variant="subtle"
											aria-label={ editLabel } aria-expanded={ expanded.has( link.id ) }
											aria-controls={ `focus-link-fields-${ link.id }` } disabled={ disabled } onClick={ () => {
												toggleEditor( link.id );
											} }><Icon name={ IconName.SLIDERS } /></ActionIcon>
									</Tooltip>
								</Group>
							</Group>
							{ expanded.has( link.id ) && <fieldset id={ `focus-link-fields-${ link.id }` }
								className="settings-fieldset settings-focus-link" disabled={ disabled } aria-label={ String( index + 1 ) }>
								<Stack gap="var(--tocus-space-4)">
									<TextInput id={ `label-${ link.id }` } label={ copy.label } value={ link.label } disabled={ disabled }
										autoComplete="off" error={ ( submitted || touched.has( `label-${ link.id }` ) ) &&
											! FocusLinkSchema.shape.label.safeParse( link.label ).success
											? copy.invalidLabel : undefined }
										onBlur={ () => {
											setTouched( new Set( [ ...touched, `label-${ link.id }` ] ) );
										} }
										onChange={ ( event ) => {
											changeLink( link.id, { label: event.currentTarget.value } );
										} } />
									<TextInput id={ `url-${ link.id }` } label={ copy.url } value={ link.url } disabled={ disabled }
										type="url" autoComplete="off" autoCapitalize="none" spellCheck={ false }
										error={ ( submitted || touched.has( `url-${ link.id }` ) ) &&
											! FocusLinkSchema.shape.url.safeParse( link.url ).success
											? copy.invalidUrl : undefined }
										onBlur={ () => {
											setTouched( new Set( [ ...touched, `url-${ link.id }` ] ) );
										} }
										onChange={ ( event ) => {
											changeLink( link.id, { url: event.currentTarget.value } );
										} } />
								</Stack>
							</fieldset> }
						</li> ) }
					</ul> }
					{ value.focusLinks.length < FocusLinkMaximumCount && <Button id="focus-links-add"
						className="settings-focus-links-add" type="button" variant="outline" disabled={ disabled } onClick={ () => {
							if ( disabled || value.focusLinks.length >= FocusLinkMaximumCount ) {
								return;
							}
							const id = `focus_link_${ crypto.randomUUID() }`;
							pendingFocus.current = `label-${ id }`;
							setExpanded( new Set( [ ...expanded, id ] ) );
							draft.change( { ...value, focusLinks: [ ...value.focusLinks, { id, label: '', url: '' } ] } );
						} }>{ copy.addLink }</Button> }
				</Stack>
				<Feedback error={ error ? copy.saveError : null } />
				<DraftActions draft={ draft } copy={ copy } onSave={ save } onDiscard={ discard } />
			</Stack>
		</form> }
	</Page>;
}
