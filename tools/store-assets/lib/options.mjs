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
		locale: { type: 'string', default: 'all' },
		input: { type: 'string' },
		output: { type: 'string' },
		only: { type: 'string', default: 'all' },
		help: { type: 'boolean', default: false },
	} } );
	const selected = values.locale === 'all' ? Object.keys( locales ) : values.locale.split( ',' ).map( ( value ) => value.trim() );
	if ( selected.some( ( locale ) => ! Object.hasOwn( locales, locale ) ) ) {
		throw new Error( `Unknown locale. Choose: ${ Object.keys( locales ).join( ', ' ) }` );
	}
	if ( ! [ 'all', 'screenshots', 'promos' ].includes( values.only ) ) {
		throw new Error( '--only must be all, screenshots, or promos.' );
	}
	const output = resolve( values.output ?? `${ root }/tools/store-assets/.output` );
	const appsDirectory = resolve( root, 'apps' );
	if ( output === appsDirectory || output.startsWith( `${ appsDirectory }/` ) ) {
		throw new Error( 'Store assets must stay outside apps/ so they cannot become public routes or packaged assets.' );
	}
	return {
		locales: [ ...new Set( selected ) ],
		input: values.input ? resolve( values.input ) : null,
		output,
		only: values.only,
		help: values.help,
	};
}
