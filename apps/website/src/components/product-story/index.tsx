import { Button, VisuallyHidden } from '@tocus/ui';
import { ProductDemo } from '../product-demo';
import { DemoChapter } from '../product-demo/types';
import type { ProductStoryProps } from './types';
import './style.scss';

/**
 * Keeps five short captions and one browser in a shared, stable reading position.
 * @param props - Current scene, scroll progress and the active locale.
 * @return Accessible chapter navigation and a progressively enhanced product story.
 * @since 0.1.0
 */
export function ProductStory( props: ProductStoryProps ) {
	const { catalog, chapter, progress, languageTag, messages, enhanced } = props;
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
	return <section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
		<VisuallyHidden component="h2" id="how-title">{ catalog.howTitle }</VisuallyHidden>
		<div className="story-layout">
			<div className="experience-stage">
				<div className="story-heading">
					{ chapters.map( ( step ) => <div key={ step.id } className="story-caption"
						data-caption-chapter={ step.id } aria-hidden={ chapter !== step.id }>
						<h3>{ step.title }</h3><p>{ step.description }</p>
					</div> ) }
				</div>
				<ProductDemo languageTag={ languageTag } messages={ messages }
					chapter={ chapter } progress={ progress } copy={ {
						label: catalog.demoLabel, chooseTitle: catalog.chooseTitle, visitTitle: catalog.visitTitle,
						siteSelected: catalog.demoSiteSelected, timeLeft: catalog.demoTimeLeft,
					} } />
				<ol className="story-steps" role="list" aria-label={ catalog.howTitle } hidden={ ! enhanced }>
					{ chapters.map( ( step, index ) => <li key={ step.id } data-story-chapter={ step.id }>
						<Button variant="subtle" className="story-step-action" px="0.25rem" py="0.7rem" radius={ 0 }
							classNames={ { inner: 'story-step-inner', label: 'story-step-label' } }
							aria-controls="product-story-screen" aria-current={ chapter === step.id ? 'step' : undefined }>
							<span className="story-step-number" aria-hidden="true">{ index + 1 }</span>
							{ step.label }
						</Button>
					</li> ) }
				</ol>
			</div>
		</div>
		{ ! enhanced && <ol className="story-fallback">
			{ chapters.map( ( step ) => <li key={ step.id }>
				<h3>{ step.title }</h3><p>{ step.description }</p>
			</li> ) }
		</ol> }
	</section>;
}
