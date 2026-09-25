# Store assets

Captures production UI and composes local artwork, logos, and translated text. Run from the repository root after installing dependencies and Playwright Chromium.

```sh
pnpm store:assets
pnpm store:assets --locale en
pnpm store:assets --locale es-tu,es-vos
pnpm store:assets --only promos
pnpm store:assets --store edge --only promos
pnpm store:assets --store firefox --locale en
pnpm store:assets --only og
pnpm store:assets --only og --sync-website
```

## Outputs

| Target | Images | Directory |
| --- | --- | --- |
| Chrome | Five 1280 x 800 screenshots per locale; English 440 x 280 and 1400 x 560 promos | `.output/` |
| Edge | Localized promos in both sizes; transparent 300 x 300 logo | `.output/edge/` |
| Firefox | Five 2400 x 1800 screenshots per locale | `.output/firefox/` |
| Website OG | 1200 x 628 cards in all ten locales | `.output/og/` |

Each directory includes an `index.html` preview and a manifest with dimensions and hashes. Output is ignored by Git. Add `--locale` to limit any export. Edge exports also include `search-terms.txt`; omitting `--only promos` includes screenshots.

Mozilla Add-ons uses one shared screenshot set with localized captions. Use the five English Firefox images for the listing; other locale exports are available for separate promotional use.

Review OG previews before `--sync-website`, which copies finished images to `apps/website/public/images/og/`. Generators, master artwork, and previews stay outside production builds.

## Editing

- `lib/catalog.mjs`: screenshot order, captions, mascot poses, and Chrome promo copy.
- `lib/edge.mjs`: Edge translations and search terms.
- `lib/capture.mjs`: production UI states and readiness.
- `lib/composition.css`: screenshot and promo layout.
- `lib/og.mjs` and `lib/og.css`: OG headlines, fonts, and layout.
- `assets/`: reusable artwork and illustrative statistics. Exports do not generate new artwork.

OG headlines use Fredoka, Chiron GoRound TC for Japanese, and Nunito for Russian. The latter fonts retain their SIL Open Font Licenses beside the files. Sources: [Chiron GoRound TC](https://github.com/google/fonts/tree/main/ofl/chirongoroundtc) and [Nunito](https://github.com/google/fonts/tree/main/ofl/nunito).

Statistics are fixed demonstration data, not measured results; the estimate already includes pause time. Schedule fields are native time controls whose 12/24-hour display follows browser and system preferences.

For manual captures, use `--input /path/to/screenshots` with filenames `1-<language>.png` through `5-<language>.png` (breathing, websites, schedule, statistics, appearance). Input suffixes are `en`, `es`, `es_ar`, `de`, `fr`, `it`, `ja`, `pt_br`, `pt`, and `ru`.

## Validation

Run `pnpm test:store-assets`, then review affected locales with the generator. Exports check dimensions, color channels, text fit, fonts, and image decoding. Use the same OS and locked Playwright version for pixel comparisons. Captures use an isolated temporary profile, block external requests, and bind only to loopback.
