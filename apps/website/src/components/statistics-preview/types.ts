import type { Messages } from '@lingui/core';

/**
 * Server-formatted example values carried as plain serializable data, never rendered HTML.
 * @since 0.1.0
 */
export interface StatisticsPreviewFormatting {
	estimates: Readonly<Record<number, string>>;
	durations: Readonly<Record<number, string>>;
	counts: Readonly<Record<number, string>>;
	dates: Readonly<Record<string, string>>;
}

/**
 * Packaged translations and explicit example-data disclosure.
 * @since 0.1.0
 */
export interface StatisticsPreviewProps {
	languageTag: string;
	messages: Messages;
	label: string;
	formatting: StatisticsPreviewFormatting;
}
