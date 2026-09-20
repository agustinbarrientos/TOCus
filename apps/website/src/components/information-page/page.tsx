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
				<h1 id="page-title">How TOCus handles your data</h1>
				<p className="information-page-lede">
					The TOCus extension keeps its settings and statistics in your browser. It has no accounts,
					advertising, or analytics and does not send this information to the developer.
				</p>
				<p className="information-page-reviewed">Last reviewed September 15, 2026.</p>
			</header>

			<section id="extension-data" aria-labelledby="extension-data-title">
				<h2 id="extension-data-title">What the extension keeps locally</h2>
				<p>
					TOCus stores the rules and labels for your selected websites, shared pause timing, schedules,
					and your appearance and language preferences in your browser. Your settings remain available after
					the browser restarts. TOCus follows your operating system&apos;s motion preference.
				</p>
				<p>
					Statistics are local counts and durations: completed pauses, reconsidered visits, granted visits,
					focused pause time, and estimated reclaimed time.
					Lifetime and daily totals stay in your browser until you reset them.
					They do not contain page content or a history of web addresses.
					TOCus also stores the timing of active pauses and allowed browsing periods so they can continue.
				</p>
				<p>
					During a pause, TOCus may temporarily store the destination URL in browser session storage so
					Continue can open the page you requested. TOCus does not send that address, your settings,
					or your statistics to the developer or to an analytics, advertising, or data
					service.
				</p>
			</section>

			<section id="permissions" aria-labelledby="permissions-title">
				<h2 id="permissions-title">Why TOCus asks for browser permissions</h2>
				<p>
					TOCus asks for access to the selected websites where you want a pause. That site-specific access,
					scripting, and browser navigation rules let it detect a matching visit and show the pause. The
					optional navigation permission detects changes as they happen; it does not read your saved browsing
					history.
				</p>
				<p>
					Storage permission lets TOCus save your settings, and alarms keep its timers up to date. When you
					add a site from the toolbar, TOCus can use temporary access to the current tab. On Chrome, the
					favicon permission reads the site icon cached by your browser.
					TOCus does not contact an icon service.
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
					Reset all TOCus data deletes sites, schedules, timing, preferences, active pauses, and
					statistics, removes granted website access, and reopens setup.
				</p>
				<p>
					After a reset, TOCus may keep a random value in local storage so an older settings page cannot
					restore deleted data. The value marks the reset. It does not identify a person, device, account,
					or browsing activity.
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
				<h2 id="website-and-links-title">This website and external links</h2>
				<p>
					When you visit this website, your browser sends requests to the server that hosts it. These requests
					can include your IP address, browser user agent, the page requested, and the request time.
					The hosting service may record these requests in server logs.
					The website source does not add analytics, advertising trackers, remote fonts, or remote media.
				</p>
				<p>
					Links to GitHub, browser policies, extension stores, and the author&apos;s website open other
					websites whose privacy terms apply. Installing or updating TOCus can also contact your browser
					or store provider. These requests are separate from the extension sending data to the developer.
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
				<h1 id="page-title">Get help with TOCus</h1>
				<p className="information-page-lede">
					Check your site settings and permissions below. If you still need help, open a public issue on
					GitHub. Read the security reports section before sharing details of a suspected vulnerability.
				</p>
			</header>

			<section id="before-reporting" aria-labelledby="before-reporting-title">
				<h2 id="before-reporting-title">If a site does not pause</h2>
				<ol>
					<li>
						Open TOCus settings and confirm the website is saved, enabled, and
						active at the current day and time.
					</li>
					<li>
						Check that your browser allows TOCus to run on the website. You can review site access in your
						browser&apos;s extension settings, or remove and add the site again in TOCus to request access.
					</li>
					<li>
						Pause timing applies to all your selected websites. A site&apos;s custom schedule changes only
						its active days and hours. Without a custom schedule, it follows
						the main Schedule.
					</li>
				</ol>
			</section>

			<section id="resetting" aria-labelledby="resetting-title">
				<h2 id="resetting-title">Resetting TOCus</h2>
				<p>
					Reset statistics clears recorded counts and time totals while keeping your sites and settings.
					Reset all TOCus data removes your local configuration, active pauses, statistics, and website
					access, then starts setup again.
				</p>
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
					GitHub issues are public. Remove credentials, authentication data, personal information, private
					browsing data, your full site list, and any URL you would not publish. Check screenshots and logs
					before attaching them.
				</p>
			</section>

			<section id="security-reporting" aria-labelledby="security-reporting-title">
				<h2 id="security-reporting-title">Security reports</h2>
				<p>
					Private vulnerability reporting is not currently available for this repository, and no separate
					support email is published. Do not share vulnerability details, private URLs, credentials, or steps
					to reproduce a security issue in a public issue.
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
