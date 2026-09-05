import { describe, expect, it, vi } from 'vitest';

const bootstrapMocks = vi.hoisted( () => ( {
	bootstrapPopupPage: vi.fn().mockResolvedValue( undefined ),
} ) );

vi.mock( '@tocus/theme/index.scss', () => ( {} ) );
vi.mock( './styles.scss', () => ( {} ) );
vi.mock( '../../features/popup/services/popup-page', () => ( {
	bootstrapPopupPage: bootstrapMocks.bootstrapPopupPage,
} ) );

describe( 'popup entrypoint', () => {
	it( 'starts the popup page service', async () => {
		await import( './index' );

		expect( bootstrapMocks.bootstrapPopupPage ).toHaveBeenCalledOnce();
	} );
} );
