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
	useFocusReturn( { opened: props.opened && ( props.inline ?? false ) } );
	useEffect( () => {
		if ( props.opened && props.focusConfirm && ! pending ) {
			confirmButton.current?.focus();
		}
	}, [ props.opened, props.focusConfirm, pending ] );
	/** Allows cancellation only before the confirmed mutation starts. */
	function close(): void {
		if ( ! pending ) {
			props.onCancel();
		}
	}
	const content = <Stack gap={ props.inline ? 0 : 'sm' }>
		<p>{ props.description }</p>
		{ props.children }
		<Group className="tocus-form-actions">
			<Button className={ props.minimal ? 'tocus-native-button' : undefined }
				variant="outline" data-autofocus={ ! props.focusConfirm || undefined }
				disabled={ pending } onClick={ props.onCancel }>
				{ props.cancel }
			</Button>
			<Button className={ props.minimal ? 'tocus-native-button' : undefined }
				ref={ confirmButton } color="red" data-autofocus={ props.focusConfirm || undefined }
				disabled={ pending } onClick={ props.onConfirm }>
				{ props.confirm }
			</Button>
		</Group>
	</Stack>;
	if ( props.inline ) {
		return props.opened && <FocusTrap active>
			<Paper className="settings-inline-confirmation" data-minimal={ props.minimal || undefined }
				role="dialog" aria-labelledby={ props.minimal ? undefined : titleId }
				aria-label={ props.minimal ? props.title : undefined }
				withBorder radius={ 0 }
				p="var(--tocus-space-4)"
				{ ...( props.minimal ? { pt: 'var(--tocus-space-5)' } : {} ) }
				onKeyDown={ ( event ) => {
					if ( event.key === 'Escape' ) {
						event.stopPropagation(); close();
					}
				} }>
				{ ! props.minimal && <h3 id={ titleId }>{ props.title }</h3> }
				{ content }
			</Paper>
		</FocusTrap>;
	}
	return <Modal opened={ props.opened } onClose={ close } title={ props.title }
		closeOnClickOutside={ false } closeOnEscape={ ! pending } withCloseButton={ false } centered>
		{ content }
	</Modal>;
}
