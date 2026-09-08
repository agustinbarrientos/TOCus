import youtubeIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-youtube.svg?url';
import netflixIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-netflix.svg?url';
import twitchIcon from '../../../../extension/src/features/onboarding/assets/site-icons/site-twitch.svg?url';
import hboMaxIcon from './assets/hbo-max.png?url';
import primeVideoIcon from './assets/prime-video.png?url';
import disneyPlusIcon from './assets/disney-plus.png?url';
import './style.scss';

/**
 * Shows supported playback services with locally packaged brand icons.
 * @return Service names paired with decorative icons without remote requests.
 * @since 0.1.0
 */
export function SupportedServices() {
	const services = [
		{ name: 'YouTube', icon: youtubeIcon },
		{ name: 'Netflix', icon: netflixIcon },
		{ name: 'Twitch', icon: twitchIcon },
		{ name: 'HBO Max', icon: hboMaxIcon, monochrome: true },
		{ name: 'Prime Video', icon: primeVideoIcon },
		{ name: 'Disney+', icon: disneyPlusIcon },
	];

	return <ul className="supported-services" role="list">
		{ services.map( ( service ) => <li key={ service.name }>
			<img className={ service.monochrome ? 'supported-service-monochrome' : undefined }
				src={ service.icon } alt="" width="32" height="32" />
			<span>{ service.name }</span>
		</li> ) }
	</ul>;
}
