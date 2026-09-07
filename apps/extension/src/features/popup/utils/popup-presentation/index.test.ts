import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ProtectedSiteConfigurationSchema } from '../../../../domains/protection/types/protected-site-configuration';
import { createTestI18n } from '../../../../localization/__fixtures__/create-test-i18n';
import { createPopupCopy } from '../../../../localization/utils/create-popup-copy';
import { PopupOperationError } from '../../components/shell/types';
import { PopupTimerPhase, PopupScopeKind, PopupScheduleStatus, PopupCurrentSiteAccess, PopupCurrentSiteStatus, PopupActiveScopeSchema, type PopupProtectedCurrentSite } from '../../types/popup-projection';
import {
	getPopupCurrentScope,
	getPopupOperationMessage,
	getPopupRemainingTime,
	getPopupSiteIdentityInput,
	getPopupSiteStatus,
	type PopupIdentifiedCurrentSite,
} from './index';

const Copy = createPopupCopy( createTestI18n() );
const UnlistedSite: PopupIdentifiedCurrentSite = { status: PopupCurrentSiteStatus.UNPROTECTED, identityHost: 'example.com' };
const ListedSite: PopupProtectedCurrentSite = {
	status: PopupCurrentSiteStatus.PROTECTED,
	site: ProtectedSiteConfigurationSchema.parse( {
		identityHost: 'example.com',
		rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
	} ),
	scopeId: DefaultProtectionScopeId,
	access: PopupCurrentSiteAccess.GRANTED,
	schedule: PopupScheduleStatus.ACTIVE,
	nextWaitMilliseconds: null,
};
const Wait = PopupActiveScopeSchema.parse( {
	kind: PopupScopeKind.SHARED, phase: PopupTimerPhase.WAITING, scopeId: DefaultProtectionScopeId, site: null,
	siteCount: 1, isCurrentScope: true, remainingMilliseconds: 5000,
} );
const Allowance = PopupActiveScopeSchema.parse( {
	kind: PopupScopeKind.SHARED, phase: PopupTimerPhase.ALLOWANCE, scopeId: DefaultProtectionScopeId, site: null,
	siteCount: 1, isCurrentScope: true, expiresAtEpochMilliseconds: 10_000,
} );

describe( 'popup presentation projection', () => {
	it( 'uses the saved identity or a display-only host boundary without modifying site enrollment', () => {
		expect( getPopupSiteIdentityInput( ListedSite ) ).toBe( ListedSite.site );
		expect( getPopupSiteIdentityInput( UnlistedSite ) ).toEqual( {
			identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId },
		} );
		expect( UnlistedSite.status ).toBe( PopupCurrentSiteStatus.UNPROTECTED );
	} );

	it( 'never attributes another website timer to the current website', () => {
		const otherScope = PopupActiveScopeSchema.parse( {
			...Wait, scopeId: 'other_scope', isCurrentScope: false,
		} );
		expect( getPopupCurrentScope( UnlistedSite, [ Wait ] ) ).toBeUndefined();
		expect( getPopupCurrentScope( ListedSite, [ otherScope ] ) ).toBeUndefined();
		expect( getPopupCurrentScope( ListedSite, [ otherScope, Wait ] ) ).toBe( Wait );
		expect( getPopupCurrentScope( ListedSite, [ { ...otherScope, isCurrentScope: true } ] ) ).toBeUndefined();
	} );

	it( 'keeps access recovery ahead of timer or schedule descriptions', () => {
		const missingAccess: PopupProtectedCurrentSite = {
			...ListedSite, access: PopupCurrentSiteAccess.MISSING, schedule: PopupScheduleStatus.UNAVAILABLE,
		};
		expect( getPopupSiteStatus( UnlistedSite, undefined, Copy ) ).toBe( Copy.siteNotOnList );
		expect( getPopupSiteStatus( missingAccess, Wait, Copy ) ).toBe( Copy.browserAccessNeeded );
		expect( getPopupSiteStatus( ListedSite, Wait, Copy ) ).toBe( Copy.pauseInProgress );
		expect( getPopupSiteStatus( ListedSite, Allowance, Copy ) ).toBeNull();
		expect( getPopupSiteStatus( { ...ListedSite, schedule: PopupScheduleStatus.INACTIVE }, undefined, Copy ) )
			.toBe( Copy.offRightNow );
		expect( getPopupSiteStatus( { ...ListedSite, schedule: PopupScheduleStatus.UNAVAILABLE }, undefined, Copy ) )
			.toBe( Copy.statusUnavailable );
		expect( getPopupSiteStatus( ListedSite, undefined, Copy ) ).toBe( Copy.tocusActive );
	} );

	it( 'uses focused wait time but wall-clock allowance time and never displays a negative duration', () => {
		expect( getPopupRemainingTime( Wait, 4000 ) ).toBe( 5000 );
		expect( getPopupRemainingTime( Allowance, 4000 ) ).toBe( 6000 );
		expect( getPopupRemainingTime( Allowance, 11_000 ) ).toBe( 0 );
		expect( getPopupRemainingTime( undefined, 4000 ) ).toBeNull();
	} );

	it.each( [
		[ PopupOperationError.PERMISSION_DENIED, Copy.permissionDeniedError ],
		[ PopupOperationError.PERMISSION_ERROR, Copy.permissionError ],
		[ PopupOperationError.PERMISSION_RETAINED, Copy.permissionRetainedError ],
		[ PopupOperationError.SAVE_ERROR, Copy.saveError ],
	] )( 'explains the recoverable enrollment outcome %s', ( error, message ) => {
		expect( getPopupOperationMessage( error, Copy ) ).toBe( message );
	} );
} );
