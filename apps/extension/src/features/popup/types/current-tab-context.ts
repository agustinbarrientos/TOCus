import { z } from 'zod';

/**
 * Validates ephemeral active-tab metadata available after the user opens the popup.
 * @since 1.0.0 Initial implementation.
 */
export const PopupCurrentTabContextSchema = z.object( {
	id: z.number().int().nonnegative(),
	incognito: z.boolean(),
	url: z.string().min( 1 ),
} ).strict();

/**
 * Ephemeral active-tab metadata retained only for the current popup lifetime.
 * @since 1.0.0 Initial implementation.
 */
export type PopupCurrentTabContext = z.infer<typeof PopupCurrentTabContextSchema>;
