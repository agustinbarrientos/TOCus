import type { Page, TestInfo } from '@playwright/test';

/**
 * Immutable pre-migration screenshot identity.
 * @since 0.1.0
 */
export interface OriginalSnapshot {
	path: string;
	sha256: string;
}

/**
 * Browser case receiving the same real page and artifact context as Playwright.
 * @since 0.1.0
 */
export interface OriginalCaseContext {
	page: Page;
}

/**
 * Original-input case implementation; expected images cannot be updated.
 * @since 0.1.0
 */
export type OriginalCase = ( context: OriginalCaseContext, info: TestInfo ) => Promise<void>;

/**
 * Original component rectangle measured through a closed-shadow fixture bridge.
 * @since 0.1.0
 */
export interface OriginalClip {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Page-only capture options retaining the original closed-shadow component crop.
 * @since 0.1.0
 */
export interface OriginalCaptureOptions {
	clip?: OriginalClip;
}
