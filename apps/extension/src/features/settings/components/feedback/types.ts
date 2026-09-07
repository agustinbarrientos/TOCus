


/**
 * Semantic persistence feedback with localized messages.
 * @since 0.1.0
 */
export interface FeedbackProps {
	/** Shared presentation modifiers for the notice's surrounding context. */
	className?: string;
	/** Opts the original text-only inline error into the shared native paragraph composition. */
	nativeError?: boolean;
	error?: string | null;
	success?: string | null;
}
