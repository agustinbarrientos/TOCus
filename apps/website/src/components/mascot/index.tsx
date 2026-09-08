import type { MascotProps } from './types';
import './style.scss';

/**
 * Displays the approved peeking mascot without a model loader or WebGL context.
 * @param props - Alternative text and optional lazy loading for the footer artwork.
 * @return Locally packaged raster artwork with a reserved aspect ratio.
 * @since 0.1.0
 */
export function Mascot( props: MascotProps ) {
	const { alt, loading = 'eager' } = props;
	return <div className="mascot">
		<img data-mascot src="/images/mascot-peek.webp" width="1254" height="1254"
			loading={ loading } fetchPriority={ loading === 'eager' ? 'high' : 'auto' } alt={ alt } />
	</div>;
}
