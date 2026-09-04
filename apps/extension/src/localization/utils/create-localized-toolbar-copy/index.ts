import { Language, type Language as LanguageValue } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import { toolbar as germanToolbar, units as germanUnits } from '../../../../locales/de.json';
import { toolbar as englishToolbar, units as englishUnits } from '../../../../locales/en.json';
import { toolbar as spanishTuToolbar, units as spanishTuUnits } from '../../../../locales/es-tu.json';
import { toolbar as spanishVosToolbar, units as spanishVosUnits } from '../../../../locales/es-vos.json';
import { toolbar as frenchToolbar, units as frenchUnits } from '../../../../locales/fr.json';
import { toolbar as italianToolbar, units as italianUnits } from '../../../../locales/it.json';
import { toolbar as japaneseToolbar, units as japaneseUnits } from '../../../../locales/ja.json';
import {
	toolbar as portugueseBrazilToolbar,
	units as portugueseBrazilUnits,
} from '../../../../locales/pt-BR.json';
import {
	toolbar as portuguesePortugalToolbar,
	units as portuguesePortugalUnits,
} from '../../../../locales/pt-PT.json';
import { toolbar as russianToolbar, units as russianUnits } from '../../../../locales/ru.json';
import { createFormatters } from '../create-localization-bundle/formatters';
import { createToolbarCopy } from '../create-localization-bundle/toolbar-copy-adapter';
import {
	type LocalizationBundle,
	type ToolbarLocalizationCatalog,
} from '../create-localization-bundle/types';

/**
 * Small synchronous toolbar catalog slices indexed by preference language.
 * @since 0.1.0 Initial implementation.
 */
const ToolbarLocalizationCatalogs = Object.freeze( {
	[ Language.ENGLISH ]: { toolbar: englishToolbar, units: englishUnits },
	[ Language.SPANISH_TU ]: { toolbar: spanishTuToolbar, units: spanishTuUnits },
	[ Language.SPANISH_VOS ]: { toolbar: spanishVosToolbar, units: spanishVosUnits },
	[ Language.PORTUGUESE_BRAZIL ]: {
		toolbar: portugueseBrazilToolbar,
		units: portugueseBrazilUnits,
	},
	[ Language.PORTUGUESE_PORTUGAL ]: {
		toolbar: portuguesePortugalToolbar,
		units: portuguesePortugalUnits,
	},
	[ Language.ITALIAN ]: { toolbar: italianToolbar, units: italianUnits },
	[ Language.FRENCH ]: { toolbar: frenchToolbar, units: frenchUnits },
	[ Language.GERMAN ]: { toolbar: germanToolbar, units: germanUnits },
	[ Language.JAPANESE ]: { toolbar: japaneseToolbar, units: japaneseUnits },
	[ Language.RUSSIAN ]: { toolbar: russianToolbar, units: russianUnits },
} satisfies Readonly<Record<LanguageValue, ToolbarLocalizationCatalog>> );

/**
 * Creates synchronous localized toolbar copy without loading full interface catalogs.
 * @param language - Browser-derived or explicitly selected language.
 * @return Localized toolbar copy for the selected language.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizedToolbarCopy(
	language: LanguageValue,
): Readonly<LocalizationBundle[ 'toolbar' ]> {
	return createToolbarCopy(
		ToolbarLocalizationCatalogs[ language ],
		createFormatters( getLanguageTag( language ) ),
	);
}
