import '../../../../packages/ui/src/styles.scss';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, Icon, IconName, Radio, Text, Title, TocusAppearance, TocusPalette, TocusProvider } from '../../../../packages/ui/src';
import { AppearanceControls } from '../../../../apps/extension/src/features/preferences/components/appearance-controls';
import { OnboardingLanguageControls } from '../../../../apps/extension/src/features/preferences/components/onboarding-language-controls';
import { Page } from '../../../../apps/extension/src/features/settings/components/page';
import { Language, ThemeMode } from '../../../../apps/extension/src/domains/preferences/types';
import { TestEnglishLocalizationBundle } from '../../../../apps/extension/src/localization/__fixtures__';
import { OriginalNoticeChoice, SharedOriginalSurface } from './types';
import './style.scss';

const query = new URLSearchParams( location.search );
const surface = Object.values( SharedOriginalSurface ).find( ( value ) => value === query.get( 'surface' ) )
	?? SharedOriginalSurface.APPEARANCE;
const scheme = query.get( 'scheme' ) === TocusAppearance.DARK ? TocusAppearance.DARK : TocusAppearance.LIGHT;
const palette = Object.values( TocusPalette ).find( ( value ) => value === query.get( 'palette' ) ) ?? TocusPalette.BROWN;
const initialLanguage = Object.values( Language ).find( ( value ) => value === query.get( 'language' ) ) ?? Language.ENGLISH;
const root = document.getElementById( 'root' );
if ( ! root ) {
	throw new Error( 'Missing original shared component boundary.' );
}
root.style.width = query.get( 'width' ) ?? '100%';
document.documentElement.style.colorScheme = scheme;

/**
 * Presents the same semantic notices and choices through actual packaged controls.
 * @return Real shared controls with the original test copy and section boundaries.
 */
function Notices() {
	return <div className="original-notices"><Page title="Pause timing">
		<section className="tocus-section">
			<h2>When the wait finishes</h2>
			<Radio.Group defaultValue={ OriginalNoticeChoice.MANUAL }>
				<Radio value={ OriginalNoticeChoice.MANUAL } className="tocus-choice-card tocus-choice-radio" mt="1rem"
					label="Show a Continue button" description="Wait for your choice before opening the website." />
				<Radio value={ OriginalNoticeChoice.AUTOMATIC } className="tocus-choice-card tocus-choice-radio" mt="0.5rem"
					label="Open the website automatically" />
			</Radio.Group>
		</section>
		<section className="tocus-section" style={ { paddingBottom: 0 } }><h2 style={ { marginBottom: 0 } }>Timing summary</h2>
			<p style={ { color: 'inherit', marginTop: '1em' } }>Your five minutes start when you choose Continue.</p></section>
		<Alert color="green" mt="1rem" icon={ <Icon name={ IconName.CIRCLE_CHECK } /> } role="status">Changes saved.</Alert>
		<Alert color="red" mt="1rem" icon={ <Icon name={ IconName.EXCLAMATION } /> }>Your changes could not be saved. Try again.</Alert>
		<Alert color="yellow" mt="1rem" icon={ <Icon name={ IconName.EXCLAMATION } /> } role="status">Browser access is still enabled for this website.</Alert>
		<div className="tocus-form-actions"><Button>Save</Button><Button variant="outline">Discard</Button></div>
	</Page></div>;
}

/**
 * Mounts production shared controls inside only the original standalone capture framing.
 * @return Stateful production appearance or language controls, or the shared notice catalog.
 */
function SharedFixture() {
	const [ language, setLanguage ] = useState( initialLanguage );
	const [ theme, setTheme ] = useState<ThemeMode>( surface === SharedOriginalSurface.APPEARANCE
		&& scheme === TocusAppearance.DARK
		? ThemeMode.SYSTEM : scheme );
	const [ selectedPalette, setPalette ] = useState( palette );
	const step = surface === SharedOriginalSurface.LANGUAGE_STEP || surface === SharedOriginalSurface.APPEARANCE_STEP;
	const languageStep = surface === SharedOriginalSurface.LANGUAGE_STEP;
	const languageCopy = {
		...TestEnglishLocalizationBundle.onboarding.language,
		...( language === Language.SPANISH_TU ? {
			title: 'Elige tu idioma',
			introduction: 'TOCus usar\u00e1 este idioma en toda la extensi\u00f3n. Puedes cambiarlo m\u00e1s adelante en Configuraci\u00f3n.',
			languageLegend: 'Idioma',
			spanishVariantLegend: '\u00bfQu\u00e9 variante de espa\u00f1ol quieres que use TOCus?',
			continueLabel: 'Continuar',
		} : language === Language.PORTUGUESE_BRAZIL ? {
			title: 'Escolha seu idioma',
			introduction: 'O TOCus usar\u00e1 esse idioma em toda a extens\u00e3o. Voc\u00ea pode alter\u00e1-lo depois nas Configura\u00e7\u00f5es.',
			languageLegend: 'Idioma',
			portugueseVariantLegend: 'Qual variante do portugu\u00eas o TOCus deve usar?',
			continueLabel: 'Continuar',
		} : {} ),
	};
	const copy = languageStep ? languageCopy : TestEnglishLocalizationBundle.onboarding.appearance;
	return <TocusProvider appearance={ scheme } palette={ selectedPalette } reducedMotion transparent>
		<div id="original-shared-capture" className={ step ? 'original-step' : 'original-controls' }>
			{ surface === SharedOriginalSurface.NOTICES ? <Notices /> : <>
				{ step && <header className={ `tocus-preferences-header ${ languageStep ? 'tocus-preferences-language-header' : '' }` }>
					<Title order={ 1 }>{ copy.title }</Title><Text>{ copy.introduction }</Text>
				</header> }
				{ languageStep ? <OnboardingLanguageControls copy={ languageCopy }
					value={ language } onChange={ setLanguage } />
					: <AppearanceControls copy={ step ? TestEnglishLocalizationBundle.onboarding.appearance
						: TestEnglishLocalizationBundle.appearance }
					theme={ theme } palette={ selectedPalette } onChange={ ( update ) => {
						if ( 'theme' in update ) {
							setTheme( update.theme );
						}
						if ( 'palette' in update ) {
							setPalette( update.palette );
						}
					} } /> }
				{ step && <><div className="tocus-preferences-error" /><div className={ `tocus-preferences-actions ${ languageStep ? '' : 'tocus-preferences-appearance-actions' }` }>
					<Button className="tocus-action-raised">{ copy.continueLabel }</Button>
				</div></> }
			</> }
		</div>
	</TocusProvider>;
}

createRoot( root ).render( <SharedFixture /> );
