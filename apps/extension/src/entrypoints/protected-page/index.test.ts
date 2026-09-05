import { describe, expect, it, vi } from 'vitest';

const bootstrapMocks = vi.hoisted( () => {
	/**
	 * Returns one unlisted-script definition without changing it.
	 * @param definition - Unlisted-script definition under test.
	 * @return Original unlisted-script definition.
	 * @since 0.1.0 Initial implementation.
	 */
	function defineUnlistedScript<Definition>( definition: Definition ): Definition {
		return definition;
	}

	return {
		defineUnlistedScript: vi.fn( defineUnlistedScript ),
		mountProtectedPageLayer: vi.fn().mockResolvedValue( undefined ),
	};
} );

vi.mock( 'wxt/utils/define-unlisted-script', () => ( {
	defineUnlistedScript: bootstrapMocks.defineUnlistedScript,
} ) );
vi.mock( '../../features/interruption/services/protected-page', () => ( {
	mountProtectedPageLayer: bootstrapMocks.mountProtectedPageLayer,
} ) );

describe( 'protected-page entrypoint', () => {
	it( 'defines the unlisted script with the protected-page service', async () => {
		const entrypoint = await import( './index' );

		expect( entrypoint.default ).toEqual( {
			main: bootstrapMocks.mountProtectedPageLayer,
		} );
	} );
} );
