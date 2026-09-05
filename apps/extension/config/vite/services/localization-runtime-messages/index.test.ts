import { describe, expect, it, vi } from 'vitest';
import {
	createLocalizationRuntimeMessagesPlugin,
	loadLocalizationRuntimeModule,
	ProtectedPageLocalizationModuleId,
	resolveLocalizationRuntimeModuleId,
	ToolbarLocalizationModuleId,
} from './index.ts';

describe( 'createLocalizationRuntimeMessagesPlugin', () => {
	it( 'resolves and loads both runtime localization modules', async () => {
		const createRuntimeMessages = vi.fn().mockResolvedValue( {} );
		const plugin = createLocalizationRuntimeMessagesPlugin( { createRuntimeMessages } );
		const toolbarId = resolveLocalizationRuntimeModuleId( ToolbarLocalizationModuleId );
		const protectedPageId = resolveLocalizationRuntimeModuleId( ProtectedPageLocalizationModuleId );

		expect( plugin.name ).toBe( 'tocus-localization-runtime-messages' );
		expect( toolbarId ).toBe( `\0${ ToolbarLocalizationModuleId }` );
		expect( protectedPageId ).toBe( `\0${ ProtectedPageLocalizationModuleId }` );
		expect( resolveLocalizationRuntimeModuleId( 'unrelated' ) ).toBeNull();
		expect( await plugin.load( toolbarId ?? '' ) ).toContain( 'messagesByLanguage' );
		expect( await loadLocalizationRuntimeModule( protectedPageId ?? '', { createRuntimeMessages } ) ).toContain( 'messagesByLanguage' );
		expect( await loadLocalizationRuntimeModule( 'unrelated', { createRuntimeMessages } ) ).toBeNull();
		expect( createRuntimeMessages ).toHaveBeenCalledTimes( 2 );
	} );
} );
