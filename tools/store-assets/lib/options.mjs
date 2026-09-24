import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { locales } from './catalog.mjs';

/**
 * Validates the public CLI before starting a browser or writing outputs.
 * @param {string[]} args - CLI arguments after the executable.
 * @param {string} root - Repository root.
 * @return {object} Validated local capture options.
 * @since 1.0.0
 */
export function readOptions( args, root ) {
	const { values } = parseArgs( { args, options: {
		store: { type: 'string', default: 'chrome' },
		locale: { type: 'string', default: 'all' },
		input: { type: 'string' },
		output: { type: 'string' },
		only: { type: 'string', default: 'all' },
		'sync-website': { type: 'boolean', default: false },
		help: { type: 'boolean', default: false },
	} } );
	if ( ! [ 'chrome', 'edge', 'firefox' ].includes( values.store ) ) {
		throw new Error( '--store must be chrome, edge, or firefox.' );
	}
	const selected = values.locale === 'all' ? Object.keys( locales ) : values.locale.split( ',' ).map( ( value ) => value.trim() );
	if ( selected.some( ( locale ) => ! Object.hasOwn( locales, locale ) ) ) {
		throw new Error( `Unknown locale. Choose: ${ Object.keys( locales ).join( ', ' ) }` );
	}
	if ( ! [ 'all', 'screenshots', 'promos', 'og' ].includes( values.only ) ) {
		throw new Error( '--only must be all, screenshots, promos, or og.' );
	}
	if ( values[ 'sync-website' ] && values.only !== 'og' ) {
		throw new Error( '--sync-website requires --only og.' );
	}
	if ( values.only === 'og' && ( values.input || values.store !== 'chrome' ) ) {
		throw new Error( 'OG generation does not use --input or a browser-specific --store.' );
	}
	const firefox = values.store === 'firefox';
	if ( firefox && values.only === 'promos' ) {
		throw new Error( 'Firefox exports screenshots only; promotional tiles use Chrome or Edge.' );
	}
	const subdirectory = values.only === 'og' ? '/og' : ( values.store === 'chrome' ? '' : `/${ values.store }` );
	const defaultOutput = `${ root }/tools/store-assets/.output${ subdirectory }`;
	const output = resolve( values.output ?? defaultOutput );
	const appsDirectory = resolve( root, 'apps' );
	if ( output === appsDirectory || output.startsWith( `${ appsDirectory }/` ) ) {
		throw new Error( 'Store assets must stay outside apps/ so they cannot become public routes or packaged assets.' );
	}
	return {
		store: values.store,
		locales: [ ...new Set( selected ) ],
		input: values.input ? resolve( values.input ) : null,
		output,
		only: firefox && values.only === 'all' ? 'screenshots' : values.only,
		screenshot: firefox ? { width: 2400, height: 1800, scale: 2 } : { width: 1280, height: 800, scale: 1 },
		syncWebsite: values[ 'sync-website' ],
		help: values.help,
	};
}
