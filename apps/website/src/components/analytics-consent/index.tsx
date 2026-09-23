import { useEffect, useRef, useState } from 'react';
import { Button } from '@tocus/ui';
import {
	applyAnalyticsChoice, isAnalyticsWebsite, readAnalyticsChoice, saveAnalyticsChoice,
} from '../../services/website-analytics';
import { AnalyticsChoice } from '../../services/website-analytics/types';
import { ExternalLink } from '../site-links';
import type { AnalyticsConsentProps } from './types';
import './style.scss';

/**
 * Offers equal accept and reject controls without blocking website or extension use.
 * @param props - Localized website copy.
 * @param props.localization - Current language and translated consent controls.
 * @return Website-only consent prompt and its persistent preferences control.
 * @since 1.0.0
 */
export function AnalyticsConsent( { localization }: AnalyticsConsentProps ) {
	const [ available, setAvailable ] = useState( false );
	const [ open, setOpen ] = useState( false );
	const preferences = useRef<HTMLButtonElement>( null );
	const reject = useRef<HTMLButtonElement>( null );
	const { catalog } = localization;
	useEffect( () => {
		if ( ! isAnalyticsWebsite() ) {
			return;
		}
		setAvailable( true );
		/** Applies consent on entry and when another tab changes the saved choice. */
		const synchronize = () => {
			const choice = readAnalyticsChoice();
			setOpen( choice === null );
			applyAnalyticsChoice( choice );
		};
		synchronize();
		window.addEventListener( 'storage', synchronize );
		return () => {
			window.removeEventListener( 'storage', synchronize );
		};
	}, [] );
	if ( ! available ) {
		return null;
	}
	/**
	 * Records an explicit choice and keeps keyboard focus on an available control.
	 * @param choice - Visitor's accept or reject action.
	 */
	const choose = ( choice: AnalyticsChoice ) => {
		saveAnalyticsChoice( choice );
		setOpen( false );
		preferences.current?.focus( { preventScroll: true } );
	};
	return <>
		<Button ref={ preferences } variant="subtle" className="analytics-preferences" onClick={ () => {
			setOpen( true );
			requestAnimationFrame( () => reject.current?.focus( { preventScroll: true } ) );
		} }>{ catalog.analyticsPreferences }</Button>
		{ open && <section className="analytics-prompt" aria-labelledby="analytics-title">
			<h2 id="analytics-title">{ catalog.analyticsPromptTitle }</h2>
			<p>{ catalog.analyticsPromptDescription }{' '}
				<ExternalLink href={ `${ localization.path }privacy/#website-analytics` }>{ catalog.readPrivacy }</ExternalLink>
			</p>
			<div className="analytics-actions">
				<Button ref={ reject } variant="default" onClick={ () => {
					choose( AnalyticsChoice.REJECTED );
				} }>
					{ catalog.analyticsReject }
				</Button>
				<Button variant="default" onClick={ () => {
					choose( AnalyticsChoice.ACCEPTED );
				} }>
					{ catalog.analyticsAccept }
				</Button>
			</div>
		</section> }
	</>;
}
