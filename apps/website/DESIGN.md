---
name: TOCus website
description: A warm riverside hero followed by clear illustrated product explanations.
colors:
  paper: "#fffaf4"
  ink: "#302219"
  hero-heading: "#302016"
  description: "#71665d"
  peach: "#ffeadb"
  landscape-middle: "#fddcc5"
  landscape-front: "#fbd0b4"
  clay: "#bc704b"
typography:
  display-hero:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 4.2vw, 5.4rem)"
    fontWeight: 700
    lineHeight: 1.13
    letterSpacing: "0.005em"
  display-section:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 4.4vw, 3.4rem)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  feature-heading:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(1.35rem, 2.5vw, 1.8rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  feature-body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(1rem, 1.7vw, 1.2rem)"
    fontWeight: 400
    lineHeight: 1.55
  browser-availability:
    fontFamily: "'Fredoka Variable', ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', system-ui, sans-serif"
    fontSize: "clamp(16px, calc(14px + 0.25vw), 18px)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0"
---

# Design system: TOCus website

The September 22, 2026 direction pairs the retained interactive riverside hero with an open, illustrated page below it. Warm paper, brown ink, rounded Fredoka headings and soft clay artwork connect the product explanation to the capybara's world. This is the current page contract; the older pinned browser story, chapter player, chart preview and raster beach composition have been removed.

## Page composition

1. A full-width riverside hero with the brand, language selector, headline and browser download links.
2. A four-step row without a section heading: open a site, pause for 10 seconds, Continue, and browse for 5 minutes. The durations illustrate the product sequence; they are configurable in the extension.
3. "A calmer way to browse": six open feature blocks describing active hours, per-site schedules, video pausing, statistics, local storage and open source.
4. "Take a moment to pause": a repeated download group inside a cream rounded panel, surrounded by peach landscape waves and supplied plant and sun illustrations.
5. A compact peach footer with the brand, Privacy, Source code and the existing author credit. Static locale links remain available without JavaScript.

The content follows normal document flow. There is no pinned section, simulated browser, chapter navigation, statistics selector or homepage settings form. The illustrated steps are explanations, not focusable controls. Feature blocks use whitespace rather than cards or borders around every item.

## Hero and motion

The hero occupies `100dvh` plus its transition height, with `100svh` as the fallback. The transition begins after the first viewport: it is 7rem high on desktop and 4.5rem at widths up to 48rem. The SVG extends 2px past the clipped hero edge to prevent a seam at fractional pixel boundaries. The live scene and poster fill the entire height. Centered copy sits above the capybara; layered peach and cream waves meet the page paper below.

The header contains the shared brand and a pill-shaped language selector with 18px Fredoka text. It has no separate download action. The language menu uses native language names, marks the selected locale and supports keyboard navigation. The hero and lower download panel provide the download actions.

The initial camera rests at a 42-degree yaw, matching the authored three-quarter view. Horizontal pointer movement maps the center of the page to this resting view while preserving the -50 and +50 degree endpoints; the leftward orbit therefore covers more distance. Leaving the hero returns to the resting view with a slower ease. Camera height, target and orbit radius stay fixed. Touch input does not orbit the camera. The sunset lights the seated character from behind, water waves wash the shoreline, and clicking visible water adds a bounded ripple. Plants retain a subtle ambient sway without a hover response. The local model includes an automatic 12-second mate-drinking and blinking animation. A separate head turn follows the camera continuously, including during a sip, with the cup and hand following the mouth as the mate rises.

`public/models/riverside/hero.glb` contains the character, mate, land and vegetation. The website supplies sky and water through `src/services/riverside-hero/`. The meshopt-compressed model is 2,380,036 bytes and contains 96,155 triangles; these asset counts exclude the runtime environment and do not establish a frame-rate guarantee.

`public/images/riverside-hero.webp` is a 2560 by 1440 capture of the web renderer at animation time zero and the 42-degree resting view, with the initial head turn already applied. Its centered cover crop matches the live camera framing on narrow and ultrawide screens. Recapture it after model, camera, lighting or initial-pose changes to keep the loading handoff aligned. The poster is visible during loading and remains the presentation without JavaScript, with reduced motion or after a graphics failure. Reduced motion avoids loading the scene. Rendering pauses when the hero is offscreen, the page is hidden or a history entry is cached. Disposal releases owned graphics, event listeners, observers and pending requests. The decorative canvas is hidden from the accessibility tree; ordinary HTML contains all product information and actions.

## Typography and color

Use Fredoka for the brand, headings, step labels and the complete browser-availability line. Descriptive prose and primary download controls use the shared system UI stack. Both the "Also available on" label and browser links share one fluid 16-18px Fredoka treatment, consistent weight and aligned local icons. Text links underline on hover; they do not inherit mismatched heading or button styles.

The hero's desktop heading uses a maximum measure of 25 characters. At widths up to 48rem it uses `clamp(2.25rem, 8.3vw, 4.1rem)` and a maximum measure of 18 characters, with tighter overrides for short viewports. Step labels and feature titles share `clamp(1.35rem, 2.5vw, 1.8rem)` Fredoka at weight 600. Let translated text wrap naturally; balance headings and use pretty wrapping for prose.

The website explicitly uses the shared light appearance regardless of the browser's color preference. Its local paper is `#fffaf4` and ink is `#302219`. The tab favicon switches between local light- and dark-appearance SVGs to remain readable without changing the page theme. Warm peach landscape layers are decorative materials; shared controls still use semantic theme roles and the existing focus treatment. Feature descriptions use a quieter brown, while links remain distinguishable and keyboard focus stays visible.

## Responsive layout

The general shell is capped at 76rem with fluid gutters. The illustrated content has a narrower 70rem maximum and generous vertical spacing. The four steps use equal columns with short connecting rules on wide screens. At widths up to 35rem they form two rows and the connectors disappear.

The feature section is centered within a 56.25rem (900px at the default root size) maximum width. Features form two columns with three rows on wide screens and one column at widths up to 35rem. Icons, headings, descriptions and links are left aligned at every viewport width. Each block has one supplied image, a short heading and a compact description. The media feature includes a compact service-icon row; there are no example statistics. Privacy and source links sit below their respective descriptions. The feature headings include "Set a schedule for each site" and "It's 100% private"; the privacy description explains local storage, offline use and the absence of accounts.

The final cream download panel has a broad rounded silhouette and stays above the decorative landscape. The sun sits above its upper-right edge with 24px of clearance at rest. A native scroll timeline gives it a bounded 96px vertical drift, from 12px below its base position to 84px above it; reduced motion and browsers without scroll-timeline support keep it still. The final foreground wave overlaps the plant roots, with the illustrations behind that wave and the download panel above it. The plants and sun do not intercept input. On narrow screens the panel widens, decorations move toward its edges and the footer wraps without horizontal overflow. No content relies on a fixed-height text container.

## Artwork and downloads

The user-supplied page illustrations live in `public/images/homepage/`:

- `icon-clock.webp`, `icon-schedule.webp`, `icon-video-pause.webp`, `icon-stats.webp`, `icon-computer.webp` and `icon-open-source.webp` illustrate the six features.
- `decoration-plant-1.webp`, `decoration-plant-2.webp` and `decoration-sun.webp` frame the lower download section.

Artwork has explicit dimensions, empty alternative text when the neighboring text already provides its meaning, and lazy loading below the hero. The four-step row uses the supplied YouTube mark, a CSS clay sphere, an SVG check and an illustrative progress bar. Browser and supplied YouTube, Netflix and Twitch icons remain local SVG assets under `public/badges/`. Service icons have named alternative text and visually hidden duplicate text for ordinary text selection, with the duplicate excluded from the accessibility tree.

Both download groups use `DownloadLinks`: one filled pill for the detected browser followed by consistent text links for the alternatives. Browser detection runs locally after hydration; static and unknown-browser output defaults to Chrome. Store destinations stay centralized in `src/config/downloads/index.ts`. The development placeholder URLs, including Edge, are intentional and must be replaced with verified listings before publication.

The shared `Brand` supplies the wordmark and capybara mark. Both use the same dark ink and responsive sizing in the header and footer. Footer links and the author credit share 16px Fredoka text at weight 400 in dark ink. Privacy and Source code open in a new tab with visible external-link icons. The footer retains the bundled author favicon and existing tagged author URL. `public/images/capybara-mate.webp`, `public/models/mascot.glb` and their authoring source remain in use by `/mascot-lab`; they are not the homepage footer artwork.

## Content, privacy and accessibility

Keep the ten supported locales complete and use short, factual product copy. Website copy must not imply access to the visitor's extension settings or activity. Supported video services are examples of playback integration, not partnerships.

Preserve the skip link, semantic headings and lists, visible focus, real link destinations and useful server-rendered content. Without JavaScript, the hero poster, every explanation, download links and footer locale navigation remain available. Reduced motion removes optional animation without hiding information. Privacy and Support retain their own canonical English content and shared light styling.

No extension permissions, local data handling or shared extension interfaces are changed by this layout. Do not add accounts, analytics, remote asset requests or fabricated endorsements. Do not introduce nonfunctional controls to make the static explanation look interactive.

## Source ownership and verification

The homepage lives in `src/components/home-page/page.tsx` and its colocated `style.scss`. Shared page and retained hero layout live in `src/styles/global.scss`; download and language controls retain their component styles. The scene is owned by `src/components/riverside-hero/` and `src/services/riverside-hero/`. Brand and controls remain shared through `@tocus/theme` and `@tocus/ui`.

The former ProductStory, ProductDemo, TimingIllustration, StatisticsPreview, SupportedServices, homepage-motion and beach-scene implementations are removed, along with their owned styles, assets and tests. GSAP is no longer a website dependency. Keep future changes free of unused replacement variants.

Verify the production website with lint, type checks and browser tests for responsive geometry, local assets, language selection, downloads, static/reduced-motion content and hero lifecycle. Ten website screenshot cases cover localized desktop/narrow pages, the English dark-browser page and the narrow language menu. The obsolete ten story-chapter captures are removed. Refresh website references only with deliberate review on pinned macOS 26 ARM64; the extension's immutable screenshot policy remains separate and unchanged.
