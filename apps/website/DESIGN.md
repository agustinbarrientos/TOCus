---
name: TOCus website
description: A calm clay product world built from the shared TOCus theme and real extension components.
colors:
  action: "#744331"
  on-action: "#fff8f0"
  surface: "#fffdf9"
  on-surface: "#3c281f"
  on-surface-muted: "#6a554a"
  surface-container: "#f1e4d9"
  stage-start: "#fff8f0"
  stage-middle: "#f3e4d5"
  stage-end: "#d8ad8a"
  on-stage-muted: "#584035"
  breathing-sphere: "#b86f46"
  breathing-sphere-highlight: "#e9b47f"
  breathing-sphere-shadow: "#7a4634"
typography:
  display-hero:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(3rem, 5.6vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  display-section:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(2.3rem, 4.2vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline-large:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "2.3rem"
    fontWeight: 600
    lineHeight: "2.875rem"
    letterSpacing: "0"
  headline-medium:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "2.0125rem"
    fontWeight: 600
    lineHeight: "2.5875rem"
    letterSpacing: "0"
  headline-small:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "1.725rem"
    fontWeight: 600
    lineHeight: "2.3rem"
    letterSpacing: "0"
  title-large:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "1.58125rem"
    fontWeight: 600
    lineHeight: "2.0125rem"
    letterSpacing: "0"
  body-large:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.15rem"
    fontWeight: 400
    lineHeight: "1.725rem"
    letterSpacing: "0.0359375rem"
  body-medium:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.00625rem"
    fontWeight: 400
    lineHeight: "1.4375rem"
    letterSpacing: "0.01796875rem"
  body-small:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.8625rem"
    fontWeight: 400
    lineHeight: "1.15rem"
    letterSpacing: "0.02875rem"
  label-large:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.00625rem"
    fontWeight: 500
    lineHeight: "1.4375rem"
    letterSpacing: "0.0071875rem"
  label-medium:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.8625rem"
    fontWeight: 500
    lineHeight: "1.15rem"
    letterSpacing: "0.0359375rem"
rounded:
  small: "0.75rem"
  medium: "1.25rem"
  large: "2rem"
  full: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  "7": "3rem"
  website-section: "clamp(3.5rem, 7vw, 6rem)"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.action}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-subtle:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-light:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-large}"
    rounded: "{rounded.full}"
    padding: "0 1.5rem"
    height: "2.75rem"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-medium}"
    rounded: "{rounded.small}"
    height: "3rem"
  header-navigation:
    textColor: "{colors.action}"
    typography: "{typography.label-large}"
  badge:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-muted}"
    typography: "{typography.label-medium}"
    padding: "0.25rem 0.75rem"
  statistics-metric:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.medium}"
    padding: "1.5rem"
---

# Design System: TOCus website

## Approved homepage implementation — September 7, 2026

The user approved the desktop and mobile visual concepts in this task. The previous
split hero and long side-by-side story are superseded. This section is the current
implementation plan and progress record; no separate artifact directory is needed.

**Goal:** Build the approved light homepage around a large peeking raster capybara
and one stable browser that tells the complete product story as the visitor scrolls.

**Architecture:** Astro renders useful localized HTML; React and the existing
Mantine/shared TOCus components enhance it. Native CSS sticky positioning owns
the browser geometry. Native scroll observation drives chapter progress; GSAP
drives only decorative transforms and fades.
The real breathing renderer and statistics component remain read-only consumers.

**Constraints:** Website files only. Do not modify the extension or shared theme.
Keep all ten locales, local assets, author UTM links and favicon, accessible controls,
direct browser-specific download links, and existing visual baseline paths/names.
No homepage GLB, new component library, scroll hijacking, inert settings form, or
repository artifact folders. Original model assets remain available in their lab.
No commits or publishing are part of this approval.

### Task 1 — Approved image and page composition

Files: `src/components/home-page/page.tsx`, `src/styles/global.scss`,
`src/components/mascot/*`, `public/images/mascot-peek.webp`,
`src/components/download-links/*`, `tests/build/homepage-mascot.test.ts`.

- [x] Add a browser test that rejects homepage model requests and verifies a decoded,
  prominent raster mascot on desktop and mobile; observe failure on the current build.
- [x] Prepare the approved peeking character, without changing its identity. Keep
  generated experiments outside the repository and place only the selected asset here.
- [x] Replace the split hero with centered literal copy, direct store CTA, and large
  character whose paws meet the single browser frame below it.
- [x] Build concise timing cause/effect, actual example statistics, typographic privacy,
  creator/source, repeat CTA, and compact language-menu sections using shared controls.
- [x] Verify light rendering, desktop/mobile geometry, keyboard operation and no overflow.

### Task 2 — Stable scroll narrative

Files: `src/services/story-motion/*`, `tests/build/story-motion.test.ts`.
Interface: preserve `createStoryMotion(root, onChapterChange, onProgressChange)`.
The root contains `.story-layout`, a sticky `.experience-stage`, and five compact
`[data-story-chapter]` items with native buttons in `DemoChapter` order. The service
must not derive progress from chapter list heights. Set `data-story-active` on the
root once the browser enters its sticky reading position; remove it before then.

- [x] Test natural wheel traversal/reversal, unchanged frame width/position at rest,
  one visible caption, clickable/keyboard chapters and readable small viewports.
- [x] Map the stable story scroll interval to choose → visit → pause → Continue → browse.
  Bound its desktop scroll distance to roughly three viewports, not five long lists.
- [x] Keep reduced-motion navigation immediate and disable decorative transforms.
  Skip updates outside the story; clean up observers/listeners on unmount.
- [x] Run real Chromium, Firefox and WebKit tests after the integrated build.

### Task 3 — Concise localized narrative

Files: `src/localization/*`, `locales/*.po` (website only).

- [x] Update hero to “Pause before you scroll.” and “TOCus adds a breathing pause to
  the websites you choose.” Keep brief chapter rail labels separate from full captions.
- [x] Add timing-diagram labels and privacy facts. Clearly label example statistics;
  never imply actual visitor data or measured savings. Browsing starts on Continue.
- [x] Translate the affected website copy in all ten locales and run localization tests.

### Task 4 — Visual and interaction verification

- [x] Build with `pnpm --filter @tocus/website build` and run website build-contract tests.
- [x] Run website lint, style lint and typecheck. Resolve failures rather than weakening checks.
- [x] Inspect actual desktop and mobile browser screenshots against the approved concepts.
  Capture temporary review images only outside the repository; update approved website
  baselines in their original locations, never extension baselines.
- [x] Have an independent reviewer check the changed website files and interactions.
- [x] Confirm this redesign made no extension source or extension visual-baseline edits;
  refresh the website output used by the local preview.

**Review outcomes:** Resolved the first-chapter mascot/caption collision, the missing
no-JavaScript explanation, and the compact-screen chapter rail overflow. All five
static explanations remain readable without JavaScript. At 1280×720, the compact
desktop hero keeps the browser edge in the first viewport. Independent review closed
without remaining findings. The selected raster is encoded as a 175 KB WebP; the
generation prompt and provenance are stored beside it. No repository artifact folder
was created. Existing extension build output was not used as a source-change check.

**Final verification:** 49/49 website build-contract tests passed across Chromium,
Firefox and WebKit on the frozen final build (179.95 seconds). Website unit tests:
35/35. Visual comparisons: 20/20 at zero allowed pixel difference, retaining the
original nine filenames and adding ten chapter views plus the language menu.
Website ESLint, Stylelint, Astro typecheck and whitespace checks passed. The local
preview is open at `http://127.0.0.1:4178/`. Store URLs remain intentional placeholders.

**Coordination:** Task 2 owns the motion service/tests, Task 3 owns website copy/locales,
and Task 1 owns the page/CSS/asset. Their shared interface is the selectors and callbacks
documented above. Existing dirty changes are preserved; execution stays in this checkout.

## Overview

**Creative North Star: "TOCus"**

The approved homepage uses warm cream surfaces, cocoa download actions, rounded Fredoka headings, and the supplied capybara identity. A large peeking character introduces one browser that tells the product story through scroll.

The website shares its visual foundations and controls with the extension. Product demonstrations use the real breathing renderer and statistics presentation. The public homepage, Privacy, and Support stay light independently of browser appearance; the browser demonstration also owns an explicit light brown theme. The homepage does not import or load a 3D model. The original model remains isolated in `/mascot-lab`.

**Key Characteristics:**

- Light cream surfaces, brown ink, and terracotta actions.
- Fredoka headings paired with the shared system body stack.
- Pill actions, gently rounded product surfaces, and fine semantic dividers.
- Spacious responsive composition around five matching product scenes.
- Scroll-owned progress within a stable native-sticky browser, with reduced-motion support.

**Source evidence:** [shared palette, radius, and spacing tokens](../../packages/theme/tokens.scss), [shared type scale](../../packages/theme/typography/_scale.scss), [shared control theme](../../packages/ui/src/theme.ts), [shared component styles](../../packages/ui/src/styles.scss), [homepage](src/components/home-page/page.tsx), [website styles](src/styles/global.scss), [product demonstration](src/components/product-demo/index.tsx), [demo styles](src/components/product-demo/style.scss), and [story motion](src/services/story-motion/index.ts). Brand commitments come from [PRODUCT.md](PRODUCT.md). Approval and the implementation checklist are recorded above.

The frontmatter records the active light brown palette and observed website type values. The extension's dark palette remains outside the public website contract. Runtime ownership remains in `@tocus/theme` and `@tocus/ui`: use their semantic CSS variables and components in implementation.

## Colors

The palette moves between warm paper, clay, and deep brown, with contrast assigned through semantic foreground and background pairs.

### Primary

- **Terracotta action:** `action` marks filled and outlined actions, links, the brand, current story headings, and selected product values. Pair filled actions with `on-action`.
- **Clay sphere:** `breathing-sphere`, its highlight, and its shadow describe the real breathing object.

### Neutral

- **Warm paper:** `surface` is the page canvas and statistics frame. `surface-container` groups product information with a quiet tonal change.
- **Brown ink:** `on-surface` carries headings and ordinary text. `on-surface-muted` carries descriptions, annotations, and secondary labels.
- **Clay stage:** `stage-start`, `stage-middle`, and `stage-end` form the breathing environment. Privacy stays on the page paper; stage supporting copy uses `on-stage-muted`.

The shared theme derives divider, outline, glass, and focus colors from these roles. Keep its existing CSS `color-mix()` expressions and fallback behavior. The demo's neutral browser chrome and illustrative YouTube colors are local scene materials, not additional brand palettes.

**The Shared Palette Rule.** Use the existing semantic theme roles; explicitly select light appearance for public website pages and light brown for the demonstration.

## Typography

**Display Font:** Fredoka Variable with the shared rounded and sans-serif fallbacks.

**Body Font:** the shared system UI stack. No separate monospace identity is established.

Fredoka gives the product a soft, friendly heading voice. Body and control text stay familiar and direct. Heading weight remains consistent, while size and spacing establish hierarchy.

### Hierarchy

- **Hero display:** the `display-hero` role is the homepage's fluid override of the shared display style; its desktop measure is capped at 23 characters.
- **Section display:** `display-section` is the smaller fluid heading used across major website sections.
- **Headlines:** `headline-medium` serves story and feature titles and the breathing phase. `headline-small` supports compact headings and secondary statistics; `headline-large` gives the primary statistic more emphasis.
- **Titles:** `title-large` is used for statistics headings, narrower story headings, and the narrow breathing phase.
- **Body:** `body-large` is the website baseline; `body-medium` supports compact prose; `body-small` handles annotations and secondary information.
- **Labels:** `label-large` describes controls and navigation. The shared badge uses `label-medium` with natural casing.

The frontmatter's shared-role values include the existing noncompact scale factor (1.15) at the normal size unit (1rem). They are not the unscaled literals in the Sass role map. The fluid website display overrides bypass that size calculation while retaining the shared family and weight.

At widths up to 48rem, the hero uses `clamp(2.7rem, 10.4vw, 4.5rem)` and a maximum measure of 15 characters. The introductory description is capped at 43 characters on desktop and 32 on mobile. Headings balance wrapping; prose uses pretty wrapping. Keep all ten locales in these roles with literal copy. Compact chapter labels wrap within equal-width mobile navigation cells.

**The Two Voices Rule.** Use Fredoka for brand and heading roles and the shared body stack for prose and controls.

## Layout

The centered shell has a maximum width of 76rem and fluid outer gutters through `min(76rem, calc(100% - clamp(2.5rem, 8vw, 8rem)))`. Section spacing follows the website section token; component spacing follows the shared quarter-rem-based scale.

The hero centers the headline and direct download action above the peeking mascot. Its paws meet the browser edge. The story occupies 280svh with one stable native-sticky browser, one changing caption above it, and a compact chapter rail below it. There is no side-by-side instruction list. A four-part timing diagram explains the pause and allowance; schedule and site exceptions use an open two-column strip.

At widths up to 48rem, supporting sections and the timing diagram stack; the mascot occupies almost the full content width. The header retains its direct download link. The shared statistics grid collapses to one column at 42rem. At widths up to 40rem the browser stage uses a height-capped 4:5 ratio, leaving room for the caption and five navigation controls in the viewport.

Short landscape screens reduce the sticky offset and cap the stage width from the available height. CSS owns the frame geometry at every size, including reduced motion; scrolling never scales the frame or applies JavaScript pinning.

## Elevation & Depth

Most reading surfaces use open space, fine borders, and tonal changes. Physical depth belongs to the clay imagery, breathing sphere, browser demonstration, and packaged overlays. The product stage uses the existing three-stop diagonal gradient; gradients are part of this world.

The browser frame has one diffuse shadow (`0 1.6rem 3.5rem -1.6rem #39261e3d`). The shared theme also defines `--tocus-shadow-soft` for components that explicitly request soft elevation. The website styles and story-motion service own the corresponding implementation.

**The Purposeful Depth Rule.** Use tonal surfaces and dividers for ordinary content; reserve ambient elevation for an actual stage, overlay, or shared component that requests it.

Desktop section reveals move upward into place and the mascot has a small scroll-linked drift. Scroll position selects the scene and scrubs the production breathing frame; no wall clock drives the demonstration. System reduced motion removes optional transforms and retains a still sphere, chapter navigation, and Continue. There is no separate motion toggle.

## Shapes

Shared small and medium radii soften fields and product information; the large radius defines larger website containers. Primary, outline, light, and subtle buttons use the full pill radius. The statistics grid retains its actual medium-radius product tiles.

The browser frame uses its own rounded window silhouette, with a smaller radius on narrow screens. Circular window dots are decorative browser context. The supplied capybara silhouette and clay sphere provide the organic forms; they do not require every text section to become a rounded box.

## Components

### Buttons

Pill actions use the shared Mantine-backed `Button`, including keyboard semantics and focus handling.

- **Primary:** filled action and on-action pair, used for Continue in the pause scene.
- **Outline:** transparent surface with the action-colored border and label; retained as an available shared primitive.
- **Subtle:** transparent surface with ordinary text; hover uses the container tone. Chapter navigation adapts this variant to wrapping heading text and automatic height.
- **Light:** the shared informational surface and border; retained as an available shared primitive.
- **States:** filled hover mixes the action color toward the ordinary foreground; outlined and subtle hover use the container tone. Disabled buttons retain their semantic colors at reduced opacity (0.6). Keyboard focus uses the shared focus ring (3px) with an offset (2px).

The default geometry is recorded in frontmatter. Explicit large and compact sizes remain owned by the component library; do not force the default height over them.

### Inputs / Fields

The shared text field uses a paper surface, ordinary foreground, a semantic divider border, and the small radius. Focus changes the border to the shared focus color and adds the visible keyboard ring. Disabled and error roles remain owned by the shared theme. These are available product primitives; the homepage does not add a settings form.

### Chips

The shared badge is a compact, naturally cased label with a container background and muted foreground. It belongs to the existing component library. Its presence in this record does not prescribe badges or eyebrows for the homepage.

### Cards / Containers

The statistics preview embeds the extension's actual `StatisticsSummary` inside a large-radius frame. Its metric tiles use the shared medium radius and container tone; the first metric spans the row and receives a quiet action tint. The preview visibly identifies its data as examples and retains the estimate explanation.

Reuse the actual [statistics component](../extension/src/features/statistics/components/settings-screen/index.tsx) and [its styles](../extension/src/features/statistics/components/settings-screen/style.scss). This is a product information pattern, not a generic marketing card treatment. The feature strip and supporting prose remain open in the implemented homepage.

### Navigation

The homepage, Privacy, and Support headers contain the brand and a direct “Download TOCus” link. Underlines and the shared action color identify links. The homepage footer carries Privacy, Support, source, and an in-place language menu; without JavaScript it renders all ten locale links. The current locale is marked with `aria-current`. External links include the shared external-link SVG and open in a new tab. The creator link uses a bundled favicon and the existing UTM-tagged destination.

The hero and final download section use one filled text button with a bundled icon for the detected browser, followed by plain text links to the other stores. Browser detection runs locally after hydration; static and unknown-browser output defaults to Chrome. Every download destination comes from [the shared download configuration](src/config/downloads/index.ts). Its deliberate placeholder URLs are authorized development content and remain marked for replacement before publication.

Use shared SVG artwork for icons. Browser context uses drawn SVG paths rather than text glyphs.

### Product Demonstration

The browser stage matches five visible chapters: choose websites, visit YouTube, take the production breathing pause, Continue, and browse with the default five-minute allowance. Scroll progress selects sites, paints the breathing renderer, and advances the illustrated allowance from 5:00 toward 4:30. Reversing scroll reverses the illustration. The browser chrome and illustrative video thumbnails are decorative; this surface has no trial, replay, or next-pause controls.

Chapter title buttons use the same document positions as scrolling and expose the current step. Continue is disabled during the pause, becomes available in the Continue chapter, and moves focus and the viewport to the browse chapter. A polite status describes scene changes without announcing every countdown frame. Reduced motion keeps this navigation and a still sphere. Static output retains the first illustration, all explanations, downloads, and ordinary links; enhanced scene navigation requires JavaScript.

**The Real Interaction Rule.** Reuse product behavior and components for demonstrations, and give each focusable control its advertised effect.

### Brand and Mascot

Use the shared `Brand` component for the TOCus wordmark and capybara mark. The homepage uses the generated raster asset `public/images/mascot-peek.webp`, preserving the reference character's warm orange fur and brown paws. It has no canvas or model dependency. The active imported mesh, authoring pipeline, and original character reference remain available in the separate mascot lab; superseded raster poses and unreferenced procedural sculpting code are not retained in the application.

Supported-media artwork is locally packaged and accompanies explicit names for YouTube, Netflix, Twitch, HBO Max, Prime Video, and Disney+. These identify playback support, not partnerships. Preserve the existing raster provenance records when reusing the mascot, creator favicon, and service artwork.

## Do's and Don'ts

### Do:

- **Do** implement colors, type, radii, and controls through the shared TOCus theme and UI package.
- **Do** pair Fredoka headings with the shared body stack and allow localized copy to wrap.
- **Do** preserve the approved capybara identity, peeking pose, and warm materials.
- **Do** reuse the real breathing renderer and statistics presentation when demonstrating the product.
- **Do** identify example statistics and retain the distinction between estimates and measured totals.
- **Do** keep links, keyboard focus, footer language selection, and chapter controls operable.
- **Do** let reduced motion remove optional animation while preserving the stable frame and chapter navigation.

### Don't:

- **Don't** turn the demo's illustrative YouTube scene, browser chrome, or the mascot prototype into a new global visual system.
- **Don't** replace SVG icons with decorative text glyphs.
- **Don't** turn the statistics tiles into a universal marketing card template.
- **Don't** use nonfunctional focusable controls to imply an interaction.
- **Don't** invent testimonials, partner claims, or visitor statistics; keep development store placeholders explicit in their central configuration.

Not canonized: the inherited Privacy and Support eyebrow labels are a craft-floor exception in those documents, not a heading pattern for future surfaces.
