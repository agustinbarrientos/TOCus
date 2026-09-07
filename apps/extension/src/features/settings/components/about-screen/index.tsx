import {
	Anchor,
	Brand,
	BrandSize,
	Icon, IconName,
	Group,
} from '@tocus/ui';
import {
	Page,
} from '../page';
import type {
	ProjectLinkProps,
} from './types';
import type {
	SettingsScreenProps,
} from '../page/types';


/**
 * Renders a user-opened project resource with a visible external-link indicator.
 * @param props - Canonical resource label and URL.
 * @return Safe external link with the shared new-tab explanation.
 * @since 0.1.0
 */
function ProjectLink( props: ProjectLinkProps ) {
	return (
		<Anchor className="tocus-external-link" href={ props.href } target="_blank"
			rel="noopener noreferrer" aria-describedby="external-links-hint">
			{ props.label }<Icon name={ IconName.ARROW_UP_RIGHT_FROM_SQUARE } />
		</Anchor>
	);
}


/**
 * Presents installed-version information and canonical project resources.
 * @param props - Settings services and complete localized About content.
 * @return Read-only About destination.
 * @since 0.1.0
 */
export function About( props: SettingsScreenProps ) {
	const { aboutCopy: copy, aboutVersion: version } = props.shell;
	const repository = 'https://github.com/agustinbarrientos/TOCus';
	const resources: ProjectLinkProps[] = [
		{ label: copy.sourceCode, href: repository },
		{ label: copy.suggestChanges, href: `${ repository }/issues/new?template=feature_request.yml` },
		{ label: copy.contribute, href: `${ repository }/blob/main/CONTRIBUTING.md` },
		{ label: copy.fork, href: `${ repository }/fork` },
		{ label: copy.license, href: `${ repository }/blob/main/LICENSE` },
	];

	return (
		<Page title={ copy.eyebrow } headerContent={ <>
			<div className="settings-about-brand"><Brand size={ BrandSize.HERO } /></div>
			{ version !== '' && <p className="settings-about-version">{ copy.formatVersion( version ) }</p> }
		</> }>
			<section className="tocus-section settings-about-section">
				<h2>{ copy.storyTitle }</h2>
				<ProjectLink label={ copy.creator }
					href="https://agustinbarrientos.com/about/?utm_source=tocus&utm_medium=extension&utm_campaign=about" />
				<p className="settings-about-story">{ copy.summary }</p>
			</section>
			<section className="tocus-section settings-about-section">
				<h2>{ copy.privacyTitle }</h2>
				<p className="settings-about-description">{ copy.privacyDescription }</p>
			</section>
			<section className="tocus-section settings-about-section">
				<h2>{ copy.linksTitle }</h2>
				<p className="settings-about-description">{ copy.linksDescription }</p>
				<p className="settings-about-description">{ copy.forkDescription }</p>
				<Group component="ul" className="settings-about-links">
					{ resources.map( ( resource ) => <li key={ resource.href }><ProjectLink { ...resource } /></li> ) }
				</Group>
				<p id="external-links-hint">{ copy.externalLinksHint }</p>
			</section>
		</Page>
	);
}
