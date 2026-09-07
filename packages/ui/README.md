# Shared UI

`@tocus/ui` directly re-exports Mantine 9.6 components and types. It owns the brand theme, provider integration and layout classes, not local implementations of controls.

```tsx
import { Button, Slider, TocusAppearance, TocusPalette, TocusProvider } from '@tocus/ui';
import '@tocus/ui/styles.scss';

<TocusProvider appearance={TocusAppearance.SYSTEM} palette={TocusPalette.BROWN}>
  <Slider name="wait" thumbLabel="Initial wait" min={10} max={30} step={5} />
  <Button type="submit">Save</Button>
  <Button variant="outline">Discard</Button>
  <Button color="red">Delete</Button>
</TocusProvider>
```

Providers default to system appearance, brown palette and 115% scale. `compact` uses 100%; `scale` explicitly overrides either value. Palettes are brown, green, blue, purple, pink and orange. `reducedMotion` optionally overrides the system preference. Consumers own preference persistence; the provider never reads or writes localStorage.

Use `transparent` when mounting a component into an existing surface rather than rendering a page surface. This changes only the provider wrapper background, not control surfaces or theme tokens.

Use `Alert color="green"` for success, `color="red"` for errors and `color="yellow"` for warnings. Static information belongs in `tocus-info`. Outline buttons use transparent surfaces and action-colored outlines; default buttons are neutral. Filled buttons are primary except `color="red"`, which is destructive. Disabled actions preserve their variant at 60% opacity through Mantine's public button variables. `Brand` renders the local mascot and wordmark. Brand and Icon accept an optional composition class.

`Brand` defaults to `BrandSize.STANDARD` (32px mascot). Use `BrandSize.LARGE` for the original onboarding wordmark (40px mascot), `BrandSize.HERO` for the About header (48px mascot), or `BrandSize.MINIATURE` for appearance preview artwork. The shared theme preserves pill actions, soft capsule navigation, and the original 600-weight brand headings. Geometry tokens retain their 16px unit; typography tokens already include the 115% adjustment and must not be scaled again.

Use `tocus-choice-card` on Mantine `Radio.Card` for shared selected, hover, focus and disabled states. Palette cards also use `tocus-choice-swatch` on the 44px control, with a nested `tocus-choice-clay` artwork element; this preserves a generous hit area around the compact swatch. The shared clay artwork owns its inset highlight, depth and selected double ring. `tocus-choice-preview` applies frame selection to a nested `tocus-choice-frame` while leaving the label outside the frame. Set `--tocus-choice-background` to preserve each palette's identity color.

Actions may use the shared `tocus-action-raised` or `tocus-action-soft` elevation treatments. These modifiers own their shadows and corresponding focus offset; application styles should only position and size the control. Use Mantine's sizing props for action height and padding instead of redefining control-state styles.

For original native radio rows, use `Radio` with `className="tocus-choice-card tocus-choice-radio"`, `label` and optional `description`. The input remains the keyboard and pointer control, while its associated label covers the row. `tocus-choice-row` and `tocus-choice-copy` provide the corresponding composition for cards that need separate contents. Footer navigation anchors use `tocus-navigation-link`.

For the original Timing ranges, use the directly exported Mantine `Input type="range"` with `className="tocus-native-range"` and a percentage-valued `--tocus-range-fill`. The modifier supplies the original native track/thumb appearance, disabled treatment and focus ring; the browser retains keyboard and range semantics. Set native bounds, an associated label, help text and localized `aria-valuetext`. The wrapper has no layout box, preserving the original inline native input baseline. This is not a local input implementation; the general Mantine `Slider` remains available for consumers that need its API.

Use `tocus-native-field` only for an original native field whose unpositioned wrapper is part of its paint contract, such as the rectangular Settings address, display-name and time fields. Other inputs retain Mantine's default positioned wrapper. The modifier inspects the public `section` and `bottomSection` Styles API slots, so fields with real adornments retain their containing block even when the modifier is present. It does not depend on internal component props or apply to the capsule-shaped Onboarding address field.

Use `tocus-native-button` for an original text-only native action whose flat layout is part of its paint contract, such as Onboarding's Add site action. The direct Mantine Button retains its native semantics, focus and variant states; the modifier restores an unpositioned flex root and flattens its public `inner` and `label` layout slots. Buttons with sections or an active loader retain Mantine's default layout. This explicit treatment avoids changing unrelated controls or duplicating a button implementation.

Alerts retain the original icon geometry: a 1.25em square with a 0.125em top margin. `tocus-notice-compact` uses body-small text and scales the icon with it. `tocus-notice-recovery` removes the icon's end margin when a recovery layout supplies its own gap.

Use the `IconName` const catalog for icons, for example `<Icon name={IconName.HEART} />`. Names describe the supplied shapes, never an application destination or feedback meaning: `HEART`, `PALETTE`, `ARROW_UP_RIGHT_FROM_SQUARE`, `LETTERS`, `SHIELD_HALVED`, `USER_LOCK`, `CALENDAR_CLOCK`, `GEAR`, `LIST`, `CHART_COLUMN`, `STOPWATCH`, `CIRCLE_CHECK` and `EXCLAMATION`. The artwork is unchanged and lives under matching shape-based filenames in `@tocus/theme/icons`.

`IconName.CAPYBARA` reuses the existing mascot artwork from `@tocus/theme/icon.svg`; it does not introduce a duplicate asset. The `tocus-native-checkbox` modifier restores original native checkbox artwork while retaining Mantine's labelled input and form handling.

`IconName`, `TocusAppearance` and `TocusPalette` each expose one runtime const object and its inferred type from canonical `src/types.ts`. Use their constants in production and tests rather than repeating raw values. Node-based tests and tooling can import the catalogs from `@tocus/ui/types` without loading React components or SVG assets.

Shared layout classes are `tocus-page`, `tocus-page-header`, `tocus-section`, `tocus-form-actions`, `tocus-info` and `tocus-external-link`. App styles should compose pages and sections without restyling foundation states.

For injected integration, pass the compiled `@tocus/ui/styles.scss?inline` string to `createShadowStyleSheet`, adopt the returned sheet inside the owned shadow root, and pass that root as `shadowRoot`. This option uses Mantine's public variable resolver/converter to adopt generated theme variables too, so strict host CSP does not block a generated style tag. It adds and removes only its own generated stylesheet.

Shadow integration resolves packaged and generated CSS `rem` lengths against a fixed 16px baseline, retaining the default 1.15 scale. It also normalizes Mantine's initial and subsequently updated inline lengths through CSSOM inside that provider's subtree. Host font changes therefore require no compensation, global mutations, resize listeners or polling. URLs, quoted content, other units and normal-page styles remain unchanged. Do not pre-compensate `scale` for the host font. The injected integration still supplies its existing local font loader.

Pass owned `root`/`portalTarget` elements when attribute or portal ownership is needed; their previous attributes restore and their provider-owned portal mount is removed on unmount. A portal target also works without a separate root. In shadow mode, portal targets must stay within the same provider-owned shadow subtree for its dimension and stylesheet isolation contract to apply.

The production injected pause retains its native dialog and closed-root boundary. Do not add nested Mantine modals or dropdowns there: the previous compatibility investigation identified closed-root focus/event limits. The fixture here verifies standalone dialogs, not nested closed-root dialogs or every exported Mantine component. Providers and consumers in Astro must share one React island.

Browser verification: `pnpm --filter @tocus/ui test:browser`. The fixture starts its own Vite server and runs actual Chromium, Firefox and WebKit. Package validation also includes `typecheck`, repository ESLint and Stylelint. Generated screenshots are under the ignored `test-results` directory.
