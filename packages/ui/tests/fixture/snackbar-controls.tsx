import { useEffect, useRef, useState } from 'react';
import { Button, SnackbarProvider, SnackbarTone, useSnackbar } from '../../src';
import type { SnackbarFixtureControlsProps } from './snackbar-types';

/**
 * Uses the public feedback API through real controls without exposing a library store.
 * @param props - Language state used by an effect that emits completed feedback.
 * @return Feedback actions and the API stability result observed by a consumer.
 */
function SnackbarControls( props: SnackbarFixtureControlsProps ) {
	const snackbar = useSnackbar();
	const initialApi = useRef( snackbar );
	useEffect( () => {
		if ( props.closeLabel === 'Cerrar aviso' ) {
			snackbar.show( { message: 'Preferences saved', tone: SnackbarTone.SUCCESS } );
		}
	}, [ props.closeLabel, snackbar ] );
	return <>
		<Button onClick={() => {
			snackbar.show( { message: 'Preferences saved', tone: SnackbarTone.SUCCESS } );
		}}>Show success</Button>
		<Button onClick={() => {
			snackbar.show( { message: 'No changes to save' } );
		}}>Show information</Button>
		<Button onClick={() => {
			snackbar.show( { message: 'First preferences saved', tone: SnackbarTone.SUCCESS } );
			snackbar.show( { message: 'Second preferences saved', tone: SnackbarTone.SUCCESS } );
			snackbar.show( { message: 'Latest preferences saved', tone: SnackbarTone.SUCCESS } );
		}}>Show consecutive feedback</Button>
		<span aria-label="Stable snackbar API">{String( initialApi.current === snackbar )}</span>
	</>;
}

/**
 * Exercises locale updates without replacing the feedback provider or consumer.
 * @since 0.1.0
 * @return One localized private feedback boundary.
 */
export function SnackbarFixture() {
	const [ closeLabel, setCloseLabel ] = useState( 'Dismiss notification' );
	return <SnackbarProvider closeLabel={closeLabel}>
		<Button onClick={() => {
			setCloseLabel( 'Cerrar aviso' );
		}}>Use Spanish dismissal</Button>
		<SnackbarControls closeLabel={closeLabel} />
	</SnackbarProvider>;
}
