import { expect } from '@playwright/test';
import { ThemeMode } from '../../../../domains/preferences/types';
import { SettingsDestination } from '../../services/settings-navigation/types';
import axe from 'axe-core';
import { test } from '../../utils/browser-test-harness';

test.describe( 'Settings accessibility', () => {
	test( 'has no automatic accessibility violations across all destinations in light and dark', async ( { open } ) => {
		test.setTimeout( 60000 );
		const page = await open( SettingsDestination.ABOUT );
		for ( const theme of [ ThemeMode.LIGHT, ThemeMode.DARK ] as const ) {
			await page.evaluate( ( theme ) => {
				window.settingsTest.externalPreferences( { theme } );
				document.documentElement.setAttribute( 'data-tocus-theme', theme );
			}, theme );
			for ( const destination of [
				SettingsDestination.ABOUT, SettingsDestination.PRIVACY, SettingsDestination.STATISTICS,
				SettingsDestination.LANGUAGE, SettingsDestination.APPEARANCE,
				SettingsDestination.TIMING, SettingsDestination.SCHEDULE, SettingsDestination.PROTECTED_SITES ] ) {
				await page.evaluate( ( destination ) => {
					location.hash = destination;
				}, destination );
				await page.getByRole( 'heading', { level: 1 } ).waitFor();
				await page.addScriptTag( { content: axe.source } );
				const violations = await page.evaluate( async () => {
					const result = await window.axe.run( document, {
						runOnly: { type: 'tag', values: [ 'wcag2a', 'wcag2aa', 'wcag21aa' ] },
					} );
					return result.violations.map( ( violation ) => ( {
						id: violation.id, nodes: violation.nodes.map( ( node ) => ( {
							target: node.target, summary: node.failureSummary,
						} ) ),
					} ) );
				} );
				expect( violations, `${ destination } ${ theme }` ).toEqual( [] );
			}
		}
	} );
} );
