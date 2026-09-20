import { Button } from '@tocus/ui';
import { useEffect, useRef, useState } from 'react';
import { createStoryMotion } from '../../services/story-motion';
import type { StoryFrame } from '../../services/story-motion/types';
import { ProductDemo } from '../product-demo';
import { DemoChapter } from '../product-demo/types';
import type { ProductStoryProps } from './types';
import './style.scss';

/**
 * Presents a timed walkthrough with readable chapter selection and local player controls.
 * @param props - Localized captions and progressive enhancement state.
 * @param props.catalog - Website-owned localized labels.
 * @param props.enhanced - Whether browser playback controls are available.
 * @return A two-column story that stacks in normal flow on small screens.
 * @since 0.1.0
 */
export function ProductStory( { catalog, enhanced }: ProductStoryProps ) {
	const boundary = useRef<HTMLElement>( null );
	const [ frame, setFrame ] = useState<StoryFrame>( {
		chapter: DemoChapter.CHOOSE, progress: 0, playing: false, complete: false, reducedMotion: true,
	} );
	useEffect( () => {
		if ( boundary.current ) {
			return createStoryMotion( boundary.current, setFrame );
		}
	}, [] );
	const chapters = [
		{ id: DemoChapter.CHOOSE, label: catalog.chooseLabel,
			title: catalog.chooseTitle, description: catalog.chooseDescription },
		{ id: DemoChapter.VISIT, label: catalog.visitLabel,
			title: catalog.visitTitle, description: catalog.visitDescription },
		{ id: DemoChapter.PAUSE, label: catalog.pauseLabel,
			title: catalog.pauseTitle, description: catalog.pauseDescription },
		{ id: DemoChapter.CONTINUE, label: catalog.continueLabel,
			title: catalog.continueTitle, description: catalog.continueDescription },
		{ id: DemoChapter.BROWSE, label: catalog.browseLabel,
			title: catalog.browseTitle, description: catalog.browseDescription },
	];
	return <section className="how-it-works" id="how-it-works" aria-labelledby="how-title"
		ref={ boundary } data-playing={ frame.playing }>
		<h2 id="how-title">{ catalog.howTitle }</h2>
		<div className="story-layout">
			<div className="experience-stage">
				<ol className="story-steps" role="list" aria-label={ catalog.howTitle }>
					{ chapters.map( ( step, index ) => <li key={ step.id } data-story-chapter={ step.id }
						data-current={ frame.chapter === step.id }>
						{ enhanced ? <Button variant="subtle" className="story-step-action" px="0.25rem" py="0.7rem" radius={ 0 }
							classNames={ { inner: 'story-step-inner', label: 'story-step-label' } }
							aria-controls="product-story-screen" aria-current={ frame.chapter === step.id ? 'step' : undefined }>
							<span className="story-step-number" aria-hidden="true">{ index + 1 }</span>
							{ step.label }
						</Button> : <h3 className="story-step-action story-step-label">
							<span className="story-step-number" aria-hidden="true">{ index + 1 }</span>{ step.label }
						</h3> }
						<div className="story-caption" data-caption-chapter={ step.id }
							aria-hidden={ enhanced && frame.chapter !== step.id }>
							<p>{ step.description }</p>
						</div>
					</li> ) }
				</ol>
				<div className="story-player">
					<ProductDemo chapter={ frame.chapter } progress={ frame.progress }
						reducedMotion={ frame.reducedMotion }
						copy={ {
							label: catalog.demoLabel, chooseTitle: catalog.chooseTitle, visitTitle: catalog.visitTitle,
							siteSelected: catalog.demoSiteSelected, timeLeft: catalog.demoTimeLeft,
							newTab: catalog.demoNewTab, ready: catalog.demoReady, takeAMoment: catalog.demoTakeAMoment,
							breatheIn: catalog.demoBreatheIn, breatheOut: catalog.demoBreatheOut,
							continueLabel: catalog.demoContinue,
							sphere: catalog.demoSphere, secondsRemaining: catalog.demoSecondsRemaining,
							popularChoices: catalog.demoPopularChoices, addAnotherSite: catalog.demoAddAnotherSite,
							addSite: catalog.demoAddSite, address: catalog.demoAddress,
							addressPlaceholder: catalog.demoAddressPlaceholder, finishSetup: catalog.demoFinishSetup,
							continueShortcut: catalog.demoContinueShortcut, spaceKey: catalog.demoSpaceKey,
							allowanceMinutes: catalog.demoAllowanceMinutes,
							videoTitle: catalog.demoVideoTitle, videoChannel: catalog.demoVideoChannel,
						} } />
					{ enhanced && ! frame.reducedMotion && <div className="story-player-controls">
						<Button variant="subtle" data-story-toggle aria-controls="product-story-screen">
							{ frame.complete ? catalog.storyReplay
								: frame.playing ? catalog.storyPause : catalog.storyPlay }
						</Button>
						<progress aria-label={ catalog.howTitle } max={ 5 }
							value={ Object.values( DemoChapter ).indexOf( frame.chapter ) + frame.progress } />
					</div> }
				</div>
			</div>
		</div>
	</section>;
}
