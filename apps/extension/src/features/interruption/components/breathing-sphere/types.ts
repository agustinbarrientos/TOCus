import type { ComponentBreathingSphere } from '.';

declare global {
	/** Native tag contract retained for controller and canvas consumers. */
	interface HTMLElementTagNameMap {
		'tocus-f-breathing-sphere': ComponentBreathingSphere;
	}
}
