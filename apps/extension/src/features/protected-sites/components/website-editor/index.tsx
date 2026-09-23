import { useId, useState, type SubmitEvent } from 'react';
import { Button, Group, Modal, Stack, useFocusReturn } from '@tocus/ui';
import { Feedback } from '../../../settings/components/feedback';
import { toSchedule } from '../../../settings/utils/schedule-draft';
import { WebsiteDetails } from '../website-details';
import type { WebsiteEditorProps } from './types';

/**
 * Keeps tentative website edits inside a focus-contained dialog until explicitly applied.
 * @param props - Initial draft, localized content and existing transaction callbacks.
 * @return Cancel-safe form fields and schedule validation.
 * @since 1.0.0
 */
function WebsiteEditorForm( props: WebsiteEditorProps ) {
	const [ value, setValue ] = useState( props.value );
	const [ validate, setValidate ] = useState( false );
	/**
	 * Applies valid fields to the existing owner without adding another persistence path.
	 * @param event - Native form submission from the primary button or Enter.
	 */
	function submit( event: SubmitEvent<HTMLFormElement> ): void {
		event.preventDefault();
		if ( props.disabled ) {
			return;
		}
		setValidate( true );
		try {
			if ( value.schedule !== null ) {
				toSchedule( value.schedule );
			}
		} catch {
			return;
		}
		props.onSubmit( value );
	}
	return <form className="settings-site-editor" onSubmit={ submit }>
		<Stack gap="var(--tocus-space-5)">
			<WebsiteDetails idPrefix={ props.idPrefix } copy={ props.copy } scheduleCopy={ props.scheduleCopy }
				value={ value } disabled={ props.disabled } validate={ validate } showName
				namePlaceholder={ props.automaticName } onChange={ setValue } />
			<Feedback nativeError error={ props.error } />
			<Group className="tocus-form-actions" justify="flex-end" gap="var(--tocus-space-2)">
				<Button variant="outline" disabled={ props.disabled } onClick={ props.onCancel }>{ props.copy.cancel }</Button>
				<Button type="submit" disabled={ props.disabled }>{ props.submitLabel }</Button>
			</Group>
		</Stack>
	</form>;
}

/**
 * Retains the packaged dialog lifecycle for focus restoration while resetting fields on every open.
 * @param props - Current visibility, starting values and transaction callbacks.
 * @return Shared modal with an isolated draft for this editing session.
 * @since 1.0.0
 */
export function WebsiteEditor( props: WebsiteEditorProps ) {
	const stackId = useId();
	useFocusReturn( { opened: props.opened } );
	/** Keeps pending saves inside their dialog until the owner reports completion. */
	function close(): void {
		if ( ! props.disabled ) {
			props.onCancel();
		}
	}
	return <Modal.Stack><Modal stackId={ stackId } opened={ props.opened } title={ props.name } size="lg" centered onClose={ close }
		withCloseButton={ false } closeOnClickOutside={ false } closeOnEscape={ ! props.disabled }
		returnFocus={ false }
		aria-busy={ props.disabled }>
		{ props.opened && <WebsiteEditorForm { ...props } onCancel={ close } /> }
	</Modal></Modal.Stack>;
}
