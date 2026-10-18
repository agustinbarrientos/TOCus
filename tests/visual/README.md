# Visual tests

Run on macOS 26 ARM64 with the locked Playwright Chromium and scrollbars set to **When scrolling**:

```sh
pnpm exec playwright install chromium
pnpm test:visual
```

References: 106 original extension captures in component `__snapshots__/chromium/` folders, four supplemental Quick links empty and populated settings captures in that component's snapshot folder, 12 regional onboarding captures in `__snapshots__/chromium-macos26-arm64/`, and 10 website captures in `apps/website/src/components/home-page/__snapshots__/chromium/`. The 106 original extension hashes and case registrations are checked against `originals/inventory.json`; the new settings references use the same canonical capture platform and comparison settings.

Extension and website comparisons use `threshold: 0.01`; regional comparisons use `threshold: 0.025`. All use `maxDiffPixels: 0`. Preserve capture geometry, inputs, fonts, timing, and comparison settings; do not hide content or add retries to conceal regressions.

Use `--project chromium-originals`, `chromium-onboarding`, `chromium-website`, or `snapshot-comparison` for focused runs. The comparison algorithm's frozen fixture images are not UI baselines.

The maintainer has given standing approval to update affected baselines for intended, reviewed visual changes without asking again. Review expected, actual, and diff images before replacing each reference. Investigate unexpected differences and resolve their cause; a failed comparison alone is not approval to accept a regression. Never hide differences or change thresholds to make a comparison pass. Preserve capture geometry, inputs, fonts, timing, and comparison settings when updating references. `pnpm test:visual:update` updates website references only; component helpers reject update flags. Component replacements must update inventory hashes. Run normal comparisons again after updates.

Diagnostics: `test-results/visual/` and `playwright-report/visual/`. CI retains the `visual-failure-diagnostics` artifact for seven days.
