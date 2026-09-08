import type { Messages } from '@lingui/core';
import type { LocalizedHomePageProperties } from '../../localization';

/**
 * Server-rendered marketing copy and serializable packaged product messages.
 * @since 0.1.0
 */
export interface HomePageProps extends LocalizedHomePageProperties {
	demoMessages: Messages;
}
