import { z } from 'zod';
import { ProtectionConfigurationEditRejectionReasonSchema } from '../../../domains/protection/services/protection-configuration-editor';
import { ProtectedSiteEnrollmentStatus } from '../../protected-sites/services/protected-site-enrollment';

/**
 * Local request identifying a popup-owned user gesture for website enrollment.
 * @since 0.1.0 Initial implementation.
 */
export const PopupSiteEnrollmentRequestType = 'add-popup-site';

/**
 * Validates a website addition before the background requests browser access.
 * @since 0.1.0 Initial implementation.
 */
export const PopupSiteEnrollmentRequestSchema = z.object( {
	type: z.enum( [ PopupSiteEnrollmentRequestType ] ),
	siteInput: z.string(),
	independent: z.boolean(),
} ).strict();

/**
 * Validated popup website addition request.
 * @since 0.1.0 Initial implementation.
 */
export type PopupSiteEnrollmentRequest = z.infer<typeof PopupSiteEnrollmentRequestSchema>;

/**
 * Validates the enrollment outcome without exposing the saved configuration.
 * @since 0.1.0 Initial implementation.
 */
export const PopupSiteEnrollmentResultSchema = z.discriminatedUnion( 'status', [
	z.object( {
		status: z.enum( [ ProtectedSiteEnrollmentStatus.ADDED ] ),
	} ).strict(),
	z.object( {
		status: z.enum( [ ProtectedSiteEnrollmentStatus.REJECTED ] ),
		reason: ProtectionConfigurationEditRejectionReasonSchema,
	} ).strict(),
	z.object( {
		status: z.enum( [
			ProtectedSiteEnrollmentStatus.PERMISSION_DENIED,
			ProtectedSiteEnrollmentStatus.PERMISSION_ERROR,
			ProtectedSiteEnrollmentStatus.PERMISSION_RETAINED,
			ProtectedSiteEnrollmentStatus.SAVE_ERROR,
		] ),
	} ).strict(),
] );

/**
 * Presentation-neutral enrollment outcome returned to the popup.
 * @since 0.1.0 Initial implementation.
 */
export type PopupSiteEnrollmentResult = z.infer<typeof PopupSiteEnrollmentResultSchema>;
