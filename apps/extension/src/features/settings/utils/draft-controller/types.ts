import type { createDraft } from './index';

/**
 * Explicit outcome controlling whether a page may leave its saved draft.
 * @since 0.1.0
 */
export const DraftSaveResult = { SAVED: 'saved', FAILED: 'failed' } as const;

/**
 * Persistence succeeded with a clean draft, or departure must remain blocked.
 * @since 0.1.0
 */
export type DraftSaveResult = typeof DraftSaveResult[ keyof typeof DraftSaveResult ];

/**
 * Page-owned validation and persistence invoked directly from the user's Save gesture.
 * @since 0.1.0
 */
export type SaveDraft = () => Promise<DraftSaveResult>;

/**
 * Immutable presentation snapshot of an editable destination.
 * @since 0.1.0
 */
export interface DraftSnapshot<T extends object> {
	value: T;
	dirty: boolean;
	saving: boolean;
	saved: boolean;
	error: string | null;
}


/**
 * Draft state consulted by the page navigation guard.
 * @since 0.1.0
 */
export interface DraftGuard {
	dirty: boolean;
	saving: boolean;
	discard: () => void | Promise<void>;
	save: SaveDraft;
}


/**
 * Registers the currently visible editable destination.
 * @since 0.1.0
 */
export type RegisterDraft = ( guard: DraftGuard | null ) => void;

/**
 * Observable page-draft controller inferred from its implementation.
 * @since 0.1.0
 */
export type Draft<T extends object> = ReturnType<typeof createDraft<T>>;

/**
 * Domain-aware equality used to derive whether an editable candidate needs persistence.
 * @since 0.1.0
 */
export type DraftEquality<T extends object> = ( left: T, right: T ) => boolean;
