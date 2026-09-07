import { Anchor, Brand, TocusAppearance, TocusProvider } from '@tocus/ui';
import { DownloadLink } from '../download-links';
import { ExternalLink, WebsiteLink } from '../site-links';
import {
	InformationDocument,
	InformationExternalUrl,
	InformationRoute,
	type InformationPageProperties,
} from './types';

/**
 * Renders the canonical privacy statement for the current local-first extension behavior.
 * @return Readable privacy sections with explicit product and website boundaries.
 * @since 0.1.0 Initial implementation.
 */
function PrivacyContent() {
	return (
		<>
			<header className="information-page-introduction">
				<p className="information-page-eyebrow">Privacy</p>
				<h1 id="page-title">Your choices stay with you</h1>
				<p className="information-page-lede">
					TOCus has no account, advertising, or analytics. The extension keeps the information it needs in
					your browser and does not transmit it to the developer.
				</p>
				<p className="information-page-reviewed">Last reviewed September 7, 2026.</p>
			</header>

			<section id="extension-data" aria-labelledby="extension-data-title">
				<h2 id="extension-data-title">What the extension keeps locally</h2>
				<p>
					TOCus saves your selected-site rules and labels, shared or separate timing choices, schedules, and
					preferences such as appearance, motion, and language in extension-local browser storage. This
					information makes your setup available after the browser restarts.
				</p>
				<p>
					Statistics are local counts and durations: completed pauses, reconsidered visits, granted visits,
					focused pause time, and estimated reclaimed time. They do not contain page content or a history of
					web addresses. TOCus also keeps limited timing and allowance state so an active pause can continue
					reliably.
				</p>
				<p>
					While a pause is active, its destination address or URL can be held temporarily in browser session
					storage so Continue can return you to the page you requested. TOCus does not send that address,
					your configuration, or your statistics to the developer or to an analytics, advertising, or data
					service.
				</p>
			</section>

			<section id="permissions" aria-labelledby="permissions-title">
				<h2 id="permissions-title">Why browser permissions are requested</h2>
				<p>
					TOCus asks for access to the selected websites where you want a pause. That site-specific access,
					scripting, and browser navigation rules let it detect a matching visit and show the pause. The
					optional navigation permission notices changes as they happen; it does not read your saved browsing
					history.
				</p>
				<p>
					Local storage saves the choices described above, alarms keep timing current, and the toolbar action
					can use temporary access to the current tab when you ask to add it. On Chrome, the favicon
					permission
					reads a browser-cached icon for a saved site; TOCus does not contact an icon service.
				</p>
				<p>
					Without access to a site, TOCus cannot show its pause there. You can remove a site in TOCus or
					change access through your browser&apos;s extension settings.
				</p>
			</section>

			<section id="deletion" aria-labelledby="deletion-title">
				<h2 id="deletion-title">Reset and deletion controls</h2>
				<p>
					Reset statistics deletes recorded counts and time totals while preserving your sites and settings.
					Reset all TOCus data deletes sites, groups, schedules, timing, preferences, active pauses, and
					statistics, removes granted website access, and reopens setup.
				</p>
				<p>
					A reset may leave a random technical generation marker in local storage so an older open settings
					page cannot restore deleted data. The marker identifies a reset boundary, not a person, device,
					account, or browsing activity.
				</p>
			</section>

			<section id="limited-use" aria-labelledby="limited-use-title">
				<h2 id="limited-use-title">Chrome Limited Use disclosure</h2>
				<p>
					TOCus uses information received from Chrome APIs only to provide or improve its user-facing purpose:
					placing a deliberate pause before websites you select. This use will adhere to the{' '}
					<ExternalLink href={ InformationExternalUrl.CHROME_LIMITED_USE }>
						Chrome Web Store User Data Policy, including the Limited Use requirements
					</ExternalLink>. The extension does not transfer this information, use it for advertising, or make
					it available for humans to read.
				</p>
			</section>

			<section id="website-and-links" aria-labelledby="website-and-links-title">
				<h2 id="website-and-links-title">This website and voluntary links</h2>
				<p>
					Loading this website makes ordinary requests to its hosting server. Those requests can include
					technical delivery data such as your IP address, browser user agent, requested path, and time of
					request. The specific production hosting provider and its log-retention period are not yet
					finalized.
					The website source does not add analytics, advertising trackers, remote fonts, or remote media.
				</p>
				<p>
					Following an external or outbound link—such as GitHub, a browser policy, a store listing, or the
					author&apos;s site—is a deliberate navigation to that third party, whose own privacy terms apply.
					Installing or updating an extension can also contact your browser or store provider; that traffic is
					separate from TOCus sending extension data to the developer.
				</p>
			</section>
		</>
	);
}

/**
 * Renders canonical troubleshooting and reporting routes without inventing a private contact.
 * @return Actionable setup, public issue, and security-reporting guidance.
 * @since 0.1.0 Initial implementation.
 */
function SupportContent() {
	return (
		<>
			<header className="information-page-introduction">
				<p className="information-page-eyebrow">Support</p>
				<h1 id="page-title">Get TOCus back on track</h1>
				<p className="information-page-lede">
					Start with the local checks below. If the problem remains, use the public issue form for ordinary
					support. For a suspected vulnerability, read the security-reporting status before sharing details.
				</p>
			</header>

			<section id="before-reporting" aria-labelledby="before-reporting-title">
				<h2 id="before-reporting-title">Check setup, reset, and permissions</h2>
				<ol>
					<li>
						<strong>Check the site.</strong>{' '}
						Open TOCus settings and confirm the website is saved, enabled, and
						covered by the schedule you expect.
					</li>
					<li>
						<strong>Check permission.</strong>{' '}
						Your browser must allow TOCus to run on that selected website. Remove and add the site again to
						request access, or review the extension&apos;s site-access settings in
						your browser.
					</li>
					<li>
						<strong>Check timing.</strong>{' '}Check whether this website has its own timing or schedule, then
						confirm you are editing the choices that apply to it.
					</li>
					<li>
						<strong>Reset only what you mean to clear.</strong>{' '}
						Reset statistics preserves sites and settings.
						Reset all TOCus data removes local configuration and website access, then starts setup again.
					</li>
				</ol>
			</section>

			<section id="public-issues" aria-labelledby="public-issues-title">
				<h2 id="public-issues-title">Ask for help or report a bug</h2>
				<p>
					Use the{' '}
					<ExternalLink href={ InformationExternalUrl.ISSUES }>public TOCus issue form</ExternalLink> for
					reproducible bugs, setup questions, and feature requests. Search existing issues first, then include
					your browser and TOCus version, the steps you took, what you expected, and what happened.
				</p>
				<p>
					Public reports are visible to everyone. Do not include credentials, authentication data, personal
					information, private browsing data, your full list of selected websites, or an exact URL you would
					not publish. Redact screenshots and logs before attaching them.
				</p>
			</section>

			<section id="security-reporting" aria-labelledby="security-reporting-title">
				<h2 id="security-reporting-title">Security reports</h2>
				<p>
					Private vulnerability reporting is not currently available for this repository. Do not put security
					vulnerability details, private URLs, credentials, or reproduction material in a public issue.
				</p>
				<p>
					A verified private reporting channel will appear here after it is enabled. No separate support email
					is currently published.
				</p>
			</section>
		</>
	);
}

const InformationContent = {
	[ InformationDocument.PRIVACY ]: PrivacyContent,
	[ InformationDocument.SUPPORT ]: SupportContent,
} as const;

/**
 * Renders publication navigation shared by both canonical documents.
 * @return Branded site header.
 * @since 0.1.0 Initial implementation.
 */
function InformationHeader() {
	return (
		<header className="site-header information-site-header">
			<Anchor aria-label="TOCus home" className="information-brand-link" href={ InformationRoute.HOME }>
				<Brand />
			</Anchor>
			<DownloadLink label="Download TOCus" />
		</header>
	);
}

/**
 * Renders the stable publication footer and local author artwork.
 * @return Internal documents plus source and author destinations.
 * @since 0.1.0 Initial implementation.
 */
function InformationFooter() {
	return (
		<footer className="information-footer">
			<nav aria-label="TOCus information">
				<Anchor href={ InformationRoute.HOME }>Home</Anchor>
				<Anchor href={ InformationRoute.PRIVACY }>Privacy</Anchor>
				<Anchor href={ InformationRoute.SUPPORT }>Support</Anchor>
				<ExternalLink href={ WebsiteLink.SOURCE }>Source</ExternalLink>
			</nav>
			<ExternalLink className="information-author" href={ WebsiteLink.AUTHOR }>
				<img src="/images/author-favicon.png" width="28" height="28" alt="" />
				<span>Made by Agustin Barrientos</span>
			</ExternalLink>
		</footer>
	);
}

/**
 * Renders one canonical information document in the shared public-site shell.
 * @param properties - Canonical publication document selection.
 * @param properties.document - Canonical document to render.
 * @return Server-rendered information page.
 * @since 0.1.0 Initial implementation.
 */
export default function InformationPage( { document }: InformationPageProperties ) {
	const Content = InformationContent[ document ];

	return (
		<TocusProvider appearance={ TocusAppearance.LIGHT }>
			<div className="website">
				<Anchor className="skip-link" href="#main-content">Skip to content</Anchor>
				<div className="page-shell information-shell">
					<InformationHeader />
					<main className="information-page" id="main-content" aria-labelledby="page-title" tabIndex={ -1 }>
						<Content />
					</main>
					<InformationFooter />
				</div>
			</div>
		</TocusProvider>
	);
}
