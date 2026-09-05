import iconMarkup from '@tocus/theme/icon.svg?raw';
import {
	LitElement,
	css,
	html,
	unsafeCSS,
	type PropertyValues,
	type TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	createFocusedProgressClock,
	FocusedProgressClockTransition,
	type FocusedProgressClock,
	type FocusedProgressClockInput,
	type FocusedProgressClockTransition as FocusedProgressClockTransitionValue,
} from '../../services/focused-progress-clock';
import { getBreathingMotionFrame, BreathingMotionPhase } from '../../utils/breathing-motion';
import '../breathing-sphere';
import styles from './web-component-style.scss?inline';
import {
	InterruptionContinueRequestEventName,
	InterruptionRetryRequestEventName,
	InterruptionScreenAnnouncementKind,
	InterruptionScreenMode,
	InterruptionScreenState,
	type InterruptionScreenAnnouncementKind as InterruptionScreenAnnouncementKindValue,
	type InterruptionScreenCopy,
	type InterruptionScreenEnvironment,
} from './types';

const DEFAULT_WAIT_DURATION_MILLISECONDS = 10_000;
const SHORTCUT_KEY_PLACEHOLDER = '{key}';
const INTERACTIVE_SHORTCUT_TARGETS = [
	'a[href]',
	'button',
	'input',
	'select',
	'summary',
	'textarea',
	'[contenteditable]:not([contenteditable="false"])',
	'[role="button"]',
	'[role="checkbox"]',
	'[role="link"]',
	'[role="radio"]',
	'[role="switch"]',
	'[role="textbox"]',
	'[tabindex]:not([tabindex="-1"])',
].join( ',' );

/**
 * Reports whether the current document is visible.
 * @return Whether focused progress may advance in this document.
 */
function isDocumentVisible(): boolean {
	return document.visibilityState === 'visible';
}

/**
 * Reports whether the current browser window is focused.
 * @return Whether focused progress may advance in this window.
 */
function isWindowFocused(): boolean {
	return document.hasFocus();
}

const DefaultInterruptionScreenEnvironment: InterruptionScreenEnvironment = {
	cancelAnimationFrame: window.cancelAnimationFrame.bind( window ),
	clearTimeout: window.clearTimeout.bind( window ),
	isDocumentVisible,
	isWindowFocused,
	now: window.performance.now.bind( window.performance ),
	requestAnimationFrame: window.requestAnimationFrame.bind( window ),
	setTimeout: window.setTimeout.bind( window ),
};

/**
 * Splits one complete shortcut template around its keycap placeholder.
 * @param template - Complete localized shortcut message.
 * @return Text before and after the keycap.
 */
function splitShortcutTemplate( template: string ): readonly [ string, string ] {
	const placeholderIndex = template.indexOf( SHORTCUT_KEY_PLACEHOLDER );

	if ( placeholderIndex === -1 ) {
		return [ `${ template } `, '' ];
	}

	return [
		template.slice( 0, placeholderIndex ),
		template.slice( placeholderIndex + SHORTCUT_KEY_PLACEHOLDER.length ),
	];
}

/**
 * Determines whether a global shortcut originated from interactive content.
 * @param event - Keyboard event considered for the global Continue shortcut.
 * @return Whether native interaction must retain ownership of the event.
 */
function hasInteractiveShortcutTarget( event: KeyboardEvent ): boolean {
	return event.composedPath().some( ( target ) =>
		target instanceof Element && target.matches( INTERACTIVE_SHORTCUT_TARGETS ),
	);
}

/**
 * Renders the approved full-screen Waiting, Ready, Ready-expired, and unavailable presentation.
 * @element tocus-f-interruption-screen
 * @attr state - Authoritative presentation state.
 * @attr mode - Breathing or Quiet pause presentation.
 * @attr wait-duration-milliseconds - Captured wait duration.
 * @attr focused-progress-milliseconds - Latest authoritative focused progress.
 * @attr progressing - Whether the presentation owner currently permits progress.
 * @attr reduced-motion - Whether the sphere must remain still.
 * @attr recovering - Whether an unavailable pause is currently being recovered.
 * @attr preview - Whether this screen is a contained, looping presentation preview.
 * @attr wellbeing-summary - Complete localized all-time wellbeing sentence.
 * @fires ComponentInterruptionScreen#event:continueRequest - Emits the plain bubbling `tocus-continue-request` event from Ready.
 * @fires ComponentInterruptionScreen#event:retryRequest - Emits the plain bubbling `tocus-retry-request` event from Unavailable.
 * @summary Accessible full-viewport interruption presentation.
 * @since 0.1.0 Initial implementation.
 */
@customElement( 'tocus-f-interruption-screen' )
export class ComponentInterruptionScreen extends LitElement {
	static override styles = css`${ unsafeCSS( styles ) }`;

	/**
	 * Authoritative presentation state supplied by the owning page controller.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true } )
	accessor state: InterruptionScreenState = InterruptionScreenState.WAITING;

	/**
	 * Selected breathing or Quiet presentation mode.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true } )
	accessor mode: InterruptionScreenMode = InterruptionScreenMode.BREATHING;

	/**
	 * Captured wait duration represented by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'wait-duration-milliseconds', type: Number } )
	accessor waitDurationMilliseconds = DEFAULT_WAIT_DURATION_MILLISECONDS;

	/**
	 * Latest authoritative focused progress received from the presentation owner.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'focused-progress-milliseconds', type: Number } )
	accessor focusedProgressMilliseconds = 0;

	/**
	 * Whether the presentation owner currently permits local interpolation.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true, type: Boolean } )
	accessor progressing = false;

	/**
	 * Whether continuous visual motion is disabled.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'reduced-motion', reflect: true, type: Boolean } )
	accessor reducedMotion = false;

	/**
	 * Whether this screen fills a bounded preview and loops its presentation clock.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true, type: Boolean } )
	accessor preview = false;

	/**
	 * Whether the owning controller is currently attempting recovery.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { reflect: true, type: Boolean } )
	accessor recovering = false;

	/**
	 * Whether Ready may react to the page-level Space shortcut.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor continueShortcutEnabled = true;

	/**
	 * Complete localized messages rendered by the screen.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: false } )
	accessor copy!: Readonly<InterruptionScreenCopy>;

	/**
	 * Complete localized all-time wellbeing sentence shown in the footer.
	 * @since 0.1.0 Initial implementation.
	 */
	@property( { attribute: 'wellbeing-summary' } )
	accessor wellbeingSummary = '';

	private announcement = '';

	private announcementKind: InterruptionScreenAnnouncementKindValue =
		InterruptionScreenAnnouncementKind.WAITING_STARTED;

	private focusedState: InterruptionScreenState | null = null;

	private readonly environment: InterruptionScreenEnvironment;

	private readonly progressClock: FocusedProgressClock;

	/**
	 * Creates one interruption screen with browser timing defaults.
	 * @param environment - Presentation timing and attention dependencies.
	 * @since 0.1.0 Initial implementation.
	 */
	constructor(
		environment: InterruptionScreenEnvironment = DefaultInterruptionScreenEnvironment,
	) {
		super();
		this.environment = environment;
		this.progressClock = createFocusedProgressClock( {
			onProgress: this.handleClockProgress,
			timing: environment,
		} );
	}

	/**
	 * Handles the guarded global Space shortcut.
	 * @param event - Global keyboard event.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleGlobalKeydown = ( event: KeyboardEvent ): void => {
		if (
			! this.continueShortcutEnabled ||
			this.state !== InterruptionScreenState.READY ||
			event.code !== 'Space' ||
			event.repeat ||
			event.defaultPrevented ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey ||
			hasInteractiveShortcutTarget( event )
		) {
			return;
		}

		event.preventDefault();
		this.requestContinue();
	};

	/**
	 * Requests a render after locally displayed focused progress changes.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleClockProgress = (): void => {
		this.requestUpdate();
	};

	/**
	 * Reconciles focused progress after document visibility or window focus changes.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly handleAttentionChange = (): void => {
		const transition = this.progressClock.update(
			this.createProgressClockInput(),
			{ reanchor: false, reset: false },
		);

		this.applyClockTransition( transition );
		this.requestUpdate();
	};

	/**
	 * Starts global keyboard observation while the screen is connected.
	 * @since 0.1.0 Initial implementation.
	 */
	override connectedCallback(): void {
		super.connectedCallback();
		this.focusedState = null;
		window.addEventListener( 'keydown', this.handleGlobalKeydown );
		window.addEventListener( 'blur', this.handleAttentionChange );
		window.addEventListener( 'focus', this.handleAttentionChange );
		document.addEventListener( 'visibilitychange', this.handleAttentionChange );
		this.applyClockTransition( this.progressClock.connect( this.createProgressClockInput() ) );
		this.requestUpdate();
	}

	/**
	 * Releases global keyboard observation when the screen disconnects.
	 * @since 0.1.0 Initial implementation.
	 */
	override disconnectedCallback(): void {
		this.progressClock.disconnect();
		window.removeEventListener( 'keydown', this.handleGlobalKeydown );
		window.removeEventListener( 'blur', this.handleAttentionChange );
		window.removeEventListener( 'focus', this.handleAttentionChange );
		document.removeEventListener( 'visibilitychange', this.handleAttentionChange );
		super.disconnectedCallback();
	}

	/**
	 * Returns the focused progress currently displayed by the local presentation clock.
	 * @return Displayed focused progress in milliseconds.
	 * @since 0.1.0 Initial implementation.
	 */
	getFocusedProgressMilliseconds(): number {
		return this.progressClock.getProgressMilliseconds();
	}

	/**
	 * Updates the major-state announcement before rendering.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override willUpdate( changedProperties: PropertyValues<this> ): void {
		if (
			isLocalizationReady( this.copy ) &&
			(
				changedProperties.has( 'state' ) ||
				changedProperties.has( 'mode' ) ||
				changedProperties.has( 'waitDurationMilliseconds' ) ||
				changedProperties.has( 'focusedProgressMilliseconds' ) ||
				changedProperties.has( 'progressing' ) ||
				changedProperties.has( 'reducedMotion' ) ||
				changedProperties.has( 'preview' )
			)
		) {
			const reanchor = changedProperties.has( 'waitDurationMilliseconds' ) ||
				changedProperties.has( 'focusedProgressMilliseconds' );
			const reset = changedProperties.has( 'state' ) &&
				changedProperties.get( 'state' ) !== undefined &&
				this.state === InterruptionScreenState.WAITING;
			const transition = this.progressClock.update(
				this.createProgressClockInput(),
				{ reanchor, reset },
			);

			this.applyClockTransition( transition );
		}

		if ( changedProperties.has( 'state' ) ) {
			this.announcementKind = this.getStateAnnouncementKind();
		} else if (
			changedProperties.has( 'recovering' ) &&
			this.state === InterruptionScreenState.UNAVAILABLE
		) {
			if ( this.recovering ) {
				this.announcementKind = InterruptionScreenAnnouncementKind.RECOVERY_STARTED;
			} else if ( changedProperties.get( 'recovering' ) === true ) {
				this.announcementKind = InterruptionScreenAnnouncementKind.RECOVERY_FAILED;
			}
		}

		if (
			isLocalizationReady( this.copy ) &&
			(
				changedProperties.has( 'state' ) ||
				changedProperties.has( 'copy' ) ||
				changedProperties.has( 'recovering' )
			)
		) {
			this.announcement = this.resolveAnnouncement();
		}
	}

	/**
	 * Moves focus after authoritative state and recovery transitions.
	 * @param changedProperties - Reactive properties changed for this update.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override updated( changedProperties: PropertyValues<this> ): void {
		if ( ! isLocalizationReady( this.copy ) ) {
			return;
		}

		if ( this.focusedState !== this.state ) {
			const previousFocusedState = this.focusedState;

			this.focusedState = this.state;
			if (
				this.state === InterruptionScreenState.WAITING &&
				previousFocusedState === InterruptionScreenState.UNAVAILABLE
			) {
				this.focusElement( '.scene' );
			} else if ( this.state === InterruptionScreenState.READY ) {
				this.focusElement( '.continue-button' );
			} else if (
				this.state === InterruptionScreenState.READY_EXPIRED
			) {
				this.focusElement( '.status-message' );
			} else if ( this.state === InterruptionScreenState.UNAVAILABLE ) {
				this.focusElement( '.retry-button' );
			}
		} else if (
			this.state === InterruptionScreenState.UNAVAILABLE &&
			changedProperties.has( 'recovering' )
		) {
			if ( this.recovering ) {
				this.focusElement( '.scene' );
			} else if ( changedProperties.get( 'recovering' ) === true ) {
				this.focusElement( '.retry-button' );
			}
		}
	}

	/**
	 * Renders the complete full-viewport scene.
	 * @return Interruption-screen template.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override render(): TemplateResult {
		if ( ! isLocalizationReady( this.copy ) ) {
			return html``;
		}
		const waiting = this.state === InterruptionScreenState.WAITING;
		const ready = this.state === InterruptionScreenState.READY;
		const expired = this.state === InterruptionScreenState.READY_EXPIRED;
		const unavailable = this.state === InterruptionScreenState.UNAVAILABLE;
		const progressMilliseconds = this.progressClock.getProgressMilliseconds();
		const motionFrame = getBreathingMotionFrame(
			progressMilliseconds,
			this.waitDurationMilliseconds,
			this.reducedMotion,
		);
		const remainingSeconds = Math.ceil( motionFrame.remainingMilliseconds / 1_000 );
		const cue = this.mode === InterruptionScreenMode.QUIET
			? this.copy.takeAMoment
			: motionFrame.phase === BreathingMotionPhase.INHALE
				? this.copy.breatheIn
				: this.copy.breatheOut;
		const sphereStill = this.mode === InterruptionScreenMode.QUIET || this.reducedMotion || ! waiting;
		const breathProgress = sphereStill ? 0 : motionFrame.breathProgress;
		const sphereAlternative = sphereStill
			? this.copy.stillSphereAlternative
			: this.copy.sphereAlternative;

		return html`
			<div
				class="scene"
				style=${ styleMap( {
					'--tocus-breath-bloom-opacity': String( 0.72 + breathProgress * 0.28 ),
					'--tocus-breath-bloom-scale': String( 0.82 + breathProgress * 0.18 ),
					'--tocus-breath-progress': String( breathProgress ),
				} ) }
				tabindex=${ ifDefined( waiting || ( unavailable && this.recovering ) ? 0 : undefined ) }
			>
				<header>
					<div class="brand" aria-label="TOCus">
						<span class="brand-icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
						<span class="wordmark">TOCus</span>
					</div>
					${ waiting
						? html`<p class="remaining">${ this.copy.formatRemainingTime( remainingSeconds ) }</p>`
						: null }
				</header>
				<main>
					<section class="stage" aria-labelledby=${ ifDefined( waiting ? 'breathing-cue' : undefined ) }>
						${ waiting ? html`<h1 class="cue" id="breathing-cue">${ cue }</h1>` : null }
						<div class="sphere-shell">
							<tocus-f-breathing-sphere
								.breathProgress=${ breathProgress }
								.still=${ sphereStill }
							></tocus-f-breathing-sphere>
							${ waiting
								? html`<span class="sphere-alternative visually-hidden">${ sphereAlternative }</span>`
								: null }
						</div>
						${ ready ? this.renderReadyAction() : null }
						${ expired
							? html`<p class="status-message" tabindex="-1">${ this.copy.readyExpiredMessage }</p>`
							: null }
						${ unavailable
							? this.renderRecoveryAction()
							: null }
					</section>
				</main>
				<footer>${ this.wellbeingSummary }</footer>
			</div>
			<p class="visually-hidden" aria-atomic="true" aria-live="polite">${ this.announcement }</p>
		`;
	}

	/**
	 * Returns the announcement kind for the current major state.
	 * @return Current major-state announcement kind.
	 * @since 0.1.0 Initial implementation.
	 */
	private getStateAnnouncementKind(): InterruptionScreenAnnouncementKindValue {
		if ( this.state === InterruptionScreenState.READY ) {
			return InterruptionScreenAnnouncementKind.READY;
		}

		if ( this.state === InterruptionScreenState.READY_EXPIRED ) {
			return InterruptionScreenAnnouncementKind.READY_EXPIRED;
		}

		if ( this.state === InterruptionScreenState.UNAVAILABLE ) {
			return InterruptionScreenAnnouncementKind.UNAVAILABLE;
		}

		return InterruptionScreenAnnouncementKind.WAITING_STARTED;
	}

	/**
	 * Resolves the retained announcement kind through the current localized copy.
	 * @return Complete localized live-region message.
	 * @since 0.1.0 Initial implementation.
	 */
	private resolveAnnouncement(): string {
		if ( this.announcementKind === InterruptionScreenAnnouncementKind.PAUSED ) {
			return this.copy.pausedAnnouncement;
		}

		if ( this.announcementKind === InterruptionScreenAnnouncementKind.RECOVERY_FAILED ) {
			return this.copy.recoveryFailedAnnouncement;
		}

		if ( this.announcementKind === InterruptionScreenAnnouncementKind.RECOVERY_STARTED ) {
			return this.copy.recoveryStartedAnnouncement;
		}

		if ( this.announcementKind === InterruptionScreenAnnouncementKind.READY ) {
			return this.copy.readyAnnouncement;
		}

		if ( this.announcementKind === InterruptionScreenAnnouncementKind.READY_EXPIRED ) {
			return '';
		}

		if ( this.announcementKind === InterruptionScreenAnnouncementKind.UNAVAILABLE ) {
			return this.copy.unavailableMessage;
		}

		if ( this.announcementKind === InterruptionScreenAnnouncementKind.RESUMED ) {
			return this.copy.resumedAnnouncement;
		}

		return this.copy.waitingStartedAnnouncement;
	}

	/**
	 * Builds current presentation conditions for the focused-progress clock.
	 * @return Current focused-progress clock input.
	 * @since 0.1.0 Initial implementation.
	 */
	private createProgressClockInput(): FocusedProgressClockInput {
		return {
			authoritativeProgressMilliseconds: this.focusedProgressMilliseconds,
			continuous: this.mode === InterruptionScreenMode.BREATHING && ! this.reducedMotion,
			documentVisible: this.environment.isDocumentVisible(),
			durationMilliseconds: this.waitDurationMilliseconds,
			looping: this.preview,
			progressing: this.progressing,
			waiting: this.state === InterruptionScreenState.WAITING,
			windowFocused: this.environment.isWindowFocused(),
		};
	}

	/**
	 * Applies one user-facing transition reported by the focused-progress clock.
	 * @param transition - Clock transition to announce, or null when none occurred.
	 * @since 0.1.0 Initial implementation.
	 */
	private applyClockTransition( transition: FocusedProgressClockTransitionValue | null ): void {
		if ( transition === FocusedProgressClockTransition.PAUSED ) {
			this.setAnnouncementKind( InterruptionScreenAnnouncementKind.PAUSED );
		} else if ( transition === FocusedProgressClockTransition.RESUMED ) {
			this.setAnnouncementKind( InterruptionScreenAnnouncementKind.RESUMED );
		}
	}

	/**
	 * Replaces the retained polite announcement kind and localized message.
	 * @param announcementKind - New polite announcement kind.
	 * @since 0.1.0 Initial implementation.
	 */
	private setAnnouncementKind( announcementKind: InterruptionScreenAnnouncementKindValue ): void {
		this.announcementKind = announcementKind;
		this.announcement = this.resolveAnnouncement();
	}

	/**
	 * Renders the centered Ready action and localized keycap hint.
	 * @return Ready action template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderReadyAction(): TemplateResult {
		const [ beforeKey, afterKey ] = splitShortcutTemplate( this.copy.continueShortcut );

		return html`
			<div class="ready-action">
				<button class="continue-button" type="button" @click=${ this.requestContinue }>
					${ this.copy.continueLabel }
				</button>
				<p class="shortcut">${ beforeKey }<kbd>${ this.copy.spaceKeyLabel }</kbd>${ afterKey }</p>
			</div>
		`;
	}

	/**
	 * Renders the branded recovery action shown after automatic recovery fails.
	 * @return Unavailable recovery template.
	 * @since 0.1.0 Initial implementation.
	 */
	private renderRecoveryAction(): TemplateResult {
		return html`
			<section
				class="recovery-card"
				aria-busy=${ ifDefined( this.recovering ? 'true' : undefined ) }
				aria-describedby="recovery-message"
				aria-labelledby="recovery-title"
			>
				<span class="recovery-icon" aria-hidden="true">${ unsafeSVG( iconMarkup ) }</span>
				<h1 class="recovery-title" id="recovery-title">${ this.copy.unavailableTitle }</h1>
				<p class="recovery-message" id="recovery-message">${ this.copy.unavailableMessage }</p>
				<button
					class="retry-button"
					type="button"
					?disabled=${ this.recovering }
					@click=${ this.requestRetry }
				>
					${ this.recovering ? this.copy.retryingLabel : this.copy.retryLabel }
				</button>
			</section>
		`;
	}

	/**
	 * Focuses one stable control or status without moving the viewport.
	 * @param selector - Selector of the focus target in the shadow tree.
	 * @since 0.1.0 Initial implementation.
	 */
	private focusElement( selector: string ): void {
		const target = this.renderRoot.querySelector( selector );

		if ( target instanceof HTMLElement ) {
			target.focus( { preventScroll: true } );
		}
	}

	/**
	 * Emits one plain Continue request while Ready.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly requestContinue = (): void => {
		if ( this.state !== InterruptionScreenState.READY ) {
			return;
		}

		this.dispatchEvent( new Event( InterruptionContinueRequestEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};

	/**
	 * Emits one plain retry request while recovery is available.
	 * @since 0.1.0 Initial implementation.
	 */
	private readonly requestRetry = (): void => {
		if ( this.state !== InterruptionScreenState.UNAVAILABLE || this.recovering ) {
			return;
		}

		this.dispatchEvent( new Event( InterruptionRetryRequestEventName, {
			bubbles: true,
			composed: true,
		} ) );
	};
}

export {
	InterruptionContinueRequestEventName,
	InterruptionRetryRequestEventName,
	InterruptionScreenMode,
	InterruptionScreenState,
	type InterruptionScreenCopy,
	type InterruptionScreenEnvironment,
} from './types';

declare global {
	/**
	 * Maps the interruption-screen tag name to its element class.
	 * @since 0.1.0 Initial implementation.
	 */
	interface HTMLElementTagNameMap {
		'tocus-f-interruption-screen': ComponentInterruptionScreen;
	}
}
