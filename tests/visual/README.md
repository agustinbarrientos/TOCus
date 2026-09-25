# Visual tests

Run on macOS 26 ARM64 with the locked Playwright Chromium and scrollbars set to **When scrolling**:

```sh
pnpm exec playwright install chromium
pnpm test:visual
```

References: 106 extension captures in component `__snapshots__/chromium/` folders, 12 regional onboarding captures in `__snapshots__/chromium-macos26-arm64/`, and 10 website captures in `apps/website/src/components/home-page/__snapshots__/chromium/`. Extension hashes and case registration are checked against `originals/inventory.json`.

Extension and website comparisons use `threshold: 0.01`; regional comparisons use `threshold: 0.025`. All use `maxDiffPixels: 0`. Preserve capture geometry, inputs, fonts, timing, and comparison settings; do not hide content or add retries to conceal regressions.

Use `--project chromium-originals`, `chromium-onboarding`, `chromium-website`, or `snapshot-comparison` for focused runs. The comparison algorithm's frozen fixture images are not UI baselines.

Baseline replacements require explicit design approval and review of expected, actual, and diff images. `pnpm test:visual:update` updates website references only; component helpers reject update flags. Approved component replacements must update inventory hashes. Run normal comparisons again after updates.

Diagnostics: `test-results/visual/` and `playwright-report/visual/`. CI retains the `visual-failure-diagnostics` artifact for seven days.
