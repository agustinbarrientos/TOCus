import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { resolveSiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import type { WebsiteListProps } from './types';
import './style.scss';

/**
 * Groups real website rows by timing ownership using the selected language's collation.
 * @param props - Current sites, canonical grouping copy and the owning row editor renderer.
 * @return Reusable grouped list or the canonical empty state.
 * @since 0.1.0
 */
export function WebsiteList( props: WebsiteListProps ) {
	const { copy } = props;
	const sites = [ ...props.sites ].sort( ( first, second ) =>
		copy.compareNames( resolveSiteDisplayIdentity( first ).name, resolveSiteDisplayIdentity( second ).name ) );
	const groups = [
		{ title: copy.sharedGroupTitle, description: copy.sharedGroupDescription,
			sites: sites.filter( ( site ) => site.rule.scopeId === DefaultProtectionScopeId ) },
		{ title: copy.independentGroupTitle, description: copy.independentGroupDescription,
			sites: sites.filter( ( site ) => site.rule.scopeId !== DefaultProtectionScopeId ) },
	];
	return <div className="settings-site-groups">
		{ sites.length === 0 ? <section className="settings-sites-empty">
			<h2>{ copy.emptyTitle }</h2><p>{ copy.emptyDescription }</p>
		</section> : groups.filter( ( group ) => group.sites.length > 0 ).map( ( group ) =>
			<section className="tocus-section settings-site-group" key={ group.title }>
				<h2>{ group.title }</h2><p>{ group.description }</p>
				<ul className="settings-site-list">{ group.sites.map( ( site ) => props.renderItem( site ) ) }</ul>
			</section> ) }
	</div>;
}
