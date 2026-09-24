/**
 * Editable Edge promo headlines and search terms for each supported language.
 * @since 1.0.0
 */
export const edgeListings = {
	'en': {
		small: 'The internet can wait',
		large: 'The internet can wait one breath',
		searchTerms: [ 'focus', 'mindful browsing', 'screen time', 'breathing pause', 'digital wellbeing', 'distractions', 'browsing habits' ],
	},
	'es-tu': {
		small: 'Internet puede esperar',
		large: 'Internet puede esperar un respiro',
		searchTerms: [ 'concentraci\u00f3n', 'navegaci\u00f3n consciente', 'tiempo de pantalla', 'pausa para respirar', 'bienestar digital', 'distracciones', 'h\u00e1bitos digitales' ],
	},
	'es-vos': {
		small: 'Internet puede esperar',
		large: 'Internet puede esperar un respiro',
		searchTerms: [ 'concentraci\u00f3n', 'navegaci\u00f3n consciente', 'tiempo de pantalla', 'pausa para respirar', 'bienestar digital', 'distracciones', 'h\u00e1bitos digitales' ],
	},
	'de': {
		small: 'Das Internet kann warten',
		large: 'Das Internet kann einen Atemzug warten',
		searchTerms: [ 'Konzentration', 'bewusst surfen', 'Bildschirmzeit', 'Atempause', 'digitales Wohlbefinden', 'Ablenkungen', 'Surfgewohnheiten' ],
	},
	'fr': {
		small: 'Internet peut attendre',
		large: "Internet peut attendre le temps d'un souffle",
		searchTerms: [ 'concentration', 'navigation consciente', 'temps d\u2019\u00e9cran', 'pause respiratoire', 'bien-\u00eatre num\u00e9rique', 'distractions', 'habitudes num\u00e9riques' ],
	},
	'it': {
		small: 'Internet pu\u00f2 aspettare',
		large: 'Internet pu\u00f2 aspettare un respiro',
		searchTerms: [ 'concentrazione', 'navigazione consapevole', 'tempo sullo schermo', 'pausa per respirare', 'benessere digitale', 'distrazioni', 'abitudini digitali' ],
	},
	'ja': {
		small: '\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8\u306f\u5f85\u3063\u3066\u304f\u308c\u308b',
		large: '\u3072\u3068\u547c\u5438\u3059\u308b\u9593\u3001\u30a4\u30f3\u30bf\u30fc\u30cd\u30c3\u30c8\u306f\u5f85\u3063\u3066\u304f\u308c\u308b',
		searchTerms: [ '\u96c6\u4e2d\u529b', '\u610f\u8b58\u7684\u306a\u30d6\u30e9\u30a6\u30b8\u30f3\u30b0', '\u30b9\u30af\u30ea\u30fc\u30f3\u30bf\u30a4\u30e0', '\u6df1\u547c\u5438', '\u30c7\u30b8\u30bf\u30eb\u30a6\u30a7\u30eb\u30d3\u30fc\u30a4\u30f3\u30b0', '\u6c17\u304c\u6563\u308b\u306e\u3092\u9632\u3050', '\u30cd\u30c3\u30c8\u7fd2\u6163' ],
	},
	'pt-BR': {
		small: 'A internet pode esperar',
		large: 'A internet pode esperar uma respira\u00e7\u00e3o',
		searchTerms: [ 'foco', 'navega\u00e7\u00e3o consciente', 'tempo de tela', 'pausa para respirar', 'bem-estar digital', 'distra\u00e7\u00f5es', 'h\u00e1bitos digitais' ],
	},
	'pt-PT': {
		small: 'A internet pode esperar',
		large: 'A internet pode esperar uma respira\u00e7\u00e3o',
		searchTerms: [ 'concentra\u00e7\u00e3o', 'navega\u00e7\u00e3o consciente', 'tempo de ecr\u00e3', 'pausa para respirar', 'bem-estar digital', 'distra\u00e7\u00f5es', 'h\u00e1bitos digitais' ],
	},
	'ru': {
		small: '\u0418\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u043f\u043e\u0434\u043e\u0436\u0434\u0451\u0442',
		large: '\u0418\u043d\u0442\u0435\u0440\u043d\u0435\u0442 \u043f\u043e\u0434\u043e\u0436\u0434\u0451\u0442 \u043e\u0434\u0438\u043d \u0432\u0434\u043e\u0445',
		searchTerms: [ '\u043a\u043e\u043d\u0446\u0435\u043d\u0442\u0440\u0430\u0446\u0438\u044f', '\u043e\u0441\u043e\u0437\u043d\u0430\u043d\u043d\u044b\u0439 \u0441\u0451\u0440\u0444\u0438\u043d\u0433', '\u044d\u043a\u0440\u0430\u043d\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f', '\u043f\u0430\u0443\u0437\u0430 \u0434\u043b\u044f \u0434\u044b\u0445\u0430\u043d\u0438\u044f', '\u0446\u0438\u0444\u0440\u043e\u0432\u043e\u0435 \u0431\u043b\u0430\u0433\u043e\u043f\u043e\u043b\u0443\u0447\u0438\u0435', '\u043e\u0442\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u044f', '\u0446\u0438\u0444\u0440\u043e\u0432\u044b\u0435 \u043f\u0440\u0438\u0432\u044b\u0447\u043a\u0438' ],
	},
};

/**
 * Builds the selected localized Edge promotional exports.
 * @param {string[]} selected - Validated generator locale codes.
 * @return {object[]} Localized image contracts.
 * @since 1.0.0
 */
export function createEdgePromos( selected ) {
	return selected.flatMap( ( locale ) => [
		{ kind: 'small', locale, width: 440, height: 280, file: `${ locale }/small-440x280.png`,
			headline: [ edgeListings[ locale ].small ], fitHeadline: true },
		{ kind: 'large', locale, width: 1400, height: 560, file: `${ locale }/large-1400x560.png`,
			headline: [ edgeListings[ locale ].large ], fitHeadline: true },
	] );
}
