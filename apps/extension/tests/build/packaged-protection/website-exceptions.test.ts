import { expect, test } from './__fixtures__';
import type { ExtensionWorkerGlobal } from './types';
import { createProtectionNavigationRules } from '../../../src/features/protection-runtime/utils/protection-navigation-rules';
import { TestEmptyProtectionConfiguration } from '../../../src/domains/protection/types/__fixtures__';
import { DefaultProtectionScopeId } from '../../../src/domains/protection/types/protection-value';
import { StoredSessionProtectionStateSchema } from '../../../src/domains/protection/types/stored-protection-state';
import { ProtectionStorageEnvelopeSchema } from '../../../src/domains/protection/services/protection-storage/types';

test( 'packaged selectors allow subdomains and inactive paths while a nested pause overrides an allow', async ( { context, worker, page } ) => {
	await context.route( 'https://studio.example.test/**', ( route ) => route.fulfill( {
		contentType: 'text/html', body: '<h1>Allowed studio</h1>',
	} ) );
	const inactiveWeekday = await worker.evaluate( () =>
		[ 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday' ][ ( new Date().getDay() + 1 ) % 7 ] );
	await worker.evaluate( async ( configuration ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		await chrome.storage.local.set( { 'tocus.protection.configuration.v1': configuration } );
	}, {
		...TestEmptyProtectionConfiguration,
		sites: [
			{ identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId } },
			{ identityHost: 'studio.example.test', rule: { host: 'studio.example.test', includeSubdomains: false,
				scopeId: DefaultProtectionScopeId, behavior: 'allow' } },
			{ identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId, pathPrefix: '/open', behavior: 'allow' } },
			{ identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId, pathPrefix: '/open/private' } },
			{ identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId, pathPrefix: '/scheduled' }, schedule: { mode: 'custom',
				windows: [ { weekday: inactiveWeekday, startMinute: 0, endMinute: 1440 } ] } },
		],
	} );
	await expect.poll( () => worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.declarativeNetRequest.getDynamicRules() ).map( ( rule ) => rule.action.type ).sort();
	} ) ).toEqual( [ 'allow', 'allow', 'allow', 'redirect', 'redirect' ] );

	for ( const [ destination, heading ] of [
		[ 'https://studio.example.test/work', 'Allowed studio' ],
		[ 'https://example.test/open/child', 'Destination loaded' ],
		[ 'https://example.test/scheduled', 'Destination loaded' ],
	] as const ) {
		await page.goto( destination );
		await expect( page.getByRole( 'heading', { name: heading, exact: true } ) ).toBeVisible();
		await expect( page ).toHaveURL( destination );
		await expect( page.locator( 'tocus-f-interruption-screen' ) ).toHaveCount( 0 );
	}

	const destination = 'https://example.test/open/private?source=fixture#chapter:~:text=Destination%20loaded';
	await page.goto( destination, { waitUntil: 'commit' } );
	await page.bringToFront();
	await expect( page.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
	await expect( page ).toHaveURL( /\/pause\.html$/u );
	await expect.poll( () => worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		const values = await chrome.storage.session.get( 'tocus.protection.session.v1' );
		return values[ 'tocus.protection.session.v1' ];
	} ).then( ( stored ) => {
		const document = StoredSessionProtectionStateSchema.parse(
			ProtectionStorageEnvelopeSchema.parse( stored ).document );
		return document.scopes[ DefaultProtectionScopeId ]?.participants
			.map( ( participant ) => participant.retainedDestination );
	} ) ).toEqual( [ destination ] );
} );

test( 'packaged path-only protection preserves case and encoded boundaries and catches an in-page transition', async ( { worker, page } ) => {
	await worker.evaluate( async ( configuration ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		await chrome.storage.local.set( { 'tocus.protection.configuration.v1': configuration } );
	}, {
		...TestEmptyProtectionConfiguration,
		sites: [ { identityHost: 'example.test', rule: { host: 'example.test', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts' }, timingConfiguration: {
			...TestEmptyProtectionConfiguration.timingConfiguration, initialWaitMilliseconds: 20_000,
		} } ],
	} );
	await expect.poll( () => worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.declarativeNetRequest.getDynamicRules() ).length;
	} ) ).toBe( 1 );
	for ( const path of [ '/', '/shortstory', '/Shorts', '/shorts%2Fitem' ] ) {
		await page.goto( `https://example.test${ path }` );
		await expect( page.getByRole( 'heading', { name: 'Destination loaded', exact: true } ) ).toBeVisible();
		await expect( page ).toHaveURL( `https://example.test${ path }` );
		await expect( page.locator( 'tocus-f-interruption-screen' ) ).toHaveCount( 0 );
	}
	await page.bringToFront();
	await page.evaluate( () => {
		history.pushState( {}, '', '/shorts/item?source=fixture#chapter' );
	} );
	await expect( page.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
	const stored = await worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.storage.session.get( 'tocus.protection.session.v1' ) )[ 'tocus.protection.session.v1' ];
	} );
	const scope = StoredSessionProtectionStateSchema.parse( ProtectionStorageEnvelopeSchema.parse( stored ).document )
		.scopes[ DefaultProtectionScopeId ];
	expect( scope ).toMatchObject( { type: 'waiting', capturedWaitDurationMilliseconds: 20_000 } );
	expect( scope?.participants.map( ( participant ) => participant.retainedDestination ) )
		.toEqual( [ 'https://example.test/shorts/item?source=fixture#chapter' ] );
} );


test( 'packaged long paths keep runtime protection when Chrome cannot compile a declarative selector', async ( { worker, page } ) => {
	const path = `/entries/${ 'article'.repeat( 40 ) }`;
	const rule = { host: 'example.test', includeSubdomains: true, scopeId: DefaultProtectionScopeId, pathPrefix: path };
	const projected = createProtectionNavigationRules( [ rule ], 'chrome-extension://fixture/pause.html' )[ 0 ];
	const regex = projected?.condition.regexFilter;
	if ( typeof regex !== 'string' ) {
		throw new TypeError( 'The synthetic path must produce a declarative regex candidate.' );
	}
	expect( await worker.evaluate( async ( expression ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return chrome.declarativeNetRequest.isRegexSupported( {
			regex: expression, isCaseSensitive: true, requireCapturing: true,
		} );
	}, regex ) ).toEqual( { isSupported: false, reason: 'memoryLimitExceeded' } );
	await worker.evaluate( async ( configuration ) => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		await chrome.storage.local.set( { 'tocus.protection.configuration.v1': configuration } );
	}, { ...TestEmptyProtectionConfiguration, sites: [ { identityHost: 'example.test', rule, timingConfiguration: {
		...TestEmptyProtectionConfiguration.timingConfiguration, initialWaitMilliseconds: 20_000,
	} } ] } );
	await page.goto( 'https://example.test/outside' );
	await expect( page.getByRole( 'heading', { name: 'Destination loaded', exact: true } ) ).toBeVisible();
	await expect( page ).toHaveURL( 'https://example.test/outside' );
	const destination = `https://example.test${ path }?source=fixture#chapter`;
	await page.goto( destination, { waitUntil: 'commit' } ).catch( ( error: unknown ) => {
		// Runtime interception may cancel the initial request before its document commits.
		if ( ! ( error instanceof Error ) || ! error.message.includes( 'ERR_ABORTED' ) ) {
			throw error;
		}
	} );
	await page.bringToFront();
	await expect( page.getByRole( 'region', { name: /^Breathe (?:in|out)$/u } ) ).toBeVisible();
	await expect.poll( () => worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return chrome.declarativeNetRequest.getDynamicRules();
	} ) ).toEqual( [] );
	const stored = await worker.evaluate( async () => {
		const { chrome } = globalThis as unknown as ExtensionWorkerGlobal;
		return ( await chrome.storage.session.get( 'tocus.protection.session.v1' ) )[ 'tocus.protection.session.v1' ];
	} );
	const scope = StoredSessionProtectionStateSchema.parse( ProtectionStorageEnvelopeSchema.parse( stored ).document )
		.scopes[ DefaultProtectionScopeId ];
	expect( scope ).toMatchObject( { type: 'waiting', capturedWaitDurationMilliseconds: 20_000 } );
	expect( scope?.participants.map( ( participant ) => participant.retainedDestination ) ).toEqual( [ destination ] );
} );
