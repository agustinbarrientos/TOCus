import { Language } from '../../apps/extension/src/domains/preferences/types';
import { expect, freezePreview, PresentationFixture, test } from './helpers';
import { compareRegionalPage } from './helpers/compare-regional-page';
import type { VisualLanguage } from './helpers/types';

const languages: readonly VisualLanguage[] = [
	{ name: 'spanish-vos', language: Language.SPANISH_VOS, familyLabel: 'Español', variantLabel: 'Vos' },
	{ name: 'portuguese-brazil', language: Language.PORTUGUESE_BRAZIL, familyLabel: 'Português', variantLabel: 'Brasil' },
	{ name: 'portuguese-portugal', language: Language.PORTUGUESE_PORTUGAL, familyLabel: 'Português', variantLabel: 'Portugal' },
];

for ( const language of languages ) {
	test( `Onboarding regional flow ${ language.name }`, async ( { page } ) => {
		await page.goto( `${ PresentationFixture }?surface=onboarding` );
		await page.getByRole( 'radio', { name: language.familyLabel, exact: true } ).click();
		await page.getByRole( 'radio', { name: language.variantLabel, exact: true } ).click();
		await expect( page.getByRole( 'radio', { name: language.variantLabel, exact: true } ) ).toHaveAttribute( 'aria-checked', 'true' );
		const localizedHeading = language.language === Language.SPANISH_VOS
			? 'Elegí tu idioma'
			: language.language === Language.PORTUGUESE_BRAZIL
				? 'Escolha seu idioma'
				: 'Escolha o seu idioma';
		await expect( page.getByRole( 'heading', { name: localizedHeading, exact: true } ) ).toBeVisible();
		await compareRegionalPage( page, `onboarding-language-${ language.name }` );
		await page.locator( 'form button[type="submit"]' ).click();
		await page.locator( '.preferences-theme-card' ).first().waitFor();
		await freezePreview( page );
		await compareRegionalPage( page, `onboarding-appearance-${ language.name }`, false );
		await page.setViewportSize( { width: 420, height: 900 } );
		// The restored phone layout scrolls settings above a reserved floating preview.
		// Show its controls at the natural end of that scroll region, as the original phone case does.
		await page.locator( '.onboarding-layout' ).evaluate( ( element ) => {
			element.scrollTop = element.scrollHeight;
		} );
		await expect( page.locator( '.tocus-preferences-actions button[type="submit"]' ) ).toBeInViewport();
		await compareRegionalPage( page, `onboarding-appearance-${ language.name }-narrow`, false );
		await page.setViewportSize( { width: 1440, height: 1000 } );
		await page.locator( 'form button[type="submit"]' ).click();
		await page.locator( '.onboarding-sites-step input' ).waitFor();
		await compareRegionalPage( page, `onboarding-sites-${ language.name }` );
	} );
}
