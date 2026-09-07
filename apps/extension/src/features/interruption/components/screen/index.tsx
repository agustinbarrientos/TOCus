import type { ReactNode } from 'react';
import { PresentationElement } from '../../utils/presentation-element';
import type { PresentationChanges } from '../../utils/presentation-element/types';
import { observePresentationAppearance } from '../../utils/presentation-appearance';
import { ScreenView } from './view';
import { isLocalizationReady } from '../../../../localization/utils/is-localization-ready';
import {
	createFocusedProgressClock,
	FocusedProgressClockTransition,
	type FocusedProgressClock,
	type FocusedProgressClockInput,
	type FocusedProgressClockTransition as FocusedProgressClockTransitionValue,
} from '../../services/focused-progress-clock';
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
export class ComponentInterruptionScreen extends PresentationElement {
	/**
	 * Current state input supplied by the presentation owner.
	 * @return Current state input supplied by the presentation owner.
	 */
	get state(): InterruptionScreenState {
		return this.stateInput;
	}

	/**
	 * Applies the next state controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set state( value: InterruptionScreenState ) {
		const previous = this.stateInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.stateInput = value;
		this.setAttribute( 'state', value );
		this.requestUpdate( 'state', previous );
	}

	private stateInput: InterruptionScreenState = InterruptionScreenState.WAITING;

	/**
	 * Current mode input supplied by the presentation owner.
	 * @return Current mode input supplied by the presentation owner.
	 */
	get mode(): InterruptionScreenMode {
		return this.modeInput;
	}

	/**
	 * Applies the next mode controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set mode( value: InterruptionScreenMode ) {
		const previous = this.modeInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.modeInput = value;
		this.setAttribute( 'mode', value );
		this.requestUpdate( 'mode', previous );
	}

	private modeInput: InterruptionScreenMode = InterruptionScreenMode.BREATHING;

	/**
	 * Current wait duration milliseconds input supplied by the presentation owner.
	 * @return Current wait duration milliseconds input supplied by the presentation owner.
	 */
	get waitDurationMilliseconds(): number {
		return this.waitDurationMillisecondsInput;
	}

	/**
	 * Applies the next wait duration milliseconds controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set waitDurationMilliseconds( value: number ) {
		const previous = this.waitDurationMillisecondsInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.waitDurationMillisecondsInput = value;
		this.requestUpdate( 'waitDurationMilliseconds', previous );
	}

	private waitDurationMillisecondsInput: number = DEFAULT_WAIT_DURATION_MILLISECONDS;

	/**
	 * Current focused progress milliseconds input supplied by the presentation owner.
	 * @return Current focused progress milliseconds input supplied by the presentation owner.
	 */
	get focusedProgressMilliseconds(): number {
		return this.focusedProgressMillisecondsInput;
	}

	/**
	 * Applies the next focused progress milliseconds controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set focusedProgressMilliseconds( value: number ) {
		const previous = this.focusedProgressMillisecondsInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.focusedProgressMillisecondsInput = value;
		this.requestUpdate( 'focusedProgressMilliseconds', previous );
	}

	private focusedProgressMillisecondsInput: number = 0;

	/**
	 * Current progressing input supplied by the presentation owner.
	 * @return Current progressing input supplied by the presentation owner.
	 */
	get progressing(): boolean {
		return this.progressingInput;
	}

	/**
	 * Applies the next progressing controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set progressing( value: boolean ) {
		const previous = this.progressingInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.progressingInput = value;
		this.toggleAttribute( 'progressing', value );
		this.requestUpdate( 'progressing', previous );
	}

	private progressingInput: boolean = false;

	/**
	 * Current reduced motion input supplied by the presentation owner.
	 * @return Current reduced motion input supplied by the presentation owner.
	 */
	get reducedMotion(): boolean {
		return this.reducedMotionInput;
	}

	/**
	 * Applies the next reduced motion controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set reducedMotion( value: boolean ) {
		const previous = this.reducedMotionInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.reducedMotionInput = value;
		this.toggleAttribute( 'reduced-motion', value );
		this.requestUpdate( 'reducedMotion', previous );
	}

	private reducedMotionInput: boolean = false;

	/**
	 * Current preview input supplied by the presentation owner.
	 * @return Current preview input supplied by the presentation owner.
	 */
	get preview(): boolean {
		return this.previewInput;
	}

	/**
	 * Applies the next preview controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set preview( value: boolean ) {
		const previous = this.previewInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.previewInput = value;
		this.toggleAttribute( 'preview', value );
		this.requestUpdate( 'preview', previous );
	}

	private previewInput: boolean = false;

	/**
	 * Current recovering input supplied by the presentation owner.
	 * @return Current recovering input supplied by the presentation owner.
	 */
	get recovering(): boolean {
		return this.recoveringInput;
	}

	/**
	 * Applies the next recovering controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set recovering( value: boolean ) {
		const previous = this.recoveringInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.recoveringInput = value;
		this.toggleAttribute( 'recovering', value );
		this.requestUpdate( 'recovering', previous );
	}

	private recoveringInput: boolean = false;

	/**
	 * Current continue shortcut enabled input supplied by the presentation owner.
	 * @return Current continue shortcut enabled input supplied by the presentation owner.
	 */
	get continueShortcutEnabled(): boolean {
		return this.continueShortcutEnabledInput;
	}

	/**
	 * Applies the next continue shortcut enabled controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set continueShortcutEnabled( value: boolean ) {
		const previous = this.continueShortcutEnabledInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.continueShortcutEnabledInput = value;
		this.requestUpdate( 'continueShortcutEnabled', previous );
	}

	private continueShortcutEnabledInput: boolean = true;

	/**
	 * Current copy input supplied by the presentation owner.
	 * @return Current copy input supplied by the presentation owner.
	 */
	get copy(): Readonly<InterruptionScreenCopy> {
		return this.copyInput;
	}

	/**
	 * Applies the next copy controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set copy( value: Readonly<InterruptionScreenCopy> ) {
		const previous = this.copyInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.copyInput = value;
		this.requestUpdate( 'copy', previous );
	}

	private copyInput!: Readonly<InterruptionScreenCopy>;

	/**
	 * Current wellbeing summary input supplied by the presentation owner.
	 * @return Current wellbeing summary input supplied by the presentation owner.
	 */
	get wellbeingSummary(): string {
		return this.wellbeingSummaryInput;
	}

	/**
	 * Applies the next wellbeing summary controller input.
	 * @param value - New presentation input, committed with the other writes in this batch.
	 */
	set wellbeingSummary( value: string ) {
		const previous = this.wellbeingSummaryInput;
		if ( Object.is( previous, value ) ) {
			return;
		}
		this.wellbeingSummaryInput = value;
		this.requestUpdate( 'wellbeingSummary', previous );
	}

	private wellbeingSummaryInput: string = '';

	private releaseAppearance: ( () => void ) | null = null;

	/**
	 * Controller attributes supported by the presentation boundary.
	 * @return Controller attributes supported by the presentation boundary.
	 */
	static get observedAttributes(): string[] {
		return [ 'state', 'mode', 'wait-duration-milliseconds', 'focused-progress-milliseconds',
			'progressing', 'reduced-motion', 'preview', 'recovering', 'wellbeing-summary' ];
	}

	/**
	 * Projects native attributes into typed controller sInput.
	 * @param name - Changed attribute.
	 * @param previous - Value before the change.
	 * @param value - New value or null after removal.
	 */
	attributeChangedCallback( name: string, previous: string | null, value: string | null ): void {
		if ( previous === value ) {
			return;
		}
		switch ( name ) {
			case 'state': this.state = Object.values( InterruptionScreenState ).find( ( state ) => state === value ) ?? InterruptionScreenState.WAITING; break;
			case 'mode': this.mode = Object.values( InterruptionScreenMode ).find( ( mode ) => mode === value ) ?? InterruptionScreenMode.BREATHING; break;
			case 'wait-duration-milliseconds': this.waitDurationMilliseconds = Number( value ); break;
			case 'focused-progress-milliseconds': this.focusedProgressMilliseconds = Number( value ); break;
			case 'progressing': this.progressing = value !== null; break;
			case 'reduced-motion': this.reducedMotion = value !== null; break;
			case 'preview': this.preview = value !== null; break;
			case 'recovering': this.recovering = value !== null; break;
			case 'wellbeing-summary': this.wellbeingSummary = value ?? ''; break;
		}
	}

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
		super( styles );
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
		event.stopPropagation();
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
		this.releaseAppearance?.();
		this.releaseAppearance = observePresentationAppearance( this, () => {
			this.requestUpdate();
		} );
		window.addEventListener( 'keydown', this.handleGlobalKeydown, { capture: true } );
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
		this.releaseAppearance?.();
		this.releaseAppearance = null;
		window.removeEventListener( 'keydown', this.handleGlobalKeydown, { capture: true } );
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
	private prepareUpdate( changedProperties: PresentationChanges ): void {
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
	protected override afterRender( changedProperties: PresentationChanges ): void {
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
	 * Commits the authoritative adapter snapshot to the shared React scene.
	 * @param changes - Inputs changed together in this controller projection.
	 * @return React scene, or no content until localization is ready.
	 * @since 0.1.0 Initial implementation.
	 */
	protected override renderPresentation( changes: PresentationChanges ): ReactNode {
		this.prepareUpdate( changes );
		if ( ! isLocalizationReady( this.copy ) ) {
			return null;
		}
		return <ScreenView host={this} shadowRoot={this.renderRoot} copy={this.copy} state={this.state} mode={this.mode}
			progressMilliseconds={this.progressClock.getProgressMilliseconds()}
			waitDurationMilliseconds={this.waitDurationMilliseconds} reducedMotion={this.reducedMotion}
			recovering={this.recovering} wellbeingSummary={this.wellbeingSummary} announcement={this.announcement}
			onContinue={this.requestContinue} onRetry={this.requestRetry} />;
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

customElements.define( 'tocus-f-interruption-screen', ComponentInterruptionScreen );
