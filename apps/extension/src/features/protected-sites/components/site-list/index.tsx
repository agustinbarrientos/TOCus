import { Fragment } from 'react';
import { matchProtectedUrl } from '../../../../domains/protection/utils/protected-url-matcher';
import { ProtectedUrlMatchStatus } from '../../../../domains/protection/types/protected-url-match';
import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { getWebsitePresentationGroupHost, resolveSiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import type { WebsiteListProps } from './types';
import './style.scss';

/**
 * Orders custom active-hour exceptions first using the selected language's collation.
 * @param props - Current sites, canonical grouping copy and the owning row editor renderer.
 * @return Compact website list or the canonical empty state.
 * @since 1.0.0
 */
export function WebsiteList( props: WebsiteListProps ) {
	const { copy } = props;
	const sites = [ ...props.sites ].sort( ( first, second ) => {
		const firstCustom = props.hasCustomSchedule?.( first ) ?? first.schedule !== undefined;
		const secondCustom = props.hasCustomSchedule?.( second ) ?? second.schedule !== undefined;
		return Number( secondCustom ) - Number( firstCustom ) ||
			copy.compareNames( resolveSiteDisplayIdentity( first ).name, resolveSiteDisplayIdentity( second ).name );
	} );
	const groups = new Map<string, typeof sites>();
	for ( const site of sites ) {
		const host = getWebsitePresentationGroupHost( site.rule.host );
		groups.set( host, [ ...groups.get( host ) ?? [], site ] );
	}
	return <div className="settings-site-groups">
		{ sites.length === 0 ? <section className="settings-sites-empty">
			<h2>{ copy.emptyTitle }</h2><p>{ copy.emptyDescription }</p>
		</section> : <ul className="settings-site-list">{ [ ...groups ].map( ( [ groupHost, members ] ) => {
			const roots = members.filter( ( site ) =>
				site.rule.host === groupHost && site.rule.pathPrefix === undefined )
				.sort( ( first, second ) =>
					Number( second.rule.includeSubdomains ) - Number( first.rule.includeSubdomains ) );
			const main = roots[ 0 ];
			const representative = main ?? members[ 0 ];
			if ( representative === undefined ) {
				return null;
			}
			const exceptions = members.filter( ( site ) =>
				site.rule.host !== groupHost || site.rule.pathPrefix !== undefined );
			return <Fragment key={ groupHost }>
				{ props.renderItem( representative, { groupHost, members, exception: false,
					presentationOnly: main === undefined, rootPeers: roots.length > 1,
					groupUnprotected: main === undefined && matchProtectedUrl( `https://${ groupHost }/`,
						sites.map( ( site ) => site.rule ) ).status === ProtectedUrlMatchStatus.UNPROTECTED } ) }
				{ roots.slice( 1 ).map( ( site ) => <Fragment key={ getProtectedSiteRuleKey( site.rule ) }>
					{ props.renderItem( site, { groupHost, members, exception: false,
						presentationOnly: false, rootPeer: true, rootPeers: true } ) }
				</Fragment> ) }
				{ exceptions.length > 0 && <li className="settings-site-exceptions">
					<div className="settings-site-exceptions-label">{ props.exceptionsLabel }</div>
					<ul>{ exceptions.map( ( site ) => <Fragment key={ getProtectedSiteRuleKey( site.rule ) }>
						{ props.renderItem( site, { groupHost, members, exception: true, presentationOnly: false } ) }
					</Fragment> ) }</ul>
				</li> }
			</Fragment>;
		} ) }</ul> }
	</div>;
}
