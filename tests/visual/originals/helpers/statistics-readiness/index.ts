import { expect, type Page } from '@playwright/test';

/**
 * Waits for the original Statistics scenario before its screenshot or reset gestures.
 * @param page - Settings fixture showing the production Statistics destination.
 * @param name - Registered original screenshot filename.
 * @return Completion of the requested Statistics state's first mounted render.
 * @since 0.1.0
 */
export async function waitForStatisticsState( page: Page, name: string ): Promise<void> {
	const selector = name.includes( 'loading' ) ? '.settings-statistics-loading'
		: name.includes( 'unavailable' ) ? '.settings-statistics-recovery' : '.settings-statistics-summary';
	await expect( page.locator( selector ) ).toBeVisible();
}
