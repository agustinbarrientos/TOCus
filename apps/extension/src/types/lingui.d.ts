declare module '*.po' {
	import { type Messages } from '@lingui/core';

	/**
	 * Compiled Lingui messages exported by the Vite catalog loader.
	 * @since 0.1.0 Initial implementation.
	 */
	export const messages: Messages;
}

declare module 'virtual:tocus/protected-page-localization' {
	import { type Messages } from '@lingui/core';

	/**
	 * Compiled protected-page messages indexed by every supported language.
	 * @since 0.1.0 Initial implementation.
	 */
	interface ProtectedPageLocalizationMessages {
		readonly en: Readonly<Messages>;
		readonly 'es-tu': Readonly<Messages>;
		readonly 'es-vos': Readonly<Messages>;
		readonly 'pt-BR': Readonly<Messages>;
		readonly 'pt-PT': Readonly<Messages>;
		readonly it: Readonly<Messages>;
		readonly fr: Readonly<Messages>;
		readonly de: Readonly<Messages>;
		readonly ja: Readonly<Messages>;
		readonly ru: Readonly<Messages>;
	}

	/**
	 * Protected-page messages projected from canonical extension PO catalogs.
	 * @since 0.1.0 Initial implementation.
	 */
	export const messagesByLanguage: Readonly<ProtectedPageLocalizationMessages>;
}

declare module 'virtual:tocus/toolbar-localization' {
	import { type Messages } from '@lingui/core';

	/**
	 * Compiled toolbar messages indexed by every supported language.
	 * @since 0.1.0 Initial implementation.
	 */
	interface ToolbarLocalizationMessages {
		readonly en: Readonly<Messages>;
		readonly 'es-tu': Readonly<Messages>;
		readonly 'es-vos': Readonly<Messages>;
		readonly 'pt-BR': Readonly<Messages>;
		readonly 'pt-PT': Readonly<Messages>;
		readonly it: Readonly<Messages>;
		readonly fr: Readonly<Messages>;
		readonly de: Readonly<Messages>;
		readonly ja: Readonly<Messages>;
		readonly ru: Readonly<Messages>;
	}

	/**
	 * Toolbar messages projected from canonical extension PO catalogs.
	 * @since 0.1.0 Initial implementation.
	 */
	export const messagesByLanguage: Readonly<ToolbarLocalizationMessages>;
}
