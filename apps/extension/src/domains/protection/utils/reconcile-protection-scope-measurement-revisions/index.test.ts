import { describe, expect, it, vi } from 'vitest';
import {
	ProtectionScopeMeasurementRevisionMapSchema,
	type ProtectedSiteConfigurationSet,
} from '../../types/protected-site-configuration';
import { DefaultProtectionScopeId, ProtectionScopeIdSchema } from '../../types/protection-value';
import {
	reconcileProtectionScopeMeasurementRevisions,
	retainActiveProtectionScopeMeasurementRevisions,
} from './index';

/**
 * Independent scope used by measurement-revision tests.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SCOPE_ID = ProtectionScopeIdSchema.parse( 'scope_independent' );

/**
 * Independent site used by measurement-revision tests.
 * @since 0.1.0 Initial implementation.
 */
const INDEPENDENT_SITE: ProtectedSiteConfigurationSet[ number ] = {
	identityHost: 'youtube.com',
	rule: {
		host: 'youtube.com',
		includeSubdomains: true,
		scopeId: INDEPENDENT_SCOPE_ID,
	},
};

/**
 * Current revisions containing active and inactive scopes.
 * @since 0.1.0 Initial implementation.
 */
const CURRENT_REVISIONS = ProtectionScopeMeasurementRevisionMapSchema.parse( {
	[ DefaultProtectionScopeId ]: 'revision_default',
	[ INDEPENDENT_SCOPE_ID ]: 'revision_independent',
	scope_inactive: 'revision_inactive',
} );

/**
 * Current default-scope revision used by retention tests.
 * @since 0.1.0 Initial implementation.
 */
const DEFAULT_REVISION = ProtectionScopeMeasurementRevisionMapSchema.parse( {
	[ DefaultProtectionScopeId ]: 'revision_default_current',
} );

/**
 * Creates an intentionally invalid measurement revision.
 * @return Invalid revision containing spaces.
 * @since 0.1.0 Initial implementation.
 */
function createInvalidMeasurementRevision(): string {
	return 'not a valid revision';
}

/**
 * Reuses the current default-scope revision.
 * @return Current revision instead of a fresh value.
 * @since 0.1.0 Initial implementation.
 */
function reuseCurrentMeasurementRevision(): string {
	return 'revision_default_current';
}

/**
 * Reuses one generated revision across active scopes.
 * @return Colliding generated revision.
 * @since 0.1.0 Initial implementation.
 */
function createCollidingMeasurementRevision(): string {
	return 'revision_collision';
}

describe( 'reconcileProtectionScopeMeasurementRevisions', () => {
	it( 'retains only revisions belonging to projected active scopes', () => {
		expect( retainActiveProtectionScopeMeasurementRevisions(
			[],
			CURRENT_REVISIONS,
		) ).toEqual( {
			[ DefaultProtectionScopeId ]: 'revision_default',
		} );
	} );

	it( 'preserves active revisions and removes revisions for inactive scopes', () => {
		const createMeasurementRevision = vi.fn();

		expect( reconcileProtectionScopeMeasurementRevisions( {
			sites: [ INDEPENDENT_SITE ],
			currentRevisionsByScope: CURRENT_REVISIONS,
			rotatedScopeIds: new Set(),
			createMeasurementRevision,
		} ) ).toEqual( {
			[ DefaultProtectionScopeId ]: 'revision_default',
			[ INDEPENDENT_SCOPE_ID ]: 'revision_independent',
		} );
		expect( createMeasurementRevision ).not.toHaveBeenCalled();
	} );

	it( 'rotates requested active scopes and creates revisions for newly active scopes', () => {
		const createMeasurementRevision = vi.fn()
			.mockReturnValueOnce( 'revision_default_next' )
			.mockReturnValueOnce( 'revision_independent_next' );

		expect( reconcileProtectionScopeMeasurementRevisions( {
			sites: [ INDEPENDENT_SITE ],
			currentRevisionsByScope: DEFAULT_REVISION,
			rotatedScopeIds: new Set( [ DefaultProtectionScopeId ] ),
			createMeasurementRevision,
		} ) ).toEqual( {
			[ DefaultProtectionScopeId ]: 'revision_default_next',
			[ INDEPENDENT_SCOPE_ID ]: 'revision_independent_next',
		} );
		expect( createMeasurementRevision ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'creates the default scope revision when no current revision exists', () => {
		const createMeasurementRevision = vi.fn().mockReturnValue( 'revision_default' );

		expect( reconcileProtectionScopeMeasurementRevisions( {
			sites: [],
			currentRevisionsByScope: {},
			rotatedScopeIds: new Set(),
			createMeasurementRevision,
		} ) ).toEqual( {
			[ DefaultProtectionScopeId ]: 'revision_default',
		} );
		expect( createMeasurementRevision ).toHaveBeenCalledOnce();
	} );

	it.each( [ '__proto__', 'constructor', 'toString', 'hasOwnProperty' ] )(
		'creates a fresh revision for a newly referenced prototype-named scope %s',
		( rawScopeId ) => {
			const scopeId = ProtectionScopeIdSchema.parse( rawScopeId );
			const createMeasurementRevision = vi.fn().mockReturnValue( 'revision_prototype' );
			const revisionsByScope = reconcileProtectionScopeMeasurementRevisions( {
				sites: [ {
					identityHost: 'youtube.com',
					rule: {
						host: 'youtube.com',
						includeSubdomains: true,
						scopeId,
					},
				} ],
				currentRevisionsByScope: DEFAULT_REVISION,
				rotatedScopeIds: new Set(),
				createMeasurementRevision,
			} );

			expect( revisionsByScope ).toEqual( {
				[ DefaultProtectionScopeId ]: 'revision_default_current',
				[ scopeId ]: 'revision_prototype',
			} );
			expect( Object.hasOwn( revisionsByScope ?? {}, scopeId ) ).toBe( true );
			expect( createMeasurementRevision ).toHaveBeenCalledOnce();
		},
	);

	it( 'returns null when the revision factory returns an invalid value', () => {
		expect( reconcileProtectionScopeMeasurementRevisions( {
			sites: [],
			currentRevisionsByScope: DEFAULT_REVISION,
			rotatedScopeIds: new Set( [ DefaultProtectionScopeId ] ),
			createMeasurementRevision: createInvalidMeasurementRevision,
		} ) ).toBeNull();
	} );

	it( 'returns null when a rotated revision reuses a current value', () => {
		expect( reconcileProtectionScopeMeasurementRevisions( {
			sites: [],
			currentRevisionsByScope: DEFAULT_REVISION,
			rotatedScopeIds: new Set( [ DefaultProtectionScopeId ] ),
			createMeasurementRevision: reuseCurrentMeasurementRevision,
		} ) ).toBeNull();
	} );

	it( 'returns null when newly created revisions collide', () => {
		expect( reconcileProtectionScopeMeasurementRevisions( {
			sites: [ INDEPENDENT_SITE ],
			currentRevisionsByScope: {},
			rotatedScopeIds: new Set(),
			createMeasurementRevision: createCollidingMeasurementRevision,
		} ) ).toBeNull();
	} );

	it( 'throws when a projected active scope has no source revision', () => {
		expect( () => retainActiveProtectionScopeMeasurementRevisions(
			[ INDEPENDENT_SITE ],
			DEFAULT_REVISION,
		) ).toThrow();
	} );
} );
