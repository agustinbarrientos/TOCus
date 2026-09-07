import {
	Button,
	Group,
} from '@tocus/ui';
import { useEffect, useRef } from 'react';
import type {
	DraftActionsProps,
} from './types';


/**
 * Keeps Save and Discard availability consistent across all editable pages.
 * @param props - Observable draft, canonical button labels and save callback.
 * @return Shared actions disabled while unchanged or being persisted.
 * @since 0.1.0
 */
export function DraftActions<T extends object>( props: DraftActionsProps<T> ) {
	const { dirty, saving } = props.draft.snapshot;
	const actions = useRef<HTMLDivElement>( null );
	const restoreFocus = useRef( false );

	useEffect( () => {
		if ( saving || ! restoreFocus.current ) {
			return;
		}
		restoreFocus.current = false;
		const page = actions.current?.closest( 'main' );
		const target = page?.querySelector<HTMLElement>( '[aria-invalid="true"]' )
			?? page?.querySelector<HTMLElement>( '[role="slider"], input[type="range"]' )
			?? page?.querySelector<HTMLElement>( '[role="radio"][aria-checked="true"], input[type="radio"]:checked' )
			?? page?.querySelector<HTMLElement>( 'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled)' );
		target?.focus();
	} );

	/** Runs the page save and restores editing focus after its pending transition settles. */
	function save(): void {
		restoreFocus.current = true;
		props.onSave();
	}

	/** Discards without writing and returns focus before these actions become disabled. */
	function discard(): void {
		restoreFocus.current = true;
		props.draft.discard();
	}

	return (
		<Group ref={ actions } className="tocus-form-actions">
			<Button type="button" disabled={ ! dirty || saving } loading={ saving } onClick={ save }>
				{ saving ? props.copy.saving : props.copy.save }
			</Button>
			<Button variant="outline" disabled={ ! dirty || saving } onClick={ discard }>
				{ props.copy.discard }
			</Button>
		</Group>
	);
}
