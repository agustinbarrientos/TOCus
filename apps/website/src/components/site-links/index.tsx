import { Anchor, Icon, IconName } from '@tocus/ui';
import type { ExternalLinkProps } from './types';

/**
 * Keeps external navigation identifiable and safe without prefetching destinations.
 * @param props - Destination, readable label and optional layout class.
 * @return Underlined external link using the shared icon.
 * @since 0.1.0
 */
export function ExternalLink( props: ExternalLinkProps ) {
	const { children, className, ...anchorProps } = props;
	return <Anchor { ...anchorProps } target="_blank" rel="noopener noreferrer" underline="always"
		className={ `tocus-external-link ${ className ?? '' }` }>
		{ children }<Icon name={ IconName.ARROW_UP_RIGHT_FROM_SQUARE } />
	</Anchor>;
}

export { WebsiteLink } from './types';
