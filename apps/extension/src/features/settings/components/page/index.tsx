import type {
	SettingsPageProps,
} from './types';
import './style.scss';


/**
 * Applies the same page hierarchy and width to every Settings destination.
 * @param props - Localized heading, optional brand content and destination content.
 * @return Owned-document main landmark.
 * @since 0.1.0
 */
export function Page( props: SettingsPageProps ) {
	return (
		<main className="tocus-page settings-page">
			<header className="tocus-page-header">
				<h1 tabIndex={ -1 }>{ props.title }</h1>
				{ props.headerContent }
			</header>
			{ props.children }
		</main>
	);
}
