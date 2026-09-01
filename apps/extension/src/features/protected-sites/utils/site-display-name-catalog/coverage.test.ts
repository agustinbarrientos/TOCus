import { describe, expect, it } from 'vitest';
import { canonicalizeProtectedSite } from '../../../../domains/protection/utils/protected-site-canonicalizer';
import siteDisplayNameCatalogSource from './catalog.json';
import topSitesSnapshot from './__fixtures__/crux-top-sites-202607.json';
import { compileSiteDisplayNameCatalog } from './index';
import { resolveSiteDisplayIdentity } from '../site-display-name-resolver';

const COVERAGE_SCOPE_ID = 'scope_catalog_coverage';

describe( 'site display-name popularity coverage', () => {
	it( 'declares an exact catalog identity for every CrUX top-1000 host', () => {
		const catalog = compileSiteDisplayNameCatalog( siteDisplayNameCatalogSource );
		const exactCatalogHosts = new Set(
			siteDisplayNameCatalogSource.flatMap( ( group ) => (
				group.domains.filter( ( domain ) => ! domain.startsWith( '*.' ) )
			) ),
		);
		const missingExactCatalogHosts = topSitesSnapshot.rankBuckets.top1000.filter(
			( host ) => ! exactCatalogHosts.has( host ) || catalog.resolve( host ) === undefined,
		);

		expect( missingExactCatalogHosts ).toEqual( [] );
	} );

	it( 'creates a local identity for every unique CrUX top-10000 host', () => {
		const hosts = [
			...topSitesSnapshot.rankBuckets.top1000,
			...topSitesSnapshot.rankBuckets.next4000,
			...topSitesSnapshot.rankBuckets.next5000,
		];
		const unsupportedHosts: string[] = [];

		for ( const host of hosts ) {
			const canonicalSite = canonicalizeProtectedSite( host, COVERAGE_SCOPE_ID );

			if ( canonicalSite.status === 'rejected' ) {
				unsupportedHosts.push( host );
				continue;
			}

			resolveSiteDisplayIdentity( {
				identityHost: canonicalSite.identityHost,
				rule: canonicalSite.rule,
			} );
		}

		expect( topSitesSnapshot.rankBuckets.top1000 ).toHaveLength( 1_000 );
		expect( topSitesSnapshot.rankBuckets.next4000 ).toHaveLength( 3_998 );
		expect( topSitesSnapshot.rankBuckets.next5000 ).toHaveLength( 4_999 );
		expect( topSitesSnapshot.scope.originCount - topSitesSnapshot.scope.uniqueHostCount ).toBe(
			topSitesSnapshot.scope.duplicateHostCount,
		);
		expect( hosts ).toHaveLength( topSitesSnapshot.scope.uniqueHostCount );
		expect( new Set( hosts ).size ).toBe( hosts.length );
		expect( unsupportedHosts ).toEqual( [] );
	} );
} );
