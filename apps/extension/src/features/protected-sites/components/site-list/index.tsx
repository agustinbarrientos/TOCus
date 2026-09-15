import { resolveSiteDisplayIdentity } from '../../utils/site-display-name-resolver';
import type { WebsiteListProps } from './types';
import './style.scss';

/**
 * Orders custom active-hour exceptions first using the selected language's collation.
 * @param props - Current sites, canonical grouping copy and the owning row editor renderer.
 * @return Compact website list or the canonical empty state.
 * @since 0.1.0
 */
export function WebsiteList( props: WebsiteListProps ) {
	const { copy } = props;
	const sites = [ ...props.sites ].sort( ( first, second ) => {
		const firstCustom = props.hasCustomSchedule?.( first ) ?? first.schedule !== undefined;
		const secondCustom = props.hasCustomSchedule?.( second ) ?? second.schedule !== undefined;
		return Number( secondCustom ) - Number( firstCustom ) ||
			copy.compareNames( resolveSiteDisplayIdentity( first ).name, resolveSiteDisplayIdentity( second ).name );
	} );
	return <div className="settings-site-groups">
		{ sites.length === 0 ? <section className="settings-sites-empty">
			<h2>{ copy.emptyTitle }</h2><p>{ copy.emptyDescription }</p>
		</section> : <ul className="settings-site-list">{ sites.map( ( site ) => props.renderItem( site ) ) }</ul> }
	</div>;
}
