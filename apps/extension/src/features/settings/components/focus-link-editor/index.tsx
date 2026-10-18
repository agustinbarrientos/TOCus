import { useId, useRef, useState, type SubmitEvent } from 'react';
import { Button, Group, Modal, Stack, TextInput, useFocusReturn } from '@tocus/ui';
import { FocusLinkSchema } from '../../../../domains/preferences/types';
import { Feedback } from '../feedback';
import type { FocusLinkEditorFormProps, FocusLinkEditorProps } from './types';

/**
 * Keeps tentative fields out of the page draft until the user chooses Done.
 * @param props - Initial shortcut, localized controls and explicit draft callbacks.
 * @return Validated fields with cancel-safe local state.
 * @since 1.1.0
 */
function FocusLinkEditorForm( props: FocusLinkEditorFormProps ) {
	const [ value, setValue ] = useState( props.value );
	const [ submitted, setSubmitted ] = useState( false );
	const label = useRef<HTMLInputElement>( null );
	const url = useRef<HTMLInputElement>( null );
	const labelValid = FocusLinkSchema.shape.label.safeParse( value.label ).success;
	const urlValid = FocusLinkSchema.shape.url.safeParse( value.url ).success;

	/**
	 * Applies a normalized shortcut without saving the owning page's preferences.
	 * @param event - Explicit form submission from Done or Enter.
	 */
	function submit( event: SubmitEvent<HTMLFormElement> ): void {
		event.preventDefault();
		if ( props.disabled || props.error !== null ) {
			return;
		}
		setSubmitted( true );
		const parsed = FocusLinkSchema.safeParse( value );
		if ( ! parsed.success ) {
			( labelValid ? url : label ).current?.focus();
			return;
		}
		props.onSubmit( parsed.data );
	}

	return <form className="settings-site-editor" noValidate onSubmit={ submit }>
		<Stack gap="var(--tocus-space-5)">
			<Stack gap="var(--tocus-space-4)">
				<TextInput ref={ label } id={ `label-${ value.id }` } data-autofocus label={ props.copy.label }
					value={ value.label } disabled={ props.disabled } autoComplete="off"
					error={ submitted && ! labelValid ? props.copy.invalidLabel : undefined }
					onChange={ ( event ) => {
						setValue( { ...value, label: event.currentTarget.value } );
					} } />
				<TextInput ref={ url } id={ `url-${ value.id }` } label={ props.copy.url }
					value={ value.url } disabled={ props.disabled } type="url" autoComplete="off"
					autoCapitalize="none" spellCheck={ false }
					error={ submitted && ! urlValid ? props.copy.invalidUrl : undefined }
					onChange={ ( event ) => {
						setValue( { ...value, url: event.currentTarget.value } );
					} } />
			</Stack>
			<Feedback nativeError error={ props.error } />
			<Group className="tocus-form-actions" justify="flex-end" gap="var(--tocus-space-2)">
				<Button type="button" variant="outline" disabled={ props.disabled } onClick={ props.onCancel }>{ props.copy.cancel }</Button>
				<Button type="submit" disabled={ props.disabled || props.error !== null }>{ props.copy.done }</Button>
			</Group>
		</Stack>
	</form>;
}

/**
 * Uses the shared website dialog lifecycle, focus containment and focus restoration.
 * @param props - Shortcut being edited, or null when the dialog is closed.
 * @return A shared modal that starts a fresh edit session on each open.
 * @since 1.1.0
 */
export function FocusLinkEditor( props: FocusLinkEditorProps ) {
	const opened = props.value !== null;
	const stackId = useId();
	useFocusReturn( { opened } );
	/** Prevents closing while a preference operation owns the screen. */
	function close(): void {
		if ( ! props.disabled ) {
			props.onCancel();
		}
	}
	return <Modal.Stack><Modal stackId={ stackId } opened={ opened } title={ props.title } size="lg" centered
		onClose={ close } withCloseButton={ false } closeOnClickOutside={ false }
		closeOnEscape={ ! props.disabled } returnFocus={ false } aria-busy={ props.disabled }>
		{ props.value && <FocusLinkEditorForm { ...props } value={ props.value } onCancel={ close } /> }
	</Modal></Modal.Stack>;
}
