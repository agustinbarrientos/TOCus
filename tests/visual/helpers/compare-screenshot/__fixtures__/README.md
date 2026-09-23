# Comparison fixtures

`website-button.png` is a lossless 352 by 72 pixel crop starting at `(544, 316)` from `apps/website/src/components/home-page/__snapshots__/chromium/website-english-desktop.png` in commit `b1ca4ee50277e1e33cef4be1c7cd5fd23ebda378`.

The comparison self-tests use this frozen button to preserve the recorded September 14 CI rounded-edge color samples and the negative controls for layout, fill, text, dimensions, and transparency. Their coordinates are translated by the crop origin; their pixel values and comparison policy are unchanged. The surrounding pixels preserve the edge context used by the library's antialiasing comparison.

This is algorithm test data, not a current homepage reference. Do not refresh it when the website design changes. The twenty website visual baselines remain in the homepage component's snapshot directory.

`regional-continue-button.png` is a lossless 152 by 80 pixel crop starting at `(1164, 734)` from `tests/visual/__snapshots__/chromium-macos26-arm64/onboarding-language-portuguese-portugal.png` in commit `d5e504c871abea7a38543bd8bd1d44ad754133f0`.

The regional comparison self-tests use this frozen Continue button to preserve the twenty-four recorded CI edge-color samples and the negative controls for layout, text, dimensions, fill, and any extra changed pixel. All coordinates are translated by the crop origin; sample colors, mutation extents, thresholds, and zero-extra-pixel policies are unchanged. The crop retains surrounding pixels for the library's antialiasing comparison.

This is algorithm test data, not a current onboarding reference. Do not refresh it when onboarding copy or layout changes. Current regional UI baselines remain under `tests/visual/__snapshots__/chromium-macos26-arm64/`.
