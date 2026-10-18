import { Button } from '@tocus/ui';
import type { ResetSectionProps } from './types';
import '../backup-reset-screen/style.scss';

/**
 * Groups one reset explanation with its explicitly confirmed action.
 * @param props - Localized copy, availability and confirmation content.
 * @return Shared full-width reset section.
 * @since 1.1.0
 */
export function ResetSection( props: ResetSectionProps ) {
	return <section className="tocus-section settings-data-reset">
		<h2>{ props.title }</h2>
		<p>{ props.description }</p>
		<Button color="red" classNames={ { label: 'settings-reset-action-label' } }
			disabled={ props.disabled } onClick={ props.onRequest }>{ props.label }</Button>
		{ props.children }
	</section>;
}
