# TOCus shared theme

`@tocus/theme` owns brand assets, color palettes, typography, spacing and semantic design tokens. `@tocus/ui` configures Mantine with those tokens and supplies the same provider to the extension and website. Components import Mantine primitives through `@tocus/ui`; do not recreate inputs, buttons, sliders, dialogs or alerts in application folders.

## Ownership

- `src/styles/` owns emitted stylesheets and token tests; `src/utils/` owns Sass functions and mixins with their tests; `src/types/` owns runtime constants. Public package exports keep consumers independent of these internal paths. Assets stay in the single `assets/` directory.
- `packages/ui/src/utils/theme/index.ts` owns library defaults and semantic variants, including complete foreground/background pairs for resting, hover and focus states, the native-select `ANGLE_DOWN` artwork and the default `SPINNER_THIRD` loader.
- `packages/ui/src/components/provider/shared.scss` owns shared layouts and cross-component interaction rules, including native disclosure `ANGLE_DOWN`/`ANGLE_UP` states and loader sizing, rotation and reduced-motion handling. Application SCSS owns only screen layout and unique branded artwork.
- `packages/ui/src/components/provider/index.tsx` owns theme context, portals and style targets. The injected pause keeps styles, overlays and generated variables inside its own Shadow DOM; it must never style the website underneath it.
- `src/styles/tokens/`, `src/utils/sizing/` and `src/utils/typography/` remain framework-independent. `src/utils/controls/index.scss` contains only the focus-ring mixin used by the native pause dialog, not another control library.

## Semantic distinctions

- Actions use Mantine `Button`: filled primary, outlined secondary and the shared danger variant for destructive actions.
- Form actions use the shared Save/Discard presentation and the same ordering, pending state and navigation guard.
- Notices use Mantine `Alert` with semantic color, an icon and meaningful text. Success uses a status announcement; errors use an alert announcement. Never style a notice like a selectable option.
- Options use library radio or checkbox semantics. The shared `tocus-choice-card` class gives neutral unselected borders and an accent border only when selected.
- Read-only summaries use text, headings and separators. They are not selection-shaped cards.
- All heading levels use the brand font. Links remain underlined and external links use the supplied external-link icon.

## Icon assets and licenses

`assets/icons/` stores the supplied SVG artwork consumed through `@tocus/ui`'s shape-based `IconName` catalog. See the [shared UI icon documentation](../ui/README.md) for names and control usage. The brand mascot remains in `assets/icon.svg`.

The 15 supplied replacement and control SVGs carry Font Awesome Pro v7.3.1 commercial-license notices and Fonticons, Inc. copyright notices. `circle-check.svg` retains its Font Awesome Free notice. These third-party asset notices are separate from the project's MIT license; preserve them when editing or distributing the SVGs. This repository does not include the Font Awesome Pro license agreement or document permission to redistribute the raw assets.

## Regression checks

`packages/ui/src/components/provider/style.test.ts` rejects copied action and notice styling in application stylesheets. `pnpm test:ui` runs real-browser checks in Chromium, Firefox and WebKit for control semantics, keyboard use, all twelve palette/appearance combinations, hover/focus contrast, forced colors, responsive layouts and isolated styling.

Extend the library theme or shared presentation when a reusable variant is needed. Do not patch one page with a second implementation of the same control.
