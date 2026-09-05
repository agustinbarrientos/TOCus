import { describe, expect, it } from 'vitest';
import { Language } from '../../../../src/domains/preferences/types.ts';
import { type RuntimeLocalizationMessages } from '../../services/create-runtime-localization-messages/types.ts';
import { serializeRuntimeLocalizationMessages } from './index.ts';

describe( 'serializeRuntimeLocalizationMessages', () => {
	it( 'serializes an immutable virtual-module export', () => {
		const messages: RuntimeLocalizationMessages = {
			[ Language.ENGLISH ]: { message: Language.ENGLISH },
			[ Language.SPANISH_TU ]: { message: Language.SPANISH_TU },
			[ Language.SPANISH_VOS ]: { message: Language.SPANISH_VOS },
			[ Language.PORTUGUESE_BRAZIL ]: { message: Language.PORTUGUESE_BRAZIL },
			[ Language.PORTUGUESE_PORTUGAL ]: { message: Language.PORTUGUESE_PORTUGAL },
			[ Language.ITALIAN ]: { message: Language.ITALIAN },
			[ Language.FRENCH ]: { message: Language.FRENCH },
			[ Language.GERMAN ]: { message: Language.GERMAN },
			[ Language.JAPANESE ]: { message: Language.JAPANESE },
			[ Language.RUSSIAN ]: { message: Language.RUSSIAN },
		};

		expect( serializeRuntimeLocalizationMessages( messages ) ).toContain(
			'export const messagesByLanguage = Object.freeze(',
		);
	} );
} );
