import { z } from 'zod';
import { PopupCurrentTabContextSchema } from './current-tab-context';

/**
 * Requests accepted by the local popup background controller.
 * @since 0.1.0 Initial implementation.
 */
export const PopupRuntimeRequestType = {
	READ_STATUS: 'read-popup-status',
	REFRESH_STATUS: 'refresh-popup-status',
} as const;

/**
 * Validates a popup runtime request discriminator.
 * @since 0.1.0 Initial implementation.
 */
export const PopupRuntimeRequestTypeSchema = z.enum( PopupRuntimeRequestType );

/**
 * Popup runtime request discriminator.
 * @since 0.1.0 Initial implementation.
 */
export type PopupRuntimeRequestType = z.infer<typeof PopupRuntimeRequestTypeSchema>;

/**
 * Fields shared by every popup runtime request.
 * @since 0.1.0 Initial implementation.
 */
const PopupRuntimeRequestFields = {
	currentTab: z.union( [ PopupCurrentTabContextSchema, z.null() ] ),
} as const;

/**
 * Validates a request for the latest popup status.
 * @since 0.1.0 Initial implementation.
 */
export const ReadPopupStatusRequestSchema = z.object( {
	...PopupRuntimeRequestFields,
	type: z.enum( [ PopupRuntimeRequestType.READ_STATUS ] ),
} ).strict();

/**
 * Request for the latest popup status.
 * @since 0.1.0 Initial implementation.
 */
export type ReadPopupStatusRequest = z.infer<typeof ReadPopupStatusRequestSchema>;

/**
 * Validates a request that reconciles changed configuration before reading popup status.
 * @since 0.1.0 Initial implementation.
 */
export const RefreshPopupStatusRequestSchema = z.object( {
	...PopupRuntimeRequestFields,
	type: z.enum( [ PopupRuntimeRequestType.REFRESH_STATUS ] ),
} ).strict();

/**
 * Request that reconciles changed configuration before reading popup status.
 * @since 0.1.0 Initial implementation.
 */
export type RefreshPopupStatusRequest = z.infer<typeof RefreshPopupStatusRequestSchema>;

/**
 * Validates every local popup runtime request.
 * @since 0.1.0 Initial implementation.
 */
export const PopupRuntimeRequestSchema = z.discriminatedUnion( 'type', [
	ReadPopupStatusRequestSchema,
	RefreshPopupStatusRequestSchema,
] );

/**
 * Local popup runtime request.
 * @since 0.1.0 Initial implementation.
 */
export type PopupRuntimeRequest = z.infer<typeof PopupRuntimeRequestSchema>;
