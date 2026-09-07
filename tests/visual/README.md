# Immutable original screenshot comparisons

The extension must match its 106 approved pre-migration screenshots at the exact original component-owned paths and filenames. Expected PNGs are immutable, including approved images that were previously untracked. `tests/visual/originals/inventory.json` records every path and SHA-256 and is included in the repository for CI.

`pnpm test:visual` compares actual migrated React/native fixtures using Playwright's supported matcher with `threshold: 0`, `maxDiffPixels: 0`, and `updateSnapshots: 'none'`. The original-image helper also checks decoded PNG dimensions and every RGBA pixel: Playwright's matcher alone can ignore anti-aliasing even with zero tolerance. Different PNG compression is harmless; different pixel values are not. Every run checks all original file hashes. An unfiltered run requires exactly one registered case for every original path. Updating originals to accept differences is prohibited. Failure artifacts remain in `test-results/visual/` and `playwright-report/visual/`.

## Capture platform and CI

The configured environment is pinned Playwright/Chromium1.62.1, macOS26 ARM64, device scale1, UTC, en-US, and packaged local fonts. CI's dedicated `macos-26` job runs comparisons and never accepts images. Cross-OS pixel equivalence is not assumed; Linux retains functional checks. Configuring the hosted job is not evidence of a successful hosted run. Original pixel failures must remain visible until repaired.

Chromium owns pixels; Firefox and WebKit retain independent functional suites. Fonts settle before capture. Every case must reproduce original inputs, viewport, theme, palette, scrolling and component crop. No product styling, geometry, text, controls or errors may be hidden to force a match.

Original component comparisons capture once, matching the archived `visualDiff` behavior, then use Playwright's supported buffer snapshot matcher. They do not repeat captures to obtain a different raster. Preserve the document paint origin as well as crop dimensions: archived isolated components used the native8px body margin, while the full Settings shell explicitly used margin0. The viewport height must also match the archived case, including when the component exceeds it.

Preserve event timing too. Some archived fixtures dispatched native events and awaited their component updates before the first paint. The replacement fixtures invoke the same production handlers during mounting; asynchronous onboarding navigation uses React's public `act` and awaits the actual persistence/readiness promises. They do not assign internal controller state or add arbitrary frame/microtask loops. Independent functional suites still test physical mouse and keyboard input, persistence, permissions and recovery.

Original-only traces retain events, sources and screenshots, but disable DOM snapshots. A controlled comparison showed that DOM snapshot inspection itself changes a few Chromium glyph-edge samples; the archived runner did not perform that inspection. This does not disable screenshot capture or either pixel assertion.

Caret suppression is conditional on real text-editing focus. Playwright's default `caret: 'hide'` writes inline styles to every input, including unfocused fields; independent paired captures reproduced a rounded-edge raster change from that unnecessary invalidation. The helper reads active focus, including nested open shadow roots, without changing focus, selection, styles or layout. Captures keep `caret: 'initial'` when no editable caret exists and retain suppression for focused text fields. This does not change the capture count, expected image bytes or pixel comparison.

Failed CI runs retain expected/actual/diff images, HTML reports and traces in `visual-failure-diagnostics` for seven days. Inspect actual differences and repair their causes, without changing original expected PNGs.

## Active coverage inventory

The original inventory has106 comparisons. Registration completeness is enforced by the gate, not inferred from an image count. Restoration remains red until registrations and actual differences are resolved.

| Surface | Original comparisons |
| --- | --- |
| Pause and allowance warning | 8 |
| Onboarding steps and shell | 20 |
| Popup | 7 |
| Shared appearance controls and theme states | 6 |
| Protected-site items/list | 6 |
| Settings screens/shell | 49 |
| Statistics | 10 |

The 12 regional onboarding images retain their existing names under `tests/visual/__snapshots__/chromium-macos26-arm64/` and run in `chromium-onboarding`. They cover Spanish/Vos, Portuguese/Brazil and Portuguese/Portugal through actual Language → Appearance → Websites navigation, including a narrow Appearance capture scrolled to the controls. These are supplemental full-flow references, not pre-migration originals. Their previous rejected-migration captures must not be used to judge the restored design; compare the production layout with the immutable component references before explicitly refreshing regional images.

Superseded centralized diagnostic captures and their excluded capture specs have been removed. The website's 20 reviewed images live under `apps/website/src/components/home-page/__snapshots__/chromium/`, covering localized landing pages, the five story chapters on desktop and mobile, and the mobile language menu.

## Case API and commands

Run a bounded original comparison with `pnpm test:visual --project chromium-originals --grep 'interruption-screen-ready.png'`. Explicit grep permits partial investigation, but hash checks always run. Local servers can be reused; CI starts fresh servers.

Register cases through `originalCase(path, callback)` and capture with `compareOriginal(page, path, locator?)` from `originals/helpers`. Supply the exact repository-relative original filename. Closed-shadow targets can use `compareOriginal(page, path, undefined, { clip })` with the existing fixture bridge's actual rectangle. Expected hashes are checked before and after comparisons, including failures. Both APIs reject update flags before capture. `pnpm test:visual:update` is restricted to the website project and still requires deliberate review; it cannot update originals.

Run regional flows with `pnpm test:visual --project chromium-onboarding`. Each state is captured once and checked with the same literal RGBA comparator, without image retries or tolerance changes. A deliberately scoped `--project chromium-onboarding --update-snapshots=all` may refresh only those supplemental images after review; follow it with a separate normal comparison run. All 106 original hashes are still audited even when running only regional or website cases.
