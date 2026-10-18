import { useEffect, useRef, useState } from 'react';
import { Button, Group, Stack, TextInput } from '@tocus/ui';
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
import type { EditableSettingsScreenProps } from '../page/types';
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
	const form = useRef<HTMLFormElement>( null );
	const pendingFocus = useRef<string | null>( null );
	const [ touched, setTouched ] = useState<ReadonlySet<string>>( new Set() );
	const [ submitted, setSubmitted ] = useState( false );
	const [ validationRequest, setValidationRequest ] = useState( 0 );
	const state = usePreferencesState( { ...props, fields: FocusLinkFields, validate } );
	const { draft, value, saving, error, status, recovery, load, save, restore } = state;
	const disabled = saving || recovery.pending;

	useEffect( () => {
		if ( pendingFocus.current !== null ) {
			form.current?.querySelector<HTMLElement>( `#${ CSS.escape( pendingFocus.current ) }` )?.focus();
			pendingFocus.current = null;
		}
	}, [ value, validationRequest ] );

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
	 * Updates one field while keeping unfinished and rejected text available for correction.
	 * @param id - Stable identity of the edited link.
	 * @param update - Current text from the user's field.
	 */
	function changeLink( id: string, update: Partial<FocusLink> ): void {
		draft.change( { ...value, focusLinks: value.focusLinks.map( ( link ) =>
			link.id === id ? { ...link, ...update } : link ) } );
	}

	/**
	 * Moves a link one position while retaining focus on that link's label.
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
		pendingFocus.current = `label-${ link.id }`;
		draft.change( { ...value, focusLinks: links } );
	}

	/** Returns to the latest authoritative links and clears transient validation feedback. */
	function discard(): void {
		pendingFocus.current = draft.baseline.focusLinks[ 0 ]
			? `label-${ draft.baseline.focusLinks[ 0 ].id }` : 'focus-links-add';
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
			<Stack gap="var(--tocus-space-4)" className="settings-focus-links">
				<div><p>{ copy.description }</p><p>{ copy.privacyDescription }</p></div>
				{ value.focusLinks.length === 0 && <p>{ copy.emptyMessage }</p> }
				{ value.focusLinks.map( ( link, index ) => <fieldset key={ link.id }
					className="settings-focus-link" disabled={ disabled }>
					<legend>{ index + 1 }</legend>
					<Stack gap="var(--tocus-space-3)">
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
						<Group gap="var(--tocus-space-2)" className="settings-focus-link-actions">
							<Button type="button" size="xs" variant="outline" disabled={ disabled || index === 0 }
								onClick={ () => {
									moveLink( index, -1 );
								} }>{ copy.moveUp }</Button>
							<Button type="button" size="xs" variant="outline" disabled={ disabled || index === value.focusLinks.length - 1 }
								onClick={ () => {
									moveLink( index, 1 );
								} }>{ copy.moveDown }</Button>
							<Button type="button" size="xs" variant="outline" disabled={ disabled }
								onClick={ () => {
									if ( disabled ) {
										return;
									}
									const links = value.focusLinks.filter( ( current ) => current.id !== link.id );
									const next = links[ Math.min( index, links.length - 1 ) ];
									pendingFocus.current = next ? `label-${ next.id }` : 'focus-links-add';
									draft.change( { ...value, focusLinks: links } );
								} }>{ copy.remove }</Button>
						</Group>
					</Stack>
				</fieldset> ) }
				<Button id="focus-links-add" className="settings-focus-links-add" type="button" size="xs" variant="outline"
					disabled={ disabled || value.focusLinks.length >= FocusLinkMaximumCount } onClick={ () => {
						if ( disabled || value.focusLinks.length >= FocusLinkMaximumCount ) {
							return;
						}
						const id = `focus_link_${ crypto.randomUUID() }`;
						pendingFocus.current = `label-${ id }`;
						draft.change( { ...value, focusLinks: [ ...value.focusLinks, { id, label: '', url: '' } ] } );
					} }>{ copy.addLink }</Button>
			</Stack>
			<Feedback error={ error ? copy.saveError : null } />
			<DraftActions draft={ draft } copy={ copy } onSave={ save } onDiscard={ discard } />
		</form> }
	</Page>;
}
