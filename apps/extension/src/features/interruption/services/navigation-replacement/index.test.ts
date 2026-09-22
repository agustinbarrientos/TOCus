import { describe, expect, it, vi } from 'vitest';
import { InterruptionNavigationReplacementMessageType } from '../../../protection-runtime/types/runtime-message';
import { registerInterruptionNavigationReplacement } from './index';
import type {
	InterruptionNavigationReplacementListener,
	InterruptionNavigationReplacementLocation,
} from './types';

const EXTENSION_ID = 'extension-id';
const CURRENT_URL = `chrome-extension://${ EXTENSION_ID }/pause.html`;
const DESTINATION = 'https://person:secret@example.test/watch%2Fencoded?v=one%20two#chapter%201';
const CARRIER_URL = `${ CURRENT_URL }#destination=${ DESTINATION }`;

/**
 * Creates a captured listener with observable browser boundaries.
 * @param href - Initial interruption-document URL.
 * @return Registered listener and its observable effects.
 */
function createHarness( href = CURRENT_URL ): {
	listener: InterruptionNavigationReplacementListener;
	location: InterruptionNavigationReplacementLocation;
	replace: ReturnType<typeof vi.fn>;
} {
	const addListener = vi.fn<( listener: InterruptionNavigationReplacementListener ) => void>();
	const replace = vi.fn<( url: string ) => void>();
	const location = { href, replace };

	registerInterruptionNavigationReplacement( {
		location,
		runtime: {
			id: EXTENSION_ID,
			getURL: vi.fn().mockReturnValue( CURRENT_URL ),
			onMessage: { addListener },
		},
	} );

	const listener = addListener.mock.calls[ 0 ]?.[ 0 ];

	if ( listener === undefined ) {
		throw new TypeError( 'Expected a registered navigation-replacement listener.' );
	}

	return { listener, location, replace };
}

/**
 * Creates one valid replacement request.
 * @param sourceUrl - Exact interruption source observed by the background.
 * @param url - Authorized navigation destination.
 * @return Replacement request payload.
 */
function createRequest( sourceUrl = CURRENT_URL, url = DESTINATION ): unknown {
	return {
		type: InterruptionNavigationReplacementMessageType.REPLACE,
		sourceUrl,
		url,
	};
}

describe( 'registerInterruptionNavigationReplacement', () => {
	it.each( [ CURRENT_URL, CARRIER_URL ] )(
		'acknowledges before replacing an exact interruption document: %s',
		( sourceUrl ) => {
			const harness = createHarness( sourceUrl );
			const sendResponse = vi.fn( () => {
				expect( harness.replace ).not.toHaveBeenCalled();
			} );

			harness.listener(
				createRequest( sourceUrl ),
				{ id: EXTENSION_ID },
				sendResponse,
			);
			expect( sendResponse ).toHaveBeenCalledExactlyOnceWith( { replaced: true } );
			expect( harness.replace ).toHaveBeenCalledExactlyOnceWith( DESTINATION );
		} );

	it.each( [
		{ label: 'different extension', sender: { id: 'another-extension' } },
		{ label: 'missing extension identity', sender: {} },
		{ label: 'tab sender', sender: { id: EXTENSION_ID, tab: {} } },
	] )( 'rejects a command from a $label', ( { sender } ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.listener( createRequest(), sender, sendResponse );
		expect( sendResponse ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it.each( [
		undefined,
		null,
		{},
		{ type: 'replace-interruption-navigation', sourceUrl: CURRENT_URL },
		{ type: 'replace-interruption-navigation', sourceUrl: CURRENT_URL, url: DESTINATION, extra: true },
		{ type: 'other', sourceUrl: CURRENT_URL, url: DESTINATION },
	] )( 'rejects malformed input: %j', ( input ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.listener( input, { id: EXTENSION_ID }, sendResponse );
		expect( sendResponse ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it.each( [
		'http://',
		'https://[2001:db8::1',
		'HTTPS://example.test/',
		' https://example.test/',
		'javascript:alert(1)',
		'/relative',
		CURRENT_URL,
	] )( 'rejects a malformed or non-literal HTTP(S) destination: %s', ( url ) => {
		const harness = createHarness();
		const sendResponse = vi.fn();

		harness.listener( createRequest( CURRENT_URL, url ), { id: EXTENSION_ID }, sendResponse );
		expect( sendResponse ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
	} );

	it.each( [
		{
			label: 'stale background observation',
			href: CURRENT_URL,
			sourceUrl: CARRIER_URL,
		},
		{
			label: 'unrelated extension document',
			href: `chrome-extension://${ EXTENSION_ID }/options.html`,
			sourceUrl: `chrome-extension://${ EXTENSION_ID }/options.html`,
		},
		{
			label: 'spoofed interruption path',
			href: `${ CURRENT_URL }/spoof`,
			sourceUrl: `${ CURRENT_URL }/spoof`,
		},
		{
			label: 'unrelated carrier fragment',
			href: `${ CURRENT_URL }#other=${ DESTINATION }`,
			sourceUrl: `${ CURRENT_URL }#other=${ DESTINATION }`,
		},
	] )( 'rejects a $label', ( { href, sourceUrl } ) => {
		const harness = createHarness( href );
		const sendResponse = vi.fn();

		harness.listener( createRequest( sourceUrl ), { id: EXTENSION_ID }, sendResponse );
		expect( sendResponse ).not.toHaveBeenCalled();
		expect( harness.replace ).not.toHaveBeenCalled();
	} );
} );
