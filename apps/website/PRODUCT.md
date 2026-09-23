# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who enjoy the internet but want a moment to reconsider opening distracting websites. First-time visitors may not know what a browser extension does.

## Product Purpose

TOCus adds a breathing or quiet pause before selected websites, followed by a configurable browsing allowance. The website explains this sequence with a riverside hero, a four-step illustration and concise feature descriptions.

## Capabilities and Constraints

- Adjustable waits, daily wait increases and caps, browsing allowances, and weekly schedules.
- A website can have its own active days and hours. Pause durations and the countdown remain shared.
- Local statistics include completed waits, reconsidered visits, focused pause time, allowances, and estimated browsing time avoided. Estimates are not measured savings.
- The extension has no accounts, tracking, or external-server calls. Its settings and statistics remain on the device.
- Supported streaming-site video playback pauses during an interruption and resumes only if previously playing.
- The current implementation matches website hosts; do not advertise path-specific or custom wildcard rules.
- Website example data must be labeled as illustrative. The website must not read extension or visitor statistics.
- The user permits placeholder store URLs during development. Keep them centralized in `src/config/downloads/index.ts`, clearly marked, and replace them before publication. Hosting details remain a publication prerequisite.

## Brand Commitments

Preserve the TOCus name, supplied capybara mark, Fredoka headings, shared theme, warm clay materials, concise literal copy and accessible controls. The current homepage uses the local animated riverside model with a seated capybara holding a mate, vegetation, moving water and sunset lighting. A packaged poster captured from the live scene at its 42-degree resting view provides the matching loading, static and reduced-motion presentation. Pointer movement keeps the existing -50 and +50 degree camera limits, then returns more slowly to rest when the pointer leaves. Plants sway gently without a hover response. The earlier mascot prototype remains available in its separate lab.

The public website stays light independently of browser appearance. Its homepage header contains the brand and a compact language-selector pill. The hero headline sits above a primary browser download action and consistent 16-18px Fredoka alternatives with local browser icons.

Below the hero, the page contains four illustrated steps, six open feature blocks and a repeated download group framed by supplied plant and sun artwork. The steps show opening a site, a 10-second pause, Continue and a 5-minute browsing allowance as an example of the configurable sequence. Feature blocks explain active hours, per-site schedules, video pausing, local statistics, on-device storage and open source. They use a centered 900px maximum-width container with left-aligned artwork and copy. The page does not show example statistics. The headings "Set a schedule for each site" and "It's 100% private" are supported by descriptions of per-site active times and browser-local settings and statistics. The footer provides Privacy, Source code, author credit and a static locale-navigation fallback. Privacy and Source code open in a new tab and include external-link icons. The former browser story player and interactive statistics preview are removed.

## Evidence on Hand

The extension's actual timing, schedule, media-pause and statistics behavior; the shared TOCus theme and brand; packaged browser icons; the local riverside scene and poster; and user-supplied clay feature and decoration images. No testimonials, customer logos or aggregate user statistics are available.

## Product Principles

- Explain the pause and allowance sequence plainly, including that browsing begins after Continue.
- Keep privacy and personal statistics prominent and understandable.
- Use short sections with one idea each and examples that do not imply visitor measurements.
- Preserve the extension interface while improving its marketing website.
- Treat the 3D hero as optional decoration: all information and actions remain available in ordinary HTML.
- Remove superseded components, styles and assets when replacing page sections.

## Accessibility & Inclusion

Keep semantic headings and lists, a skip link, keyboard-accessible downloads and language selection, visible focus, readable contrast and layouts that allow translated text to wrap. The four-step explanation is static content rather than simulated controls. Feature blocks stack on narrow screens without clipping.

The animated hero is decorative and hidden from the accessibility tree. Reduced motion avoids loading it, and its local poster remains available without JavaScript or WebGL. Scene rendering stops when offscreen or the page is hidden. Ten locales remain supported; footer locale links are available without JavaScript. Privacy and Support keep their canonical English content.

## Local Development

Run the website on port 4322. Port 4321 belongs to the author's personal site and must remain available to it.
