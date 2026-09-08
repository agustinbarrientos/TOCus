import { describe, expect, it } from 'vitest';
import { normalizeShadowLengths } from './shadow-styles';

describe( 'owned shadow stylesheet lengths', () => {
	it( 'resolves signed, fractional and calculated rem dimensions against the fixed 16px base', () => {
		expect( normalizeShadowLengths( 'padding: .5rem -1.25rem; width: calc(1rem * var(--mantine-scale));' ) )
			.toBe( 'padding: 8px -20px; width: calc(16px * var(--mantine-scale));' );
	} );
	it( 'preserves quoted content, URLs, comments, identifiers and non-rem dimensions', () => {
		const css = 'content: "1rem"; src: url(font-1rem.woff2); /* 2rem */ --item1rem: 1em; height: 20px;';
		expect( normalizeShadowLengths( css ) ).toBe( css );
	} );
	it( 'supports valid scientific dimension notation without changing quoted URL content', () => {
		expect( normalizeShadowLengths( 'margin: +1e-1rem; background: url("icon)1rem.svg");' ) )
			.toBe( 'margin: 1.6px; background: url("icon)1rem.svg");' );
	} );
} );
