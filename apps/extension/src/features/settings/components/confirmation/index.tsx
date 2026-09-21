import {
	Button,
	Group,
	Modal,
	ModalStackContext,
	Stack,
	Paper,
	FocusTrap,
	useFocusReturn,
} from '@tocus/ui';
import { use, useEffect, useId, useRef, useState } from 'react';
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
	const modalStack = use( ModalStackContext );
	const explicitReturn = modalStack !== null || props.returnFocusRef !== undefined;
	const restoreFrame = useRef( 0 );
	const restoreTimeout = useRef( 0 );
	const focusMoved = useRef( false );
	const [ completedExit, setCompletedExit ] = useState( 0 );
	const returnFocus = useFocusReturn( { opened: props.opened, shouldReturnFocus: props.inline ?? false } );
	useEffect( () => {
		focusMoved.current = false;
		/**
		 * Keeps a closing dialog from overriding the user's next keyboard or pointer action.
		 * @param event - Navigation or pointer interaction during the closing transition.
		 */
		function preserveFocus( event: KeyboardEvent | PointerEvent ): void {
			if ( event.type === 'pointerdown' || ( event instanceof KeyboardEvent && event.key === 'Tab' ) ) {
				focusMoved.current = true;
			}
		}
		if ( ! props.opened && explicitReturn ) {
			document.addEventListener( 'keydown', preserveFocus );
			document.addEventListener( 'pointerdown', preserveFocus );
		}
		return () => {
			cancelAnimationFrame( restoreFrame.current );
			window.clearTimeout( restoreTimeout.current );
			document.removeEventListener( 'keydown', preserveFocus );
			document.removeEventListener( 'pointerdown', preserveFocus );
		};
	}, [ props.opened, explicitReturn ] );
	useEffect( () => {
		if ( completedExit === 0 ) {
			return;
		}
		restoreFrame.current = requestAnimationFrame( () => {
			// The parent focus trap queues autofocus timers when the modal stack resumes it.
			// Run after those timers, which can outlive this frame with reduced motion.
			restoreTimeout.current = window.setTimeout( () => {
				if ( focusMoved.current ) {
					return;
				}
				if ( props.returnFocusRef?.current ) {
					props.returnFocusRef.current.focus();
				} else {
					returnFocus();
				}
			} );
		} );
		return () => {
			cancelAnimationFrame( restoreFrame.current );
			window.clearTimeout( restoreTimeout.current );
		};
	}, [ completedExit ] );
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
	/** Lets the closing render commit before restoring focus, including zero-duration transitions. */
	function restoreFocus(): void {
		setCompletedExit( ( current ) => current + 1 );
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
	return <Modal stackId={ titleId } opened={ props.opened } onClose={ close } title={ props.title }
		aria-busy={ pending }
		returnFocus={ ! explicitReturn } { ...( explicitReturn ? { onExitTransitionEnd: restoreFocus } : {} ) }
		closeOnClickOutside={ false } closeOnEscape={ ! pending } withCloseButton={ false } centered>
		{ content }
	</Modal>;
}
