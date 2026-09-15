import {
	Button,
	Group,
	Modal,
	Stack,
	Paper,
	FocusTrap,
	useFocusReturn,
} from '@tocus/ui';
import { useEffect, useId, useRef } from 'react';
import type {
	ConfirmationProps,
} from './types';
import './style.scss';
import { Feedback } from '../feedback';


/**
 * Shares focus containment, Escape and safe-first-action behavior for confirmations.
 * @param props - Localized decision, pending state and explicit confirmation callbacks.
 * @return Packaged dialog hosted in the owned extension document.
 * @since 0.1.0
 */
export function Confirmation( props: ConfirmationProps ) {
	const pending = props.pending ?? false;
	const titleId = useId();
	const confirmButton = useRef<HTMLButtonElement>( null );
	const saveButton = useRef<HTMLButtonElement>( null );
	useFocusReturn( { opened: props.opened && ( props.inline ?? false ) } );
	useEffect( () => {
		if ( props.opened && props.focusConfirm && ! pending ) {
			confirmButton.current?.focus();
		}
	}, [ props.opened, props.focusConfirm, pending ] );
	useEffect( () => {
		if ( ! pending && props.error ) {
			saveButton.current?.focus();
		}
	}, [ pending, props.error ] );
	/** Allows cancellation only before the confirmed mutation starts. */
	function close(): void {
		if ( ! pending ) {
			props.onCancel();
		}
	}
	const content = <Stack gap={ props.inline ? 0 : 'var(--tocus-space-5)' }>
		<p>{ props.description }</p>
		{ props.children }
		<Feedback error={ props.error ?? null } />
		<Group className="tocus-form-actions" justify={ props.inline ? undefined : 'flex-end' }>
			<Button variant="outline" data-autofocus={ ! props.focusConfirm || undefined }
				disabled={ pending } onClick={ props.onCancel }>
				{ props.cancel }
			</Button>
			<Button ref={ confirmButton } color="red" variant={ props.save ? 'outline' : 'filled' }
				data-autofocus={ props.focusConfirm || undefined }
				disabled={ pending } onClick={ props.onConfirm }>
				{ props.confirm }
			</Button>
			{ props.save && <Button ref={ saveButton } loading={ pending } disabled={ pending }
				onClick={ props.save.onSave }>
				{ pending ? props.save.pendingLabel : props.save.label }
			</Button> }
		</Group>
	</Stack>;
	if ( props.inline ) {
		return props.opened && <FocusTrap active>
			<Paper className="settings-inline-confirmation" role="dialog" aria-labelledby={ titleId }
				withBorder radius="var(--tocus-radius-small)"
				p="var(--tocus-space-4)"
				onKeyDown={ ( event ) => {
					if ( event.key === 'Escape' ) {
						event.stopPropagation(); close();
					}
				} }>
				<h3 id={ titleId }>{ props.title }</h3>
				{ content }
			</Paper>
		</FocusTrap>;
	}
	return <Modal opened={ props.opened } onClose={ close } title={ props.title } aria-busy={ pending }
		closeOnClickOutside={ false } closeOnEscape={ ! pending } withCloseButton={ false } centered>
		{ content }
	</Modal>;
}
