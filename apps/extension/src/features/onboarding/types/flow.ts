import type { RefObject } from 'react';
import type { Language } from '../../../domains/preferences/types';
import type { ProtectedSiteConfiguration } from '../../../domains/protection/types/protected-site-configuration';
import type { AppearanceControlsUpdate } from '../../preferences/components/appearance-controls/types';
import type { OnboardingSitesStepCopy } from '../components/sites-step/types';
import type { OnboardingPageShell } from '../services/onboarding-page/types';

/**
 * Observable page-service state consumed by the onboarding presentation.
 * @since 0.1.0
 */
export type OnboardingState = Omit<OnboardingPageShell, keyof EventTarget>;

/**
 * The three supported onboarding destinations.
 * @since 0.1.0
 */
export const OnboardingStepIndex = {
	LANGUAGE: 0,
	APPEARANCE: 1,
	SITES: 2,
} as const;

/**
 * Numeric index expected by the shared stepper control.
 * @since 0.1.0
 */
export type OnboardingStepIndex = typeof OnboardingStepIndex[ keyof typeof OnboardingStepIndex ];

/**
 * Stable localization keys for site failures, retained across language changes.
 * @since 0.1.0
 */
export const OnboardingFailure = {
	INVALID_SITE: 'invalidSiteError',
	ALREADY_PROTECTED: 'alreadyProtectedError',
	PERMISSION_DENIED: 'permissionDeniedError',
	PERMISSION_REQUEST: 'permissionRequestError',
	PERMISSION_RETAINED: 'permissionRetainedError',
	SAVE: 'saveError',
	UNEXPECTED: 'unexpectedError',
	REMOVAL: 'removalError',
} as const satisfies Record<string, keyof OnboardingSitesStepCopy>;

/**
 * Stable localized failure key carried by the site controller.
 * @since 0.1.0
 */
export type OnboardingFailure = typeof OnboardingFailure[ keyof typeof OnboardingFailure ];

/**
 * Semantic outcomes announced after a site addition or removal.
 * @since 0.1.0
 */
export const OnboardingAnnouncementKind = {
	ADDED: 'added',
	REMOVED: 'removed',
	RETAINED: 'retained',
} as const;

/**
 * Site outcome retained across localization changes.
 * @since 0.1.0
 */
export type OnboardingAnnouncementKind =
	typeof OnboardingAnnouncementKind[ keyof typeof OnboardingAnnouncementKind ];

/**
 * Semantic site feedback; its sequence lets repeated announcements reach assistive technology.
 * @since 0.1.0
 */
export interface OnboardingAnnouncement {
	kind: OnboardingAnnouncementKind;
	name: string;
	sequence: number;
}

/**
 * Synchronous mutation gate shared by preference and site operations.
 * @since 0.1.0
 */
export interface OnboardingOperationGate {
	/** Reports the current gate without waiting for a React render. */
	readonly isPending: () => boolean;
	/** Starts one operation; false means another operation already owns the gate. */
	readonly begin: () => boolean;
	/** Releases the gate when the operation settles. */
	readonly end: () => void;
}

/**
 * Rendered pending state paired with the synchronous mutation gate.
 * @since 0.1.0
 */
export interface OnboardingPendingOperation extends OnboardingOperationGate {
	pending: boolean;
}

/**
 * Retains the removing row while browser permission cleanup outlives a storage notification.
 * @since 0.1.0
 */
export interface OnboardingPendingRemoval {
	site: ProtectedSiteConfiguration;
	index: number;
}

/**
 * Site draft state and operations, separated from page composition.
 * @since 0.1.0
 */
export interface OnboardingSitesController {
	sites: readonly ProtectedSiteConfiguration[];
	drafts: readonly ProtectedSiteConfiguration[];
	address: string;
	failure: OnboardingFailure | null;
	announcement: OnboardingAnnouncement | null;
	addressInputRef: RefObject<HTMLInputElement | null>;
	/** Updates the unsaved address unless an operation is pending. */
	readonly setAddress: ( value: string ) => void;
	/** Validates and adds a local draft without requesting browser access. */
	readonly addSite: ( input: string ) => void;
	/** Removes a local draft or persisted site and restores focus within the owned form. */
	readonly removeSite: ( site: ProtectedSiteConfiguration, source?: HTMLButtonElement ) => Promise<void>;
	/** Requests browser access for all remaining drafts from the current gesture. */
	readonly finish: () => Promise<void>;
}

/**
 * Complete presentation contract for onboarding views.
 * @since 0.1.0
 */
export interface OnboardingController extends OnboardingSitesController {
	step: OnboardingStepIndex;
	completedSteps: number;
	completed: boolean;
	pending: boolean;
	preferenceError: boolean;
	/** Navigates only to an already visited earlier step. */
	readonly selectPreviousStep: ( step: number ) => void;
	/** Applies language immediately and notifies the localization service. */
	readonly selectLanguage: ( language: Language ) => void;
	/** Updates controlled appearance preferences. */
	readonly selectAppearance: ( update: AppearanceControlsUpdate ) => void;
	/** Saves preferences and advances after localization is ready. */
	readonly advance: () => Promise<void>;
	/** Requests startup recovery from the page service. */
	readonly retry: () => void;
	/** Requests the existing Settings destination. */
	readonly openSettings: () => void;
}
