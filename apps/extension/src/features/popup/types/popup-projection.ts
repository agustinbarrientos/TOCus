import { z } from 'zod';
import {
	ProtectedSiteConfigurationSchema,
} from '../../../domains/protection/types/protected-site-configuration';
import { CanonicalHostSchema } from '../../../domains/protection/types/protected-site-rule';
import {
	DurationMillisecondsSchema,
	EpochMillisecondsSchema,
	ProtectionScopeIdSchema,
} from '../../../domains/protection/types/protection-value';

/**
 * Availability states for the complete popup projection.
 * @since 0.1.0 Initial implementation.
 */
export const PopupProjectionStatus = {
	AVAILABLE: 'available',
	UNAVAILABLE: 'unavailable',
} as const;

/**
 * Validates complete popup projection availability.
 * @since 0.1.0 Initial implementation.
 */
export const PopupProjectionStatusSchema = z.enum( PopupProjectionStatus );

/**
 * Complete popup projection availability.
 * @since 0.1.0 Initial implementation.
 */
export type PopupProjectionStatus = z.infer<typeof PopupProjectionStatusSchema>;

/**
 * Current website states presented by the popup.
 * @since 0.1.0 Initial implementation.
 */
export const PopupCurrentSiteStatus = {
	UNAVAILABLE: 'unavailable',
	UNSUPPORTED: 'unsupported',
	UNPROTECTED: 'unprotected',
	PROTECTED: 'protected',
} as const;

/**
 * Validates a current website popup state.
 * @since 0.1.0 Initial implementation.
 */
export const PopupCurrentSiteStatusSchema = z.enum( PopupCurrentSiteStatus );

/**
 * Current website popup state.
 * @since 0.1.0 Initial implementation.
 */
export type PopupCurrentSiteStatus = z.infer<typeof PopupCurrentSiteStatusSchema>;

/**
 * Browser-access states for a configured website.
 * @since 0.1.0 Initial implementation.
 */
export const PopupCurrentSiteAccess = {
	GRANTED: 'granted',
	MISSING: 'missing',
} as const;

/**
 * Validates browser access for a configured website.
 * @since 0.1.0 Initial implementation.
 */
export const PopupCurrentSiteAccessSchema = z.enum( PopupCurrentSiteAccess );

/**
 * Browser access for a configured website.
 * @since 0.1.0 Initial implementation.
 */
export type PopupCurrentSiteAccess = z.infer<typeof PopupCurrentSiteAccessSchema>;

/**
 * Current schedule states for a configured website.
 * @since 0.1.0 Initial implementation.
 */
export const PopupScheduleStatus = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	UNAVAILABLE: 'unavailable',
} as const;

/**
 * Validates a current popup schedule state.
 * @since 0.1.0 Initial implementation.
 */
export const PopupScheduleStatusSchema = z.enum( PopupScheduleStatus );

/**
 * Current popup schedule state.
 * @since 0.1.0 Initial implementation.
 */
export type PopupScheduleStatus = z.infer<typeof PopupScheduleStatusSchema>;

/**
 * Timing-scope kinds presented by the popup.
 * @since 0.1.0 Initial implementation.
 */
export const PopupScopeKind = {
	SHARED: 'shared',
	INDEPENDENT: 'independent',
} as const;

/**
 * Validates a popup timing-scope kind.
 * @since 0.1.0 Initial implementation.
 */
export const PopupScopeKindSchema = z.enum( PopupScopeKind );

/**
 * Popup timing-scope kind.
 * @since 0.1.0 Initial implementation.
 */
export type PopupScopeKind = z.infer<typeof PopupScopeKindSchema>;

/**
 * Active timer phases presented by the popup.
 * @since 0.1.0 Initial implementation.
 */
export const PopupTimerPhase = {
	WAITING: 'waiting',
	ALLOWANCE: 'allowance',
} as const;

/**
 * Validates a popup timer phase.
 * @since 0.1.0 Initial implementation.
 */
export const PopupTimerPhaseSchema = z.enum( PopupTimerPhase );

/**
 * Popup timer phase.
 * @since 0.1.0 Initial implementation.
 */
export type PopupTimerPhase = z.infer<typeof PopupTimerPhaseSchema>;

/**
 * Validates unavailable current-tab metadata.
 * @since 0.1.0 Initial implementation.
 */
const PopupUnavailableCurrentSiteSchema = z.object( {
	status: z.enum( [ PopupCurrentSiteStatus.UNAVAILABLE ] ),
} ).strict();

/**
 * Validates a browser-controlled current page.
 * @since 0.1.0 Initial implementation.
 */
const PopupUnsupportedCurrentSiteSchema = z.object( {
	status: z.enum( [ PopupCurrentSiteStatus.UNSUPPORTED ] ),
} ).strict();

/**
 * Validates a website that is not configured in TOCus.
 * @since 0.1.0 Initial implementation.
 */
const PopupUnprotectedCurrentSiteSchema = z.object( {
	status: z.enum( [ PopupCurrentSiteStatus.UNPROTECTED ] ),
	identityHost: CanonicalHostSchema,
} ).strict();

/**
 * Validates a configured website and its current timing availability.
 * @since 0.1.0 Initial implementation.
 */
const PopupProtectedCurrentSiteSchema = z.object( {
	status: z.enum( [ PopupCurrentSiteStatus.PROTECTED ] ),
	site: ProtectedSiteConfigurationSchema,
	scopeId: ProtectionScopeIdSchema,
	access: PopupCurrentSiteAccessSchema,
	schedule: PopupScheduleStatusSchema,
	nextWaitMilliseconds: z.union( [ DurationMillisecondsSchema, z.null() ] ),
} ).strict().superRefine( ( currentSite, context ) => {
	if ( currentSite.site.rule.scopeId !== currentSite.scopeId ) {
		context.addIssue( {
			code: 'custom',
			message: 'Current website scope must match its validated site rule.',
			path: [ 'scopeId' ],
		} );
	}

	if (
		currentSite.access === PopupCurrentSiteAccess.MISSING &&
		( currentSite.schedule !== PopupScheduleStatus.UNAVAILABLE || currentSite.nextWaitMilliseconds !== null )
	) {
		context.addIssue( {
			code: 'custom',
			message: 'A website without browser access cannot expose active schedule timing.',
			path: [ 'access' ],
		} );
	}

	if (
		currentSite.schedule !== PopupScheduleStatus.ACTIVE &&
		currentSite.nextWaitMilliseconds !== null
	) {
		context.addIssue( {
			code: 'custom',
			message: 'Only an active schedule can expose a next wait.',
			path: [ 'nextWaitMilliseconds' ],
		} );
	}
} );

/**
 * Validates every current website state presented by the popup.
 * @since 0.1.0 Initial implementation.
 */
export const PopupCurrentSiteSchema = z.discriminatedUnion( 'status', [
	PopupUnavailableCurrentSiteSchema,
	PopupUnsupportedCurrentSiteSchema,
	PopupUnprotectedCurrentSiteSchema,
	PopupProtectedCurrentSiteSchema,
] );

/**
 * Current website state presented by the popup.
 * @since 0.1.0 Initial implementation.
 */
export type PopupCurrentSite = z.infer<typeof PopupCurrentSiteSchema>;

/**
 * Current website states that include validated local site metadata.
 * @since 0.1.0 Initial implementation.
 */
export type PopupProtectedCurrentSite = z.infer<typeof PopupProtectedCurrentSiteSchema>;

/**
 * Fields shared by every active popup scope.
 * @since 0.1.0 Initial implementation.
 */
const PopupActiveScopeFields = {
	scopeId: ProtectionScopeIdSchema,
	siteCount: z.number().int().positive(),
	isCurrentScope: z.boolean(),
} as const;

/**
 * Validates one shared Waiting scope.
 * @since 0.1.0 Initial implementation.
 */
const PopupSharedWaitingScopeSchema = z.object( {
	...PopupActiveScopeFields,
	kind: z.enum( [ PopupScopeKind.SHARED ] ),
	site: z.null(),
	phase: z.enum( [ PopupTimerPhase.WAITING ] ),
	remainingMilliseconds: DurationMillisecondsSchema,
} ).strict();

/**
 * Validates one independent Waiting scope.
 * @since 0.1.0 Initial implementation.
 */
const PopupIndependentWaitingScopeSchema = z.object( {
	...PopupActiveScopeFields,
	kind: z.enum( [ PopupScopeKind.INDEPENDENT ] ),
	site: ProtectedSiteConfigurationSchema,
	phase: z.enum( [ PopupTimerPhase.WAITING ] ),
	remainingMilliseconds: DurationMillisecondsSchema,
} ).strict().superRefine( ( scope, context ) => {
	if ( scope.site.rule.scopeId !== scope.scopeId ) {
		context.addIssue( {
			code: 'custom',
			message: 'Independent timing scope must match its validated site rule.',
			path: [ 'scopeId' ],
		} );
	}
} );

/**
 * Validates one shared wall-clock Allowance scope.
 * @since 0.1.0 Initial implementation.
 */
const PopupSharedAllowanceScopeSchema = z.object( {
	...PopupActiveScopeFields,
	kind: z.enum( [ PopupScopeKind.SHARED ] ),
	site: z.null(),
	phase: z.enum( [ PopupTimerPhase.ALLOWANCE ] ),
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict();

/**
 * Validates one independent wall-clock Allowance scope.
 * @since 0.1.0 Initial implementation.
 */
const PopupIndependentAllowanceScopeSchema = z.object( {
	...PopupActiveScopeFields,
	kind: z.enum( [ PopupScopeKind.INDEPENDENT ] ),
	site: ProtectedSiteConfigurationSchema,
	phase: z.enum( [ PopupTimerPhase.ALLOWANCE ] ),
	expiresAtEpochMilliseconds: EpochMillisecondsSchema,
} ).strict().superRefine( ( scope, context ) => {
	if ( scope.site.rule.scopeId !== scope.scopeId ) {
		context.addIssue( {
			code: 'custom',
			message: 'Independent timing scope must match its validated site rule.',
			path: [ 'scopeId' ],
		} );
	}
} );

/**
 * Validates one active Waiting or Allowance scope without permitting mismatched site metadata.
 * @since 0.1.0 Initial implementation.
 */
export const PopupActiveScopeSchema = z.union( [
	PopupSharedWaitingScopeSchema,
	PopupIndependentWaitingScopeSchema,
	PopupSharedAllowanceScopeSchema,
	PopupIndependentAllowanceScopeSchema,
] );

/**
 * Active Waiting or Allowance scope presented by the popup.
 * @since 0.1.0 Initial implementation.
 */
export type PopupActiveScope = z.infer<typeof PopupActiveScopeSchema>;

/**
 * Validates an unavailable popup projection.
 * @since 0.1.0 Initial implementation.
 */
export const PopupUnavailableProjectionSchema = z.object( {
	status: z.enum( [ PopupProjectionStatus.UNAVAILABLE ] ),
} ).strict();

/**
 * Unavailable popup projection.
 * @since 0.1.0 Initial implementation.
 */
export type PopupUnavailableProjection = z.infer<typeof PopupUnavailableProjectionSchema>;

/**
 * Validates an available popup projection.
 * @since 0.1.0 Initial implementation.
 */
export const PopupAvailableProjectionSchema = z.object( {
	status: z.enum( [ PopupProjectionStatus.AVAILABLE ] ),
	capturedAtEpochMilliseconds: EpochMillisecondsSchema,
	currentSite: PopupCurrentSiteSchema,
	activeScopes: z.array( PopupActiveScopeSchema ),
} ).strict().superRefine( ( projection, context ) => {
	const currentScopeId = projection.currentSite.status === PopupCurrentSiteStatus.PROTECTED
		? projection.currentSite.scopeId
		: null;
	const seenScopeIds = new Set<string>();
	let hasActiveCurrentScope = false;

	for ( const [ index, scope ] of projection.activeScopes.entries() ) {
		if ( seenScopeIds.has( scope.scopeId ) ) {
			context.addIssue( {
				code: 'custom',
				message: 'Active timing scope identifiers must be unique.',
				path: [ 'activeScopes', index, 'scopeId' ],
			} );
		}

		seenScopeIds.add( scope.scopeId );
		const isCurrentScope = currentScopeId !== null && scope.scopeId === currentScopeId;

		if ( scope.isCurrentScope !== isCurrentScope ) {
			context.addIssue( {
				code: 'custom',
				message: 'Current timing scope marker must match the current website.',
				path: [ 'activeScopes', index, 'isCurrentScope' ],
			} );
		}

		if ( isCurrentScope ) {
			hasActiveCurrentScope = true;
		}

		if (
			scope.phase === PopupTimerPhase.ALLOWANCE &&
			scope.expiresAtEpochMilliseconds <= projection.capturedAtEpochMilliseconds
		) {
			context.addIssue( {
				code: 'custom',
				message: 'An Allowance must expire after the projection was captured.',
				path: [ 'activeScopes', index, 'expiresAtEpochMilliseconds' ],
			} );
		}
	}

	if (
		projection.currentSite.status === PopupCurrentSiteStatus.PROTECTED &&
		hasActiveCurrentScope &&
		projection.currentSite.nextWaitMilliseconds !== null
	) {
		context.addIssue( {
			code: 'custom',
			message: 'An active current timing scope cannot expose a next wait.',
			path: [ 'currentSite', 'nextWaitMilliseconds' ],
		} );
	}
} );

/**
 * Available popup projection.
 * @since 0.1.0 Initial implementation.
 */
export type PopupAvailableProjection = z.infer<typeof PopupAvailableProjectionSchema>;

/**
 * Validates every popup projection returned by the background runtime.
 * @since 0.1.0 Initial implementation.
 */
export const PopupProjectionSchema = z.discriminatedUnion( 'status', [
	PopupUnavailableProjectionSchema,
	PopupAvailableProjectionSchema,
] );

/**
 * Complete popup projection returned by the background runtime.
 * @since 0.1.0 Initial implementation.
 */
export type PopupProjection = z.infer<typeof PopupProjectionSchema>;
