import type { ComponentInterruptionScreen } from '..';
import type { ComponentProtectedPageLayer } from '../../protected-page-layer';
import type { ManualInterruptionScreenEnvironment } from './types';
import type { InterruptionScreenState } from '../types';
import type { ThemeMode, Palette } from '../../../../../domains/preferences/types';

declare global {
	/** Browser contract fixture controls, absent from production entrypoints. */
	interface Window {
		pauseFixture: {
			states: typeof InterruptionScreenState;
			themes: typeof ThemeMode;
			palettes: typeof Palette;
			screen: ComponentInterruptionScreen;
			layer: ComponentProtectedPageLayer | null;
			environment: ManualInterruptionScreenEnvironment;
			continues: number;
			retries: number;
		};
	}
}
