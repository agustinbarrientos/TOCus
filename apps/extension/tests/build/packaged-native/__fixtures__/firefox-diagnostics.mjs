/**
 * Retains browser page-lifecycle diagnostics separately from application errors.
 * @param {ReadonlyArray<{url: string, message: string}>} entries - Raw captured extension console entries.
 * @param {string} origin - Exact installed extension origin with its trailing slash.
 * @return {object} Original entries grouped by their diagnostic meaning.
 * @since 1.1.0
 */
export function classifyFirefoxDiagnostics( entries, origin ) {
	const errors = [];
	const unloadedContexts = [];
	const inactiveContexts = [];
	for ( const entry of entries ) {
		const source = entry.url.slice( origin.length );
		const pageSource = entry.url.startsWith( origin )
			&& ( /^chunks\/[^/?#]+\.js$/u.test( source ) || source === 'protected-page.js' );
		// Firefox reports these exact lifecycle states when an API promise settles after its page is replaced or cached.
		// Keep the original entries as evidence; other sources and messages remain in the error gate.
		if ( pageSource
			&& ( entry.message === "Promise rejected after context unloaded: Actor 'Conduits' destroyed before query 'RuntimeMessage' was resolved\n"
				|| entry.message === 'Promise resolved after context unloaded\n' ) ) {
			unloadedContexts.push( entry );
		} else if ( pageSource && entry.message === 'Promise resolved while context is inactive\n' ) {
			inactiveContexts.push( entry );
		} else {
			errors.push( entry );
		}
	}
	return { errors, unloadedContexts, inactiveContexts };
}
