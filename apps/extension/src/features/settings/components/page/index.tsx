import type {
	SettingsPageProps,
} from './types';
import './style.scss';


/**
 * Applies the same page hierarchy and width to every Settings destination.
 * @param props - Localized heading, optional introduction and destination content.
 * @return Owned-document main landmark.
 * @since 0.1.0
 */
export function Page( props: SettingsPageProps ) {
	return (
		<main className="tocus-page settings-page">
			<header className="tocus-page-header">
				{ props.eyebrow && <p className="settings-eyebrow">{ props.eyebrow }</p> }
				<h1 tabIndex={ -1 }>{ props.title }</h1>
				{ props.introduction && <p>{ props.introduction }</p> }
				{ props.headerContent }
			</header>
			{ props.children }
		</main>
	);
}
