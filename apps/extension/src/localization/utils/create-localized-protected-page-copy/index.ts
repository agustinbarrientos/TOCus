import { Language, type Language as LanguageValue } from '../../../domains/preferences/types';
import { getLanguageTag } from '../../../domains/preferences/utils/resolve-language';
import {
	interruption as germanInterruption,
	protectedPageLayer as germanProtectedPageLayer,
	units as germanUnits,
	wellbeing as germanWellbeing,
} from '../../../../locales/de.json';
import {
	interruption as englishInterruption,
	protectedPageLayer as englishProtectedPageLayer,
	units as englishUnits,
	wellbeing as englishWellbeing,
} from '../../../../locales/en.json';
import {
	interruption as spanishTuInterruption,
	protectedPageLayer as spanishTuProtectedPageLayer,
	units as spanishTuUnits,
	wellbeing as spanishTuWellbeing,
} from '../../../../locales/es-tu.json';
import {
	interruption as spanishVosInterruption,
	protectedPageLayer as spanishVosProtectedPageLayer,
	units as spanishVosUnits,
	wellbeing as spanishVosWellbeing,
} from '../../../../locales/es-vos.json';
import {
	interruption as frenchInterruption,
	protectedPageLayer as frenchProtectedPageLayer,
	units as frenchUnits,
	wellbeing as frenchWellbeing,
} from '../../../../locales/fr.json';
import {
	interruption as italianInterruption,
	protectedPageLayer as italianProtectedPageLayer,
	units as italianUnits,
	wellbeing as italianWellbeing,
} from '../../../../locales/it.json';
import {
	interruption as japaneseInterruption,
	protectedPageLayer as japaneseProtectedPageLayer,
	units as japaneseUnits,
	wellbeing as japaneseWellbeing,
} from '../../../../locales/ja.json';
import {
	interruption as portugueseBrazilInterruption,
	protectedPageLayer as portugueseBrazilProtectedPageLayer,
	units as portugueseBrazilUnits,
	wellbeing as portugueseBrazilWellbeing,
} from '../../../../locales/pt-BR.json';
import {
	interruption as portuguesePortugalInterruption,
	protectedPageLayer as portuguesePortugalProtectedPageLayer,
	units as portuguesePortugalUnits,
	wellbeing as portuguesePortugalWellbeing,
} from '../../../../locales/pt-PT.json';
import {
	interruption as russianInterruption,
	protectedPageLayer as russianProtectedPageLayer,
	units as russianUnits,
	wellbeing as russianWellbeing,
} from '../../../../locales/ru.json';
import { createFormatters } from '../create-localization-bundle/formatters';
import {
	createInterruptionCopy,
	createProtectedPageLayerCopy,
	createWellbeingCopy,
} from '../create-localization-bundle/interruption-copy-adapters';
import { type ProtectedPageLocalizationCatalog } from '../create-localization-bundle/types';
import { type ProtectedPageLocalizationBundle } from './types';

/**
 * Small synchronous injected-page catalog slices indexed by preference language.
 * @since 0.1.0 Initial implementation.
 */
const ProtectedPageLocalizationCatalogs = Object.freeze( {
	[ Language.ENGLISH ]: {
		interruption: englishInterruption,
		protectedPageLayer: englishProtectedPageLayer,
		units: englishUnits,
		wellbeing: englishWellbeing,
	},
	[ Language.SPANISH_TU ]: {
		interruption: spanishTuInterruption,
		protectedPageLayer: spanishTuProtectedPageLayer,
		units: spanishTuUnits,
		wellbeing: spanishTuWellbeing,
	},
	[ Language.SPANISH_VOS ]: {
		interruption: spanishVosInterruption,
		protectedPageLayer: spanishVosProtectedPageLayer,
		units: spanishVosUnits,
		wellbeing: spanishVosWellbeing,
	},
	[ Language.PORTUGUESE_BRAZIL ]: {
		interruption: portugueseBrazilInterruption,
		protectedPageLayer: portugueseBrazilProtectedPageLayer,
		units: portugueseBrazilUnits,
		wellbeing: portugueseBrazilWellbeing,
	},
	[ Language.PORTUGUESE_PORTUGAL ]: {
		interruption: portuguesePortugalInterruption,
		protectedPageLayer: portuguesePortugalProtectedPageLayer,
		units: portuguesePortugalUnits,
		wellbeing: portuguesePortugalWellbeing,
	},
	[ Language.ITALIAN ]: {
		interruption: italianInterruption,
		protectedPageLayer: italianProtectedPageLayer,
		units: italianUnits,
		wellbeing: italianWellbeing,
	},
	[ Language.FRENCH ]: {
		interruption: frenchInterruption,
		protectedPageLayer: frenchProtectedPageLayer,
		units: frenchUnits,
		wellbeing: frenchWellbeing,
	},
	[ Language.GERMAN ]: {
		interruption: germanInterruption,
		protectedPageLayer: germanProtectedPageLayer,
		units: germanUnits,
		wellbeing: germanWellbeing,
	},
	[ Language.JAPANESE ]: {
		interruption: japaneseInterruption,
		protectedPageLayer: japaneseProtectedPageLayer,
		units: japaneseUnits,
		wellbeing: japaneseWellbeing,
	},
	[ Language.RUSSIAN ]: {
		interruption: russianInterruption,
		protectedPageLayer: russianProtectedPageLayer,
		units: russianUnits,
		wellbeing: russianWellbeing,
	},
} satisfies Readonly<Record<LanguageValue, ProtectedPageLocalizationCatalog>> );

/**
 * Creates synchronous protected-page copy without loading unrelated settings catalogs.
 * @param language - Browser-derived or explicitly selected language.
 * @return Localized copy required by the injected protected-page layer.
 * @since 0.1.0 Initial implementation.
 */
export function createLocalizedProtectedPageCopy(
	language: LanguageValue,
): Readonly<ProtectedPageLocalizationBundle> {
	const catalog = ProtectedPageLocalizationCatalogs[ language ];
	const languageTag = getLanguageTag( language );
	const formatters = createFormatters( languageTag );

	return Object.freeze( {
		language,
		languageTag,
		interruption: createInterruptionCopy( catalog, formatters ),
		protectedPageLayer: createProtectedPageLayerCopy( catalog, formatters ),
		wellbeing: createWellbeingCopy( catalog, formatters ),
	} ) satisfies Readonly<ProtectedPageLocalizationBundle>;
}

export { type ProtectedPageLocalizationBundle } from './types';
