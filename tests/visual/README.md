# Immutable original screenshot comparisons

The extension must match its 106 approved screenshots at the exact original component-owned paths and filenames. Expected PNGs are immutable except for the specifically approved Statistics text correction documented below. This includes approved images that were previously untracked. `tests/visual/originals/inventory.json` records every path and SHA-256 and is included in the repository for CI.

`pnpm test:visual` compares actual React/native fixtures against approved PNGs with `updateSnapshots: 'none'`. The original-image helper checks decoded dimensions and every RGBA pixel, with the narrowly bounded edge allowance below. Different PNG compression is harmless. Every run checks all reference file hashes. An unfiltered run requires exactly one registered case for every original path. Updating references to conceal regressions is prohibited. Failure artifacts remain in `test-results/visual/` and `playwright-report/visual/`.

## Approved Statistics text correction

On September 8, 2026, the project owner approved including recorded pause time in reclaimed time and rejected keeping legacy wording in historical fixtures. Eight Statistics references now show the corrected explanation: the Settings shell in light and dark mode, plus the standalone empty, narrow, populated light/dark, reset-confirmation and resetting views. Decoded RGBA comparison confirmed identical dimensions and every pixel outside the explanation; no layout, metric, control or background changed. The same 106 paths remain registered, with updated hashes for these eight images. The other 98 images, comparison rules and update-flag rejection remain unchanged. This specific correction does not authorize other baseline changes or fixture-only legacy copy.

The website reuses this production Statistics explanation. Its nine full-page references also reflect the corrected text in English, Argentine Spanish, Brazilian Portuguese and European Portuguese, including the English dark-browser capture. Longer translations wrap naturally and move the following sections by one line. The eleven story and language-menu references remain unchanged; no fixture-only legacy wording or comparison tolerance was added.

## Approved edge-rasterization allowance

Chromium can produce one-level RGB differences along rounded edges depending on prior component captures. This was reproduced in the archived renderer as well as the migrated fixture. On September 7, 2026, the project owner approved tolerating this tiny edge variance without replacing any original images.

The shared comparator remains exact by default. Original component comparisons opt in to an allowance only when dimensions match, both pixel alphas are fully opaque, and each RGB channel differs by at most **1 out of 255**. The pixel must lie between darker and lighter opaque neighbors in its immediate 3×3 neighborhood in **both** images; their summed RGB brightness must span more than three levels. This conservative edge heuristic does not prove the cause of a difference. It never admits larger RGB changes, transparency changes, flat fills, local extrema, or size changes.

Raw differing pixels and tolerated edge pixels are counted separately and attached with the untouched actual and expected images whenever they differ. Every pixel outside the allowance fails. Playwright retains `threshold: 0`; only when the raw guard finds no rejected pixels does its matcher receive the independently verified edge count as `maxDiffPixels`. Genuine failures use `maxDiffPixels: 0` for normal diff diagnostics and still face the raw guard. There are no filename exceptions, coordinate masks, fixed pixel budgets, image rewrites, or capture retries. Unit tests cover the accepted boundary and rejected color, alpha, layout, and mixed-difference cases.

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

The regional Appearance preview is frozen at zero progress on insertion, before its default-running clock can paint. The helper installs a temporary observer before the real Continue click, awaits the preview's update, verifies its still state, and disconnects the observer. Freezing only after the preview becomes visible allows an intermediate frame to affect its rounded-edge rasterization. This capture setup does not change production animation behavior or regional pixel tolerances.
