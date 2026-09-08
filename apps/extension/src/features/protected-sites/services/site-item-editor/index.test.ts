import { describe, expect, it, vi } from 'vitest';
import { createProtectionConfigurationEditor } from '../../../../domains/protection/services/protection-configuration-editor';
import { DefaultProtectionScopeId } from '../../../../domains/protection/types/protection-value';
import { TestEmptyProtectionConfiguration } from '../../../../domains/protection/types/__fixtures__';
import type { ProtectedSiteConfiguration } from '../../../../domains/protection/types/protected-site-configuration';
import { ProtectedSiteItemOperationErrorReason } from '../../components/site-item/types';
import { createSiteItemEditor } from './index';
import type { ProtectionConfigurationStorageService } from '../../../../domains/protection/services/protection-configuration-storage';

/**
 * Supplies deterministic mutation coordination and identifiers to the real domain editor.
 * @param storage - Isolated persistence boundary for one test.
 * @return Production editor with no browser or shared storage dependencies.
 */
function domainEditor( storage: ProtectionConfigurationStorageService ) {
	let revision = 0;
	return createProtectionConfigurationEditor( { storage,
		/**
		 * Supplies a valid deterministic independent identifier.
		 * @return Unused scope identifier for this isolated storage.
		 */
		createIndependentScopeId: () => 'scope_item_test',
		/**
		 * Gives every affected measurement contract a distinct revision.
		 * @return Next deterministic revision identifier.
		 */
		createMeasurementRevision: () => `revision_item_test_${ String( ++revision ) }`,
		/**
		 * Runs this isolated test's mutation without introducing external coordination.
		 * @param mutation - Production editor transaction to execute.
		 * @return Original transaction result.
		 */
		coordinateMutation: ( mutation ) => mutation(),
	} );
}

const site: ProtectedSiteConfiguration = { identityHost: 'www.instagram.com',
	rule: { host: 'instagram.com', includeSubdomains: true, scopeId: DefaultProtectionScopeId } };

describe( 'item-owned editor compatibility', () => {
	it( 'retains the original missing-editor failure after a real save attempt', async () => {
		const onSaved = vi.fn();
		const editor = createSiteItemEditor( { site, editor: null, onSaved } );
		editor.open();
		await editor.save();
		expect( editor.getSnapshot() ).toMatchObject( { editing: true, saving: false,
			displayName: 'Instagram', error: ProtectedSiteItemOperationErrorReason.OPERATION } );
		expect( onSaved ).not.toHaveBeenCalled();
	} );

	it( 'persists through the real domain editor and publishes the resulting configuration', async () => {
		const save = vi.fn().mockResolvedValue( undefined );
		const onSaved = vi.fn();
		const editor = createSiteItemEditor( { site, onSaved, editor: domainEditor( {
			/**
			 * Loads the configured baseline for the successful atomic update.
			 * @return Configuration containing the exact editable identity.
			 */
			load: () => Promise.resolve( { ...TestEmptyProtectionConfiguration, sites: [ site ] } ), save,
		} ) } );
		editor.open();
		editor.change( 'My Instagram', false );
		await editor.save();
		expect( save ).toHaveBeenCalledOnce();
		expect( onSaved ).toHaveBeenCalledWith( expect.objectContaining( {
			sites: [ { ...site, displayNameOverride: 'My Instagram' } ],
		} ) );
		expect( editor.getSnapshot() ).toMatchObject( { editing: false, saving: false, error: null } );
	} );

	it( 'reports a rejected configuration without closing the draft', async () => {
		const editor = createSiteItemEditor( { site, onSaved: vi.fn(), editor: domainEditor( {
			/**
			 * Simulates an identity removed before this editor's authoritative read.
			 * @return Empty valid configuration.
			 */
			load: () => Promise.resolve( TestEmptyProtectionConfiguration ), save: vi.fn(),
		} ) } );
		editor.open();
		await editor.save();
		expect( editor.getSnapshot().error ).toBe( ProtectedSiteItemOperationErrorReason.CONFIGURATION_CHANGED );
		expect( editor.getSnapshot().editing ).toBe( true );
	} );

	it( 'retains a failed write and permits a clean cancel and reopen', async () => {
		const editor = createSiteItemEditor( { site, onSaved: vi.fn(), editor: domainEditor( {
			/**
			 * Loads a valid baseline before the deliberately rejected storage write.
			 * @return Configuration containing the editable identity.
			 */
			load: () => Promise.resolve( { ...TestEmptyProtectionConfiguration, sites: [ site ] } ),
			save: vi.fn().mockRejectedValue( new Error( 'Storage unavailable' ) ),
		} ) } );
		const listener = vi.fn();
		const unsubscribe = editor.subscribe( listener );
		editor.open();
		editor.change( 'Unsaved name', true );
		await editor.save();
		expect( editor.getSnapshot().error ).toBe( ProtectedSiteItemOperationErrorReason.OPERATION );
		editor.cancel();
		editor.open();
		expect( editor.getSnapshot() ).toMatchObject( { displayName: 'Instagram', independent: false, error: null } );
		expect( listener ).toHaveBeenCalled();
		unsubscribe();
		listener.mockClear();
		editor.cancel();
		expect( listener ).not.toHaveBeenCalled();
	} );

	it( 'ignores duplicate saves while the real storage write remains pending', async () => {
		const pending = Promise.withResolvers<undefined>();
		const save = vi.fn().mockReturnValue( pending.promise );
		const editor = createSiteItemEditor( { site: { ...site, displayNameOverride: 'Saved name' },
			onSaved: vi.fn(), editor: domainEditor( {
				/**
				 * Loads the baseline while the following storage write remains deferred.
				 * @return Configuration containing the exact editable identity.
				 */
				load: () => Promise.resolve( { ...TestEmptyProtectionConfiguration, sites: [ site ] } ), save,
			} ) } );
		editor.open();
		const first = editor.save();
		await editor.save();
		expect( editor.getSnapshot().saving ).toBe( true );
		pending.resolve( undefined );
		await first;
		expect( save ).toHaveBeenCalledOnce();
	} );
} );
