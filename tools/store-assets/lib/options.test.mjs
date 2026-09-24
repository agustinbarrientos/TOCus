import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOptions } from './options.mjs';
import { locales, scenes } from './catalog.mjs';
import { escapeHtml } from './render.mjs';

test( 'every supported language has exactly five nonempty one-line captions', () => {
	assert.equal( Object.keys( locales ).length, 10 );
	for ( const locale of Object.values( locales ) ) {
		assert.equal( locale.captions.length, scenes.length );
		assert.equal( new Intl.Locale( locale.browserLocale ).baseName, locale.browserLocale );
		assert.ok( locale.captions.every( ( caption ) => caption.trim() && ! caption.includes( '\n' ) ) );
	}
} );

test( 'rejects unknown locale codes, flags, and output kinds before capture', () => {
	assert.throws( () => readOptions( [ '--locale', 'es' ], '/project' ), /Unknown locale/ );
	assert.throws( () => readOptions( [ '--only', 'video' ], '/project' ), /--only/ );
	assert.throws( () => readOptions( [ '--deploy' ], '/project' ) );
} );

test( 'deduplicates selected languages and defaults to ignored local output', () => {
	const options = readOptions( [ '--locale', 'en,es-vos,en' ], '/project' );
	assert.deepEqual( options.locales, [ 'en', 'es-vos' ] );
	assert.equal( options.output, '/project/tools/store-assets/.output' );
	assert.equal( options.input, null );
} );

test( 'isolates Edge exports while retaining the original Chrome output directory', () => {
	const edge = readOptions( [ '--store', 'edge', '--only', 'promos' ], '/project' );
	assert.equal( edge.store, 'edge' );
	assert.equal( edge.output, '/project/tools/store-assets/.output/edge' );
	assert.equal( readOptions( [], '/project' ).store, 'chrome' );
	assert.equal( readOptions( [ '--store', 'edge', '--output', '/tmp/edge-assets' ], '/project' ).output, '/tmp/edge-assets' );
	assert.throws( () => readOptions( [ '--store', 'unknown' ], '/project' ), /--store/ );
} );

test( 'escapes caption markup instead of executing it in the composition', () => {
	assert.equal( escapeHtml( '<script>"a" & \'b\'</script>' ), '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;' );
} );

test( 'refuses to generate into the website or extension source trees', () => {
	assert.throws( () => readOptions( [ '--output', '/project/apps/website/public/store' ], '/project' ), /outside apps/ );
	assert.throws( () => readOptions( [ '--output', '/project/apps/extension/public/store' ], '/project' ), /outside apps/ );
} );

test( 'isolates OG exports and requires an explicit opt-in to copy finished images into the website', () => {
	const options = readOptions( [ '--only', 'og' ], '/project' );
	assert.equal( options.output, '/project/tools/store-assets/.output/og' );
	assert.equal( options.syncWebsite, false );
	assert.equal( readOptions( [ '--only', 'og', '--sync-website' ], '/project' ).syncWebsite, true );
	assert.throws( () => readOptions( [ '--sync-website' ], '/project' ), /only og/ );
	assert.throws( () => readOptions( [ '--only', 'og', '--input', '/tmp/captures' ], '/project' ), /does not use/ );
	assert.throws( () => readOptions( [ '--only', 'og', '--store', 'edge' ], '/project' ), /does not use/ );
} );
