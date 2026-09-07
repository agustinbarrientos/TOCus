# TOCus shared theme

`@tocus/theme` owns brand assets, color palettes, typography, spacing and semantic design tokens. `@tocus/ui` configures Mantine with those tokens and supplies the same provider to the extension and website. Components import Mantine primitives through `@tocus/ui`; do not recreate inputs, buttons, sliders, dialogs or alerts in application folders.

## Ownership

- `packages/ui/src/theme.ts` owns library defaults and semantic variants, including complete foreground/background pairs for resting, hover and focus states.
- `packages/ui/src/styles.scss` owns shared layouts and cross-component interaction rules. Application SCSS owns only screen layout and unique branded artwork.
- `packages/ui/src/provider.tsx` owns theme context, portals and style targets. The injected pause keeps styles, overlays and generated variables inside its own Shadow DOM; it must never style the website underneath it.
- `tokens.scss`, `sizing.scss` and `typography/` remain framework-independent. `controls.scss` contains only the focus-ring mixin used by the native pause dialog, not another control library.

## Semantic distinctions

- Actions use Mantine `Button`: filled primary, outlined secondary and the shared danger variant for destructive actions.
- Form actions use the shared Save/Discard presentation and the same ordering, pending state and navigation guard.
- Notices use Mantine `Alert` with semantic color, an icon and meaningful text. Success uses a status announcement; errors use an alert announcement. Never style a notice like a selectable option.
- Options use library radio or checkbox semantics. The shared `tocus-choice-card` class gives neutral unselected borders and an accent border only when selected.
- Read-only summaries use text, headings and separators. They are not selection-shaped cards.
- All heading levels use the brand font. Links remain underlined and external links use the supplied external-link icon.

## Regression checks

`packages/ui/src/styles.test.ts` rejects copied action and notice styling in application stylesheets. `pnpm test:ui` runs real-browser checks in Chromium, Firefox and WebKit for control semantics, keyboard use, all twelve palette/appearance combinations, hover/focus contrast, forced colors, responsive layouts and isolated styling.

Extend the library theme or shared presentation when a reusable variant is needed. Do not patch one page with a second implementation of the same control.
