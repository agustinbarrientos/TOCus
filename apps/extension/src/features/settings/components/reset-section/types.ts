import type { ReactNode } from 'react';

/**
 * Localized description and trigger for one destructive data operation.
 * @since 1.1.0
 */
export interface ResetSectionProps {
	title: string;
	description: string;
	label: string;
	disabled: boolean;
	onRequest: () => void;
	children?: ReactNode;
}
