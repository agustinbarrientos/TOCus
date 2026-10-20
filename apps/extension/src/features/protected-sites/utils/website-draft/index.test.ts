import { describe, expect, it } from 'vitest';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { ScheduleMode, Weekday } from '../../../../domains/protection/types/protection-schedule';
import { getProtectedSiteRuleKey } from '../../../../domains/protection/utils/protected-site-rule-key';
import { DefaultTimingConfiguration } from '../../../../domains/protection/types/timing-configuration';
import { createWebsiteDraft, serializeWebsiteDraft, stageWebsiteDraftSite } from './index';
import { createDraft } from '../../../settings/utils/draft-controller';

describe( 'website details draft', () => {
	it( 'keeps sibling policy details separate and retains timing and no-pause during unrelated edits', () => {
		const root = { identityHost: 'youtube.com', rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } };
		const child = { ...root, rule: { ...root.rule, pathPrefix: '/shorts', behavior: 'allow' as const }, timingConfiguration: DefaultTimingConfiguration };
		const draft = createWebsiteDraft( [ root, child ] );
		expect( Object.keys( draft.detailsByRuleKey ) ).toHaveLength( 2 );
		const rootDetails = draft.detailsByRuleKey[ getProtectedSiteRuleKey( root.rule ) ];
		if ( ! rootDetails ) {
			throw new Error( 'The root must own draft details.' );
		}
		rootDetails.displayName = 'Videos';
		expect( serializeWebsiteDraft( draft )[ 1 ] ).toEqual( child );
	} );

	it( 'keeps incomplete schedules editable and rejects persistence until their fields are complete', () => {
		const draft = createWebsiteDraft( [ { identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } } ] );
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } ) ] = { behavior: 'pause', timingConfiguration: null, displayName: '', schedule: { mode: ScheduleMode.CUSTOM,
			windows: [ { id: 0, weekday: Weekday.MONDAY, start: '', end: '', fullDay: false } ] } };
		expect( () => serializeWebsiteDraft( draft ) ).toThrow();
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } ) ] = {
			behavior: 'pause', timingConfiguration: null, displayName: '', schedule: { mode: ScheduleMode.CUSTOM,
				windows: [ { id: 0, weekday: Weekday.MONDAY, start: '09:00', end: '17:00', fullDay: false } ] },
		};
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ {
			identityHost: 'example.com',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
			schedule: { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.MONDAY, startMinute: 540,
				endMinute: 1020 } ] },
		} ] );
	} );

	it( 'clears the custom schedule and name without changing the shared matching rule', () => {
		const draft = createWebsiteDraft( [ { identityHost: 'example.com', displayNameOverride: 'Reading',
			rule: { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId },
			schedule: { mode: ScheduleMode.CUSTOM, windows: [ { weekday: Weekday.FRIDAY, startMinute: 540,
				endMinute: 1020 } ] } } ] );
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( { host: 'example.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } ) ] = { displayName: '  ', schedule: null, behavior: 'pause', timingConfiguration: null };
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ {
			identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true,
				scopeId: DefaultProtectionScopeId },
		} ] );
	} );
} );

describe( 'complete website policies', () => {
	it( 'clears explicit timing and no-pause behavior while retaining the exact stored target', () => {
		const site = { identityHost: 'studio.youtube.com', rule: { host: 'youtube.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts', behavior: 'allow' as const },
		timingConfiguration: DefaultTimingConfiguration };
		const draft = createWebsiteDraft( [ site ] );
		draft.detailsByRuleKey[ getProtectedSiteRuleKey( site.rule ) ] = {
			displayName: '', schedule: null, behavior: 'pause', timingConfiguration: null,
		};
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ { identityHost: 'studio.youtube.com',
			rule: { host: 'youtube.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts' } } ] );
	} );

	it( 'retains a site policy when its editable details are absent', () => {
		const site = { identityHost: 'youtube.com', rule: { host: 'youtube.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/shorts', behavior: 'allow' as const },
		timingConfiguration: DefaultTimingConfiguration };
		const draft = createWebsiteDraft( [ site ] );
		draft.detailsByRuleKey = {};
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ site ] );
	} );
} );


describe( 'new website default exception drafts', () => {
	const root = { identityHost: 'youtube.com', rule: { host: 'youtube.com', includeSubdomains: true,
		scopeId: DefaultProtectionScopeId } };
	const studio = { identityHost: 'studio.youtube.com', rule: { host: 'studio.youtube.com', includeSubdomains: false,
		scopeId: DefaultProtectionScopeId, behavior: 'allow' as const } };

	it( 'shows Studio immediately while keeping staged root details and the saved baseline separate', () => {
		const baseline = createWebsiteDraft( [] );
		const details = { ...baseline.newSite, displayName: 'Videos', timingConfiguration: DefaultTimingConfiguration };
		const input = { ...baseline, address: 'www.youtube.com', newSite: details };
		const draft = stageWebsiteDraftSite( input, root );
		expect( draft.sites ).toEqual( [ root, studio ] );
		expect( draft.detailsByRuleKey[ getProtectedSiteRuleKey( root.rule ) ] ).toEqual( details );
		expect( draft.detailsByRuleKey[ getProtectedSiteRuleKey( studio.rule ) ] ).toEqual( {
			displayName: '', schedule: null, timingConfiguration: null, behavior: 'allow',
		} );
		expect( serializeWebsiteDraft( draft ) ).toEqual( [
			{ ...root, displayNameOverride: 'Videos', timingConfiguration: DefaultTimingConfiguration }, studio,
		] );
		expect( draft.address ).toBe( '' );
		expect( draft.newSite ).toEqual( baseline.newSite );
		expect( baseline.sites ).toEqual( [] );
		expect( input.address ).toBe( 'www.youtube.com' );
	} );

	it( 'discards the root and its seeded exception together without changing saved rules', () => {
		const baseline = createWebsiteDraft( [] );
		const controller = createDraft( baseline );
		controller.change( stageWebsiteDraftSite( controller.snapshot.value, root ) );
		expect( controller.snapshot.value.sites ).toEqual( [ root, studio ] );
		expect( controller.snapshot.dirty ).toBe( true );
		controller.discard();
		expect( controller.snapshot.value ).toEqual( baseline );
		expect( controller.snapshot.dirty ).toBe( false );
	} );

	it( 'persists later Studio edits or removal exactly instead of reseeding during serialization', () => {
		const draft = stageWebsiteDraftSite( createWebsiteDraft( [] ), root );
		const key = getProtectedSiteRuleKey( studio.rule );
		draft.detailsByRuleKey[ key ] = { displayName: 'Work', behavior: 'pause', schedule: null,
			timingConfiguration: DefaultTimingConfiguration };
		expect( serializeWebsiteDraft( draft )[ 1 ] ).toEqual( { ...studio, displayNameOverride: 'Work',
			rule: { host: 'studio.youtube.com', includeSubdomains: false, scopeId: DefaultProtectionScopeId },
			timingConfiguration: DefaultTimingConfiguration } );
		draft.sites = [ root ];
		expect( serializeWebsiteDraft( draft ) ).toEqual( [ root ] );
		expect( createWebsiteDraft( [ root ] ).sites ).toEqual( [ root ] );
	} );
} );

describe( 'path-first website drafts', () => {
	it( 'stages an editable no-pause parent beside an ordinary paused path and discards both together', () => {
		const path = { identityHost: 'a.com', rule: { host: 'a.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/x' } };
		const parent = { identityHost: 'a.com', rule: { host: 'a.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, behavior: 'allow' as const } };
		const baseline = createWebsiteDraft( [] );
		const controller = createDraft( baseline );
		const staged = stageWebsiteDraftSite( baseline, path );
		expect( staged.sites ).toEqual( [ path, parent ] );
		expect( staged.detailsByRuleKey[ getProtectedSiteRuleKey( path.rule ) ]?.behavior ).toBe( 'pause' );
		expect( staged.detailsByRuleKey[ getProtectedSiteRuleKey( parent.rule ) ]?.behavior ).toBe( 'allow' );
		expect( serializeWebsiteDraft( staged ) ).toEqual( [ path, parent ] );
		controller.change( staged );
		controller.discard();
		expect( controller.snapshot.value ).toEqual( baseline );
		expect( baseline.sites ).toEqual( [] );
	} );

	it.each( [
		{ originalBehavior: 'allow', pendingBehavior: 'pause', pathPrefix: undefined, createsParent: false },
		{ originalBehavior: 'pause', pendingBehavior: 'allow', pathPrefix: undefined, createsParent: true },
		{ originalBehavior: 'allow', pendingBehavior: 'pause', pathPrefix: '/inbox', createsParent: false },
		{ originalBehavior: 'pause', pendingBehavior: 'allow', pathPrefix: '/inbox', createsParent: true },
	] as const )( 'uses pending $pendingBehavior over stored $originalBehavior for ancestor $pathPrefix', ( {
		originalBehavior, pendingBehavior, pathPrefix, createsParent,
	} ) => {
		const ancestor = { identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId, behavior: originalBehavior,
			...( pathPrefix === undefined ? {} : { pathPrefix } ) } };
		const path = { identityHost: 'work.example.com', rule: { host: 'work.example.com', includeSubdomains: false,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/x' } };
		const draft = createWebsiteDraft( [ ancestor ] );
		const key = getProtectedSiteRuleKey( ancestor.rule );
		const incompleteSchedule = { mode: ScheduleMode.CUSTOM,
			windows: [ { id: 0, weekday: Weekday.MONDAY, start: '', end: '', fullDay: false } ] };
		const details = { displayName: 'Pending policy', schedule: incompleteSchedule,
			timingConfiguration: DefaultTimingConfiguration, behavior: pendingBehavior };
		draft.detailsByRuleKey[ key ] = details;
		draft.newSite = { ...draft.newSite, schedule: incompleteSchedule };
		const staged = stageWebsiteDraftSite( draft, path );
		expect( staged.sites ).toEqual( createsParent ? [ ancestor, path, {
			identityHost: 'work.example.com', rule: { host: 'work.example.com', includeSubdomains: false,
				scopeId: DefaultProtectionScopeId, behavior: 'allow' },
		} ] : [ ancestor, path ] );
		expect( staged.sites[ 0 ] ).toBe( ancestor );
		expect( staged.detailsByRuleKey[ key ] ).toBe( details );
		expect( staged.detailsByRuleKey[ getProtectedSiteRuleKey( path.rule ) ]?.schedule ).toBe( incompleteSchedule );
		expect( draft.sites ).toEqual( [ ancestor ] );
		expect( ancestor.rule.behavior ).toBe( originalBehavior );
	} );

	it( 'uses the saved ancestor policy when pending details are absent', () => {
		const ancestor = { identityHost: 'example.com', rule: { host: 'example.com', includeSubdomains: true,
			scopeId: DefaultProtectionScopeId } };
		const path = { identityHost: 'work.example.com', rule: { host: 'work.example.com', includeSubdomains: false,
			scopeId: DefaultProtectionScopeId, pathPrefix: '/x' } };
		const draft = createWebsiteDraft( [ ancestor ] );
		draft.detailsByRuleKey = {};
		expect( stageWebsiteDraftSite( draft, path ).sites ).toEqual( [ ancestor, path ] );
	} );
} );
