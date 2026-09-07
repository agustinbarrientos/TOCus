import iconMarkup from '@tocus/theme/icon.svg?raw';
import { createElement } from 'react';
import { Button, TocusProvider } from '@tocus/ui';
import { getBreathingMotionFrame, BreathingMotionPhase } from '../../utils/breathing-motion';
import { readPresentationAppearance } from '../../utils/presentation-appearance';
import '../breathing-sphere';
import type {} from '../breathing-sphere/types';
import { InterruptionScreenMode, InterruptionScreenState, type ScreenViewProps, type SceneStyle } from './types';

/**
 * Places a visible keycap inside a complete localized sentence.
 * @param template - Complete translated shortcut hint.
 * @param key - Localized keyboard key label.
 * @return Hint with one semantic keyboard keycap.
 */
function shortcutHint( template: string, key: string ) {
	const index = template.indexOf( '{key}' );
	return <>{index === -1 ? `${ template } ` : template.slice( 0, index )}<kbd>{key}</kbd>
		{index === -1 ? '' : template.slice( index + 5 )}</>;
}

/**
 * Projects authoritative pause state with shared packaged controls and local canvas artwork.
 * The adapter owns progress and focus; this component performs no runtime or permission work.
 * @since 0.1.0
 * @param props - Immutable presentation snapshot and guarded adapter actions.
 * @return Scoped React pause scene.
 */
export function ScreenView( props: ScreenViewProps ) {
	const { copy, state, mode, reducedMotion, recovering } = props;
	const waiting = state === InterruptionScreenState.WAITING;
	const unavailable = state === InterruptionScreenState.UNAVAILABLE;
	const motion = getBreathingMotionFrame( props.progressMilliseconds, props.waitDurationMilliseconds, reducedMotion );
	const still = mode === InterruptionScreenMode.QUIET || reducedMotion || ! waiting;
	const breathProgress = still ? 0 : motion.breathProgress;
	const sceneStyle: SceneStyle = {
		'--tocus-breath-bloom-opacity': String( 0.72 + breathProgress * 0.28 ),
		'--tocus-breath-bloom-scale': String( 0.82 + breathProgress * 0.18 ),
		'--tocus-breath-progress': String( breathProgress ),
	};
	const cue = mode === InterruptionScreenMode.QUIET ? copy.takeAMoment
		: motion.phase === BreathingMotionPhase.INHALE ? copy.breatheIn : copy.breatheOut;
	return <TocusProvider {...readPresentationAppearance( props.host )} reducedMotion={reducedMotion}
		shadowRoot={props.shadowRoot}>
		<div className="scene" tabIndex={waiting || ( unavailable && recovering ) ? 0 : undefined}
			style={sceneStyle}>
			<div className="bloom" aria-hidden="true" />
			<header>
				<div className="brand" aria-label="TOCus"><span className="brand-icon" aria-hidden="true"
					dangerouslySetInnerHTML={{ __html: iconMarkup }} /><span className="wordmark">TOCus</span></div>
				{waiting && <p className="remaining">{copy.formatRemainingTime( Math.ceil( motion.remainingMilliseconds / 1000 ) )}</p>}
			</header>
			<main><section className="stage" aria-labelledby={waiting ? 'breathing-cue' : undefined}>
				{waiting && <h1 className="cue" id="breathing-cue">{cue}</h1>}
				<div className="sphere-shell">{createElement( 'tocus-f-breathing-sphere', { breathProgress, still } )}
					{waiting && <span className="sphere-alternative visually-hidden">
						{still ? copy.stillSphereAlternative : copy.sphereAlternative}</span>}</div>
				{state === InterruptionScreenState.READY && <div className="ready-action">
					<Button className="continue-button tocus-action-soft" classNames={{ label: 'pause-action-label' }} type="button"
						onClick={props.onContinue}>{copy.continueLabel}</Button>
					<p className="shortcut">{shortcutHint( copy.continueShortcut, copy.spaceKeyLabel )}</p></div>}
				{state === InterruptionScreenState.READY_EXPIRED &&
					<p className="status-message" tabIndex={-1}>{copy.readyExpiredMessage}</p>}
				{unavailable && <section className="recovery-card" aria-busy={recovering || undefined}
					aria-describedby="recovery-message" aria-labelledby="recovery-title">
					<span className="recovery-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconMarkup }} />
					<h1 className="recovery-title" id="recovery-title">{copy.unavailableTitle}</h1>
					<p className="recovery-message" id="recovery-message">{copy.unavailableMessage}</p>
					<Button className="retry-button tocus-action-soft" classNames={{ label: 'pause-action-label' }} type="button"
						disabled={recovering} onClick={props.onRetry}>
						{recovering ? copy.retryingLabel : copy.retryLabel}</Button></section>}
			</section></main>
			<footer>{props.wellbeingSummary}</footer>
		</div>
		<p className="visually-hidden" aria-atomic="true" aria-live="polite">{props.announcement}</p>
	</TocusProvider>;
}
