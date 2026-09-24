/**
 * Store screenshot order and production Settings destinations.
 * @since 1.0.0
 */
export const scenes = [
	{ id: 'breathing', number: 1, companion: { pose: 'thumbs-up', side: 'right' } },
	{ id: 'websites', number: 2, destination: 'protected-sites', companion: { pose: 'point', side: 'left' } },
	{ id: 'schedule', number: 3, destination: 'schedule', companion: { pose: 'agenda', side: 'right' } },
	{ id: 'statistics', number: 4, destination: 'statistics', companion: { pose: 'medals', side: 'left' } },
	{ id: 'appearance', number: 5, destination: 'appearance', companion: { pose: 'tango', side: 'right' } },
];

/**
 * English store promotions with editable copy and exact canvas dimensions.
 * @since 1.0.0
 */
export const promos = [
	{ kind: 'small', locale: 'en', width: 440, height: 280, file: 'promos/small-440x280.png',
		headline: [ 'The internet can wait' ] },
	{ kind: 'marquee', locale: 'en', width: 1400, height: 560, file: 'promos/marquee-1400x560.png',
		headline: [ 'The internet can wait one breath' ] },
];

/**
 * Localized captions and aliases used by the original manual captures.
 * @since 1.0.0
 */
export const locales = {
	en: { browserLocale: 'en-US', input: 'en', captions: [
		'Pause before visiting addictive websites', 'Choose your websites',
		'Set a custom schedule', 'Look at all the time you saved!', 'Make it yours',
	] },
	'es-tu': { browserLocale: 'es-ES', input: 'es', captions: [
		'Haz una pausa antes de visitar sitios adictivos', 'Elige tus sitios web',
		'Configura un horario personalizado', '\u00a1Mira todo el tiempo que has ahorrado!', 'Hazlo tuyo',
	] },
	'es-vos': { browserLocale: 'es-AR', input: 'es_ar', captions: [
		'Hac\u00e9 una pausa antes de visitar sitios adictivos', 'Eleg\u00ed tus sitios web',
		'Configur\u00e1 un horario personalizado', '\u00a1Mir\u00e1 todo el tiempo que ahorraste!', 'Hacelo tuyo',
	] },
	de: { browserLocale: 'de-DE', input: 'de', captions: [
		'Halte kurz inne, bevor du s\u00fcchtig machende Seiten \u00f6ffnest', 'W\u00e4hle deine Websites',
		'Lege deinen eigenen Zeitplan fest', 'Schau, wie viel Zeit du gespart hast!', 'Gestalte TOCus nach deinem Geschmack',
	] },
	fr: { browserLocale: 'fr-FR', input: 'fr', captions: [
		"Fais une pause avant d'ouvrir des sites addictifs", 'Choisis tes sites web',
		'D\u00e9finis tes propres horaires', 'Regarde tout le temps que tu as gagn\u00e9 !', '\u00c0 ton image',
	] },
	it: { browserLocale: 'it-IT', input: 'it', captions: [
		'Fai una pausa prima di aprire siti che creano dipendenza', 'Scegli i tuoi siti web',
		'Imposta un programma personalizzato', 'Guarda quanto tempo hai risparmiato!', 'Fallo tuo',
	] },
	ja: { browserLocale: 'ja-JP', input: 'ja', captions: [
		'\u4e2d\u6bd2\u6027\u306e\u3042\u308b\u30b5\u30a4\u30c8\u3092\u958b\u304f\u524d\u306b\u3001\u3072\u3068\u547c\u5438', '\u30b5\u30a4\u30c8\u3092\u9078\u307c\u3046',
		'\u81ea\u5206\u306b\u5408\u3063\u305f\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u3092\u8a2d\u5b9a\u3057\u3088\u3046', '\u3053\u3093\u306a\u306b\u6642\u9593\u304c\u7bc0\u7d04\u3067\u304d\u305f\uff01', '\u81ea\u5206\u3089\u3057\u304f\u3057\u3088\u3046',
	] },
	'pt-BR': { browserLocale: 'pt-BR', input: 'pt_br', captions: [
		'Fa\u00e7a uma pausa antes de visitar sites viciantes', 'Escolha seus sites',
		'Defina um hor\u00e1rio personalizado', 'Olha todo o tempo que voc\u00ea economizou!', 'Deixe do seu jeito',
	] },
	'pt-PT': { browserLocale: 'pt-PT', input: 'pt', captions: [
		'Faz uma pausa antes de visitares sites viciantes', 'Escolhe os teus sites',
		'Define um hor\u00e1rio personalizado', 'Olha todo o tempo que poupaste!', 'D\u00e1-lhe o teu toque',
	] },
	ru: { browserLocale: 'ru-RU', input: 'ru', captions: [
		'\u0421\u0434\u0435\u043b\u0430\u0439 \u043f\u0430\u0443\u0437\u0443 \u043f\u0435\u0440\u0435\u0434 \u0432\u0445\u043e\u0434\u043e\u043c \u043d\u0430 \u0437\u0430\u0442\u044f\u0433\u0438\u0432\u0430\u044e\u0449\u0438\u0435 \u0441\u0430\u0439\u0442\u044b', '\u0412\u044b\u0431\u0435\u0440\u0438 \u0441\u0432\u043e\u0438 \u0441\u0430\u0439\u0442\u044b',
		'\u041d\u0430\u0441\u0442\u0440\u043e\u0439 \u0441\u0432\u043e\u0451 \u0440\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435', '\u0421\u043c\u043e\u0442\u0440\u0438, \u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u044d\u043a\u043e\u043d\u043e\u043c\u0438\u0442\u044c!', '\u0421\u0434\u0435\u043b\u0430\u0439 \u043f\u043e-\u0441\u0432\u043e\u0435\u043c\u0443',
	] },
};
