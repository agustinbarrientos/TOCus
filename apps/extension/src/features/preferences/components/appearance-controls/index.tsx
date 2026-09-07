import {
	Brand,
	BrandSize,
	Radio,
	Stack,
	Group,
	VisuallyHidden,
} from '@tocus/ui';
import {
	Palette,
	PaletteSchema,
	ThemeMode,
	ThemeModeSchema,
} from '../../../../domains/preferences/types';
import type {
	AppearanceControlsProps,
} from './types';
import './style.scss';


/**
 * Shares the approved miniature theme previews and compact palette swatches.
 * @param props - Controlled appearance choices and canonical localized labels.
 * @return Theme and palette controls for one owned form.
 * @since 0.1.0
 */
export function AppearanceControls( props: AppearanceControlsProps ) {
	const { copy, theme, palette, disabled = false } = props;
	return <Stack gap="xl" className="preferences-appearance-controls">
		<Radio.Group label={ copy.themeLegend } value={ theme } name="theme"
			classNames={ { label: 'preferences-section-label' } }
			onChange={ ( value ) => {
				props.onChange( { theme: ThemeModeSchema.parse( value ) } );
			} }>
			<div className="preferences-theme-options">
				{ [ ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM ].map( ( option ) =>
					<Radio.Card key={ option } value={ option } disabled={ disabled }
						aria-label={ copy.themeOptions[ option ].label }
						aria-describedby={ `theme-description-${ option }` }
						className="tocus-choice-card tocus-choice-preview preferences-theme-card">
						<div className="tocus-choice-frame preferences-theme-frame">
							<div className="preferences-theme-preview" data-preview-theme={ option } aria-hidden="true">
								<Brand size={ BrandSize.MINIATURE } />
								{ ( option === ThemeMode.SYSTEM ? [ ThemeMode.DARK, ThemeMode.LIGHT ] : [ option ] )
									.map( ( pane ) => <div key={ pane } className="preferences-preview-lines" data-preview-theme={ pane }>
										<span /><span />
									</div> ) }
							</div>
							<Radio.Indicator className="tocus-selection-mark preferences-choice-indicator" />
						</div>
						<strong>{ copy.themeOptions[ option ].label }</strong>
						<VisuallyHidden id={ `theme-description-${ option }` }>
							{ copy.themeOptions[ option ].description }
						</VisuallyHidden>
					</Radio.Card>
				) }
			</div>
		</Radio.Group>
		<Radio.Group label={ copy.paletteLegend } description={ copy.paletteHelp } value={ palette } name="palette"
			classNames={ { label: 'preferences-section-label', description: 'preferences-section-description' } }
			onChange={ ( value ) => {
				props.onChange( { palette: PaletteSchema.parse( value ) } );
			} }>
			<Group className="preferences-palette-options">
				{ Object.values( Palette ).map( ( option ) =>
					<Radio.Card key={ option } value={ option } disabled={ disabled }
						aria-label={ copy.paletteLabels[ option ] } title={ copy.paletteLabels[ option ] }
						className="tocus-choice-card tocus-choice-swatch preferences-palette-card" data-palette={ option }>
						<span className="tocus-choice-clay preferences-palette-swatch">
							<Radio.Indicator className="tocus-selection-mark preferences-palette-indicator" />
						</span>
						<VisuallyHidden className="preferences-palette-label">{ copy.paletteLabels[ option ] }</VisuallyHidden>
					</Radio.Card>
				) }
			</Group>
		</Radio.Group>
	</Stack>;
}
