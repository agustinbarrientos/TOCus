import { describe, expect, it, vi } from 'vitest';

const bootstrapMocks = vi.hoisted( () => ( {
	bootstrapInterruptionPage: vi.fn().mockResolvedValue( undefined ),
} ) );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( '../../features/interruption/services/interruption-page', () => ( {
	bootstrapInterruptionPage: bootstrapMocks.bootstrapInterruptionPage,
} ) );

describe( 'interruption entrypoint', () => {
	it( 'starts the interruption page service', async () => {
		await import( './index' );

		expect( bootstrapMocks.bootstrapInterruptionPage ).toHaveBeenCalledOnce();
	} );
} );
