import { OnboardingAnnouncementKind, OnboardingFailure } from '../../types/flow';
import { Alert, Button, Icon, IconName, TextInput, Title, UnstyledButton, VisuallyHidden } from '@tocus/ui';
import { resolveSiteDisplayIdentity } from '../../../protected-sites/utils/site-display-name-resolver';
import type { OnboardingSiteRowProps, OnboardingStepProps, OnboardingSuggestionProps } from '../../types/presentation';
import './styles.scss';

/**
 * Toggles one bundled suggestion without requesting browser permission on selection.
 * @param props - Fixed catalog entry and its current local selection.
 * @return A packaged button with an explicit pressed state and a bundled icon.
 */
function Suggestion( props: OnboardingSuggestionProps ) {
	const { suggestion, selected, controller } = props;
	return (
		<UnstyledButton className="suggestion" aria-pressed={ !! selected }
			disabled={ controller.pending }
			onClick={ () => {
				if ( selected ) {
					void controller.removeSite( selected );
				} else {
					controller.addSite( suggestion.siteInput );
				}
			} }>
			<span className="site-icon" aria-hidden="true"><img src={ suggestion.iconUrl } alt="" /></span>
			<strong>{ suggestion.displayName }</strong>
			{ selected && <Icon className="selection-mark" name={ IconName.CIRCLE_CHECK } /> }
		</UnstyledButton>
	);
}

/**
 * Presents one chosen website with a clear, focus-restoring removal action.
 * @param props - Canonical rule, optional bundled icon and localized removal label.
 * @return A flat list row rather than a second selectable card.
 */
function ChosenSite( props: OnboardingSiteRowProps ) {
	const { site, suggestion, copy, controller } = props;
	const identity = resolveSiteDisplayIdentity( site );
	return (
		<li className="added-site">
			<span className="site-icon" aria-hidden="true">
				{ suggestion ? <img src={ suggestion.iconUrl } alt="" /> : <span className="monogram">{ identity.monogram }</span> }
			</span>
			<div className="site-identity">
				<strong>{ identity.name }</strong>
				<span>{ site.rule.host }</span>
			</div>
			<Button className="onboarding-remove remove-action" variant="outline"
				px="var(--tocus-space-3)"
				disabled={ controller.pending } aria-label={ `${ copy.removeSiteLabel }: ${ identity.name }` }
				onClick={ ( event ) => {
					void controller.removeSite( site, event.currentTarget );
				} }>
				{ copy.removeSiteLabel }
			</Button>
		</li>
	);
}

/**
 * Formats selection feedback from semantic state so it follows live language changes.
 * @param props - Localization and retained error or announcement state.
 * @return Distinct accessible error and success messages, when present.
 */
function SiteFeedback( props: OnboardingStepProps ) {
	const { controller, copy } = props;
	const { announcement, failure } = controller;
	const isManualFailure = failure === OnboardingFailure.INVALID_SITE ||
		failure === OnboardingFailure.ALREADY_PROTECTED;
	let message = '';
	if ( announcement?.kind === OnboardingAnnouncementKind.REMOVED ) {
		message = copy.sites.formatRemovedAnnouncement( announcement.name );
	} else if ( announcement?.kind === OnboardingAnnouncementKind.RETAINED ) {
		message = copy.sites.formatPermissionRetainedAnnouncement( announcement.name );
	}
	return (
		<>
			{ failure && ! isManualFailure && (
				<Alert className="finish-error" role="alert" color="red" icon={ <Icon name={ IconName.EXCLAMATION } /> }>
					{ copy.sites[ failure ] }
				</Alert>
			) }
			{ announcement && announcement.kind !== OnboardingAnnouncementKind.ADDED && (
				<Alert className="removal-status" key={ announcement.sequence } role="status"
					color={ announcement.kind === OnboardingAnnouncementKind.RETAINED ? 'yellow' : 'green' }
					icon={ <Icon name={ announcement.kind === OnboardingAnnouncementKind.RETAINED
						? IconName.EXCLAMATION : IconName.CIRCLE_CHECK } /> }>
					{ message }
				</Alert>
			) }
		</>
	);
}

/**
 * Collects a local website draft and submits all new domains through one Finish gesture.
 * @param props - Authoritative sites, local draft controller and packaged localized copy.
 * @return The suggestion picker, address form, selected list and final action.
 * @since 0.1.0
 */
export function SitesStep( props: OnboardingStepProps ) {
	const { state, copy, controller } = props;
	const hasAddress = controller.address.trim() !== '';
	const manualFailure = controller.failure === OnboardingFailure.INVALID_SITE ||
		controller.failure === OnboardingFailure.ALREADY_PROTECTED
		? copy.sites[ controller.failure ] : '';
	return (
		<div className="onboarding-sites-step">
			<section className="suggestions" aria-labelledby="onboarding-suggestions-title">
				<div className="section-heading">
					<Title id="onboarding-suggestions-title" order={ 2 }>{ copy.sites.suggestionsLegend }</Title>
				</div>
				<div className="suggestion-grid">
					{ state.suggestions.map( ( suggestion ) => (
						<Suggestion key={ suggestion.id } suggestion={ suggestion } controller={ controller }
							selected={ controller.sites.find( ( site ) => site.rule.host === suggestion.ruleHost ) } />
					) ) }
				</div>
			</section>
			<form className="manual-form" onSubmit={ ( event ) => {
				event.preventDefault();
				if ( hasAddress ) {
					controller.addSite( controller.address );
				}
			} }>
				<Title order={ 2 }>{ copy.sites.manualLegend }</Title>
				<div className="manual-control">
					<TextInput ref={ controller.addressInputRef } radius="xl"
						styles={ { input: { paddingInline: 'var(--tocus-space-4)' } } }
						aria-label={ copy.sites.addressLabel } placeholder={ copy.sites.addressPlaceholder }
						attributes={ { input: {
							'aria-invalid': manualFailure !== '',
							'aria-describedby': 'onboarding-site-help onboarding-manual-error',
						} } } value={ controller.address }
						onChange={ ( event ) => {
							controller.setAddress( event.currentTarget.value );
						} }
						disabled={ controller.pending } autoComplete="off" />
					<Button className="tocus-native-button" type="submit" variant={ hasAddress ? 'filled' : 'outline' }
						aria-disabled={ controller.pending || ! hasAddress } disabled={ controller.pending }>
						{ copy.sites.addSiteLabel }
					</Button>
				</div>
				<p className="field-help" id="onboarding-site-help">{ copy.sites.addressHelp }</p>
				<div className="manual-error" id="onboarding-manual-error" role={ manualFailure ? 'alert' : undefined }>
					{ manualFailure }
				</div>
			</form>
			{ controller.sites.length > 0 && (
				<ul className="added-sites">
					{ controller.sites.map( ( site ) => (
						<ChosenSite key={ site.identityHost } site={ site } copy={ copy.sites }
							controller={ controller } suggestion={ state.suggestions.find(
								( candidate ) => candidate.ruleHost === site.rule.host,
							) } />
					) ) }
				</ul>
			) }
			<SiteFeedback { ...props } />
			{ controller.drafts.length > 0 && <p className="field-help">{ copy.sites.finishHelp }</p> }
			<div className="actions">
				<Button className="finish-action tocus-action-raised" loading={ controller.pending } disabled={ controller.pending }
					h="auto" px="var(--tocus-space-6)"
					onClick={ () => {
						void controller.finish();
					} }>{ copy.sites.finishLabel }</Button>
			</div>
			{ /* Keep the live region mounted before adding messages so assistive technology observes its updates. */ }
			<VisuallyHidden component="p" role="status" aria-live="polite">
				{ controller.announcement?.kind === OnboardingAnnouncementKind.ADDED && (
					<span key={ controller.announcement.sequence }>
						{ copy.sites.formatAddedAnnouncement( controller.announcement.name ) }
					</span>
				) }
			</VisuallyHidden>
		</div>
	);
}
