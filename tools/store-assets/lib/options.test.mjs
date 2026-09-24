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

test( 'escapes caption markup instead of executing it in the composition', () => {
	assert.equal( escapeHtml( '<script>"a" & \'b\'</script>' ), '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;' );
} );

test( 'refuses to generate into the website or extension source trees', () => {
	assert.throws( () => readOptions( [ '--output', '/project/apps/website/public/store' ], '/project' ), /outside apps/ );
	assert.throws( () => readOptions( [ '--output', '/project/apps/extension/public/store' ], '/project' ), /outside apps/ );
} );
