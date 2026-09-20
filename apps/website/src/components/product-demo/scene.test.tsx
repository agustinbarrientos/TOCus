import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TocusProvider } from '@tocus/ui';
import { ProductDemoScene } from './scene';
import { DemoChapter, type ProductDemoCopy } from './types';

const copy: ProductDemoCopy = {
	label: 'Product guide', chooseTitle: 'Choose websites', visitTitle: 'Visit a website',
	siteSelected: 'Added', timeLeft: 'Time left', newTab: 'New tab', ready: 'Ready',
	takeAMoment: 'Your moment', breatheIn: 'Inhale', breatheOut: 'Exhale',
	continueLabel: 'Continue', sphere: 'Breathing guide', secondsRemaining: '{seconds}s',
	popularChoices: 'Popular choices', addAnotherSite: 'Add another site', addSite: 'Add site',
	address: 'Website address', addressPlaceholder: 'example.com', finishSetup: 'Finish setup',
	continueShortcut: 'Or press {key}', spaceKey: 'Space',
	allowanceMinutes: '{minutes}m', videoTitle: 'A quiet afternoon', videoChannel: 'Slow days',
};

describe( 'product scene server rendering', () => {
	it( 'renders the pause using only its supplied localized labels', () => {
		const html = renderToStaticMarkup( <TocusProvider>
			<ProductDemoScene { ...copy } chapter={ DemoChapter.PAUSE } active progress={ 0 }
				reducedMotion={ false } onContinue={ () => undefined } />
		</TocusProvider> );
		expect( html ).toContain( 'Inhale' );
		expect( html ).toContain( 'Exhale' );
		expect( html ).toContain( 'Your moment' );
		expect( html ).toContain( '10s' );
		expect( html ).not.toContain( '<button' );
	} );

	it( 'replaces the breathing cue and sphere with the ready action', () => {
		const html = renderToStaticMarkup( <TocusProvider>
			<ProductDemoScene { ...copy } chapter={ DemoChapter.CONTINUE } active progress={ 0 }
				reducedMotion={ false } onContinue={ () => undefined } />
		</TocusProvider> );
		expect( html ).toContain( 'Continue' );
		expect( html ).toContain( '<kbd>Space</kbd>' );
		expect( html ).not.toContain( 'role="img"' );
		expect( html ).not.toContain( 'Inhale' );
	} );

	it( 'includes the manual site entry alongside bundled suggestions', () => {
		const html = renderToStaticMarkup( <TocusProvider>
			<ProductDemoScene { ...copy } chapter={ DemoChapter.CHOOSE } active progress={ 0.8 }
				reducedMotion={ false } onContinue={ () => undefined } />
		</TocusProvider> );
		expect( html ).toContain( 'Popular choices' );
		expect( html ).toContain( 'Website address' );
		expect( html ).toContain( 'Finish setup' );
	} );

	it( 'loads the video page without inventing an always-visible page timer', () => {
		/**
		 * Renders the actual visit scene at an independently chosen playback position.
		 * @param progress - Elapsed fraction of the browsing chapter.
		 * @return Complete server-rendered scene markup.
		 */
		const renderVisit = ( progress: number ) => renderToStaticMarkup( <TocusProvider>
			<ProductDemoScene { ...copy } chapter={ DemoChapter.BROWSE } active progress={ progress }
				reducedMotion={ false } onContinue={ () => undefined } />
		</TocusProvider> );
		expect( renderVisit( 0 ) ).not.toContain( 'Your visit window ends' );
		expect( renderVisit( 0.9 ) ).not.toContain( 'Time left' );
		expect( renderVisit( 0.9 ) ).toContain( 'A quiet afternoon' );
	} );
} );
