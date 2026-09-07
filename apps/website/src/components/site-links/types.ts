import type { AnchorHTMLAttributes, ReactNode } from 'react';

/**
 * One explicitly chosen external destination, never a passive network request.
 * @since 0.1.0
 */
export interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	href: string;
	children: ReactNode;
	className?: string;
}

/**
 * Public project destinations shared by the home page.
 * @since 0.1.0
 */
export const WebsiteLink = {
	SOURCE: 'https://github.com/agustinbarrientos/TOCus',
	AUTHOR: 'https://agustinbarrientos.com/about/?utm_source=tocus&utm_medium=website&utm_campaign=about',
} as const;
