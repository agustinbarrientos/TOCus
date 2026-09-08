import { Icon, IconName } from '@tocus/ui';
import youtubeIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-youtube.svg?url';
import type { TimingIllustrationProps } from './types';
import './style.scss';

/**
 * Explains the consequence of timing choices without presenting an inert form.
 * @param props - Localized milestone labels.
 * @return Ordered, non-interactive example of a pause followed by browsing time.
 * @since 0.1.0
 */
export function TimingIllustration( props: TimingIllustrationProps ) {
	const { catalog } = props;
	return <figure className="timing-illustration" data-story-reveal>
		<ol className="timing-sequence" role="list">
			<li><span className="timing-symbol"><img src={ youtubeIcon } width="48" height="48" alt="" /></span>
				<strong>{ catalog.visitLabel }</strong></li>
			<li><span className="timing-symbol"><span className="timing-sphere" /></span>
				<strong>{ catalog.timingPause }</strong></li>
			<li><span className="timing-symbol"><Icon name={ IconName.CIRCLE_CHECK } /></span>
				<strong>{ catalog.continueLabel }</strong></li>
			<li><span className="timing-symbol timing-window"><span /></span>
				<strong>{ catalog.timingBrowse }</strong></li>
		</ol>
		<figcaption>{ catalog.exampleTiming }</figcaption>
	</figure>;
}
