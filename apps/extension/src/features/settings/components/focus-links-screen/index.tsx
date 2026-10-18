import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Icon, IconName, Stack, Tooltip } from '@tocus/ui';
import {
	FocusLinkMaximumCount,
	type FocusLink,
} from '../../../../domains/preferences/types';
import { usePreferencesState } from '../../services/preferences-screen-state';
import { DraftActions } from '../draft-actions';
import { FocusLinkEditor } from '../focus-link-editor';
import { Feedback } from '../feedback';
import { Page } from '../page';
import { Recovery } from '../recovery';
import { LoadState } from '../recovery/types';
import { DraftSaveResult } from '../../utils/draft-controller/types';
import type { EditableSettingsScreenProps } from '../page/types';
import type { FocusLinkEditSession } from './types';
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
	const [ editor, setEditor ] = useState<FocusLinkEditSession | null>( null );
	const [ focusRequest, setFocusRequest ] = useState( 0 );
	const state = usePreferencesState( { ...props, fields: FocusLinkFields } );
	const { draft, value, saving, error, status, recovery, load, restore } = state;
	const disabled = saving || recovery.pending;

	useEffect( () => {
		if ( pendingFocus.current !== null ) {
			form.current?.querySelector<HTMLElement>( `#${ CSS.escape( pendingFocus.current ) }` )?.focus();
			pendingFocus.current = null;
		}
	}, [ value, editor, focusRequest ] );

	useEffect( () => {
		if ( status !== LoadState.READY ) {
			setEditor( null );
		}
	}, [ status ] );

	/**
	 * Detects changed or removed originals and lost capacity without overwriting another window.
	 * @param links - Latest links in the owning page draft.
	 * @return Whether this editing session can no longer be safely applied.
	 */
	function editorChanged( links: readonly FocusLink[] ): boolean {
		if ( editor === null ) {
			return false;
		}
		if ( editor.original === null ) {
			return links.length >= FocusLinkMaximumCount;
		}
		const original = editor.original;
		const current = links.find( ( link ) => link.id === original.id );
		return current?.label !== original.label || current.url !== original.url;
	}

	/**
	 * Saves the page draft and returns focus to its first surviving shortcut.
	 * @return Whether persistence completed with a clean draft.
	 */
	async function save(): Promise<DraftSaveResult> {
		const result = await state.save();
		if ( result === DraftSaveResult.SAVED ) {
			pendingFocus.current = draft.snapshot.value.focusLinks[ 0 ]
				? `focus-link-edit-${ draft.snapshot.value.focusLinks[ 0 ].id }` : 'focus-links-add';
			setEditor( null );
			setFocusRequest( ( request ) => request + 1 );
		}
		return result;
	}

	/**
	 * Applies a valid dialog candidate to the latest page draft without writing storage.
	 * @param link - Normalized shortcut confirmed in the dialog.
	 */
	function applyLink( link: FocusLink ): void {
		const current = draft.snapshot.value;
		const exists = current.focusLinks.some( ( candidate ) => candidate.id === link.id );
		if ( disabled || editor === null || editorChanged( current.focusLinks ) ) {
			return;
		}
		pendingFocus.current = `focus-link-edit-${ link.id }`;
		draft.change( { ...current, focusLinks: exists
			? current.focusLinks.map( ( candidate ) => candidate.id === link.id ? link : candidate )
			: [ ...current.focusLinks, link ] } );
		setEditor( null );
	}

	/** Returns attention to the invoking control or its nearest surviving list action. */
	function cancelEditor(): void {
		const links = draft.snapshot.value.focusLinks;
		const original = links.find( ( link ) => link.id === editor?.original?.id );
		const target = original ??
			( editor?.original || links.length >= FocusLinkMaximumCount ? links[ 0 ] : undefined );
		pendingFocus.current = target ? `focus-link-edit-${ target.id }` : 'focus-links-add';
		setEditor( null );
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
		pendingFocus.current = next ? `focus-link-edit-${ next.id }` : 'focus-links-add';
		draft.change( { ...value, focusLinks: links } );
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
		pendingFocus.current = `focus-link-edit-${ link.id }`;
		draft.change( { ...value, focusLinks: links } );
	}

	/** Returns to the latest authoritative links and clears transient validation feedback. */
	function discard(): void {
		pendingFocus.current = draft.baseline.focusLinks[ 0 ]
			? `focus-link-edit-${ draft.baseline.focusLinks[ 0 ].id }` : 'focus-links-add';
		setEditor( null );
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
			noValidate onSubmit={ ( event ) => {
				event.preventDefault(); void save();
			} }>
			<Stack gap={ 0 }>
				<Stack gap="var(--tocus-space-5)" className="settings-focus-links">
					{ value.focusLinks.length === 0 ? <section className="settings-sites-empty">
						<h2>{ copy.emptyMessage }</h2><p>{ copy.description }<br />{ copy.descriptionDetail }</p>
					</section> : <p>{ copy.description }<br />{ copy.descriptionDetail }</p> }
					{ value.focusLinks.length > 0 && <ul className="settings-site-list settings-focus-link-list">
						{ value.focusLinks.map( ( link, index ) => <li key={ link.id } className="settings-site-item">
							<Group className="settings-site-row settings-focus-link-row" wrap="nowrap" gap="var(--tocus-space-3)">
								<div className="settings-site-identity">
									<h2>{ link.label.trim() || copy.addLink }</h2>
									{ link.url !== '' && <p>{ link.url.replace( /^https?:\/\//iu, '' ) }</p> }
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
											aria-label={ editLabel } aria-haspopup="dialog" disabled={ disabled } onClick={ () => {
												setEditor( { value: link, original: link } );
											} }><Icon name={ IconName.SLIDERS } /></ActionIcon>
									</Tooltip>
								</Group>
							</Group>
						</li> ) }
					</ul> }
					{ value.focusLinks.length < FocusLinkMaximumCount && <Button id="focus-links-add"
						className="settings-focus-links-add" type="button" aria-haspopup="dialog" variant="outline" disabled={ disabled } onClick={ () => {
							if ( disabled || value.focusLinks.length >= FocusLinkMaximumCount ) {
								return;
							}
							setEditor( { value: { id: `focus_link_${ crypto.randomUUID() }`, label: '', url: '' }, original: null } );
						} }>{ copy.addLink }</Button> }
				</Stack>
				<Feedback error={ error ? copy.saveError : null } />
				<DraftActions draft={ draft } copy={ copy } onSave={ save } onDiscard={ discard } />
			</Stack>
		</form> }
		<FocusLinkEditor value={ status === LoadState.READY ? editor?.value ?? null : null }
			title={ editor?.original ? editLabel : copy.addLink } copy={ copy } disabled={ disabled }
			error={ editorChanged( value.focusLinks )
				? props.shell.protectedSiteItemCopy.configurationChangedError : null }
			onSubmit={ applyLink } onCancel={ cancelEditor } />
	</Page>;
}
