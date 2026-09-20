# Comparison fixture

`website-button.png` is a lossless 352 by 72 pixel crop starting at `(544, 316)` from `apps/website/src/components/home-page/__snapshots__/chromium/website-english-desktop.png` in commit `b1ca4ee50277e1e33cef4be1c7cd5fd23ebda378`.

The comparison self-tests use this frozen button to preserve the recorded September 14 CI rounded-edge color samples and the negative controls for layout, fill, text, dimensions, and transparency. Their coordinates are translated by the crop origin; their pixel values and comparison policy are unchanged. The surrounding pixels preserve the edge context used by the library's antialiasing comparison.

This is algorithm test data, not a current homepage reference. Do not refresh it when the website design changes. The twenty website visual baselines remain in the homepage component's snapshot directory.
