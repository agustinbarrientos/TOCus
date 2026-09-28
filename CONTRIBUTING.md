# Contributing

Bug reports, translations, documentation, and code contributions are welcome. Search existing issues first; discuss substantial changes before starting. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Setup

Use the Node.js version in [.node-version](.node-version) and pnpm 12.5.1.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup:browsers
pnpm dev
```

On Linux, install missing browser dependencies with `pnpm exec playwright install --with-deps chromium firefox webkit`.

## Changes

- Name branches `<username>/<type>/<short-description>`; types are `enhancement`, `chore`, `fix`, and `feature`.
- Keep business logic in its domain, screen composition in features, and reusable controls in `packages/ui/`. Colocate tests.
- Develop behavioral changes test-first. Use shared components and tokens through `@tocus/ui`.
- Document declared types and functions with TSDoc/JSDoc, including `@since` for exports.
- Keep source and docs ASCII-only; translations use UTF-8. Do not hard-wrap prose.
- Preserve local-only operation, narrowly scoped permissions, keyboard access, contrast, and reduced motion. Do not add tracking, browsing-history collection, or medical claims.
- Keep builds, ZIPs, caches, secrets, and personal browsing data out of commits.

## Validation and pull requests

Run `pnpm check` for lint, types, unit coverage, builds, and browser tests. Describe the change and relevant validation in the PR; explain skipped checks and permission or storage changes. Include screenshots for visual changes.

Installed Chrome, Edge, and Firefox must also pass the same native extension journeys in CI. To reproduce them on Ubuntu/Debian x86_64, run `pnpm setup:installed-browsers`, build the three extension targets, then `pnpm test:installed-extension:linux`. Setup needs root or passwordless sudo to install browser and accessibility dependencies; the tests use disposable profiles and automated native permission dialogs. Browser versions are recorded in `test-results/installed-browser-setup/versions.txt`.

Visual comparisons require macOS 26 ARM64 and explicit approval before replacing baselines. See the [visual testing guide](tests/visual/README.md).

## Builds

```sh
pnpm build
pnpm zip:chrome
pnpm zip:edge
pnpm zip:firefox
```

ZIPs go to `apps/extension/.output/`; the website goes to `apps/website/dist/`. Build release packages from the tagged commit. For a Firefox source submission, run the Setup installation commands, then `pnpm build:firefox`; the unpacked extension is in `apps/extension/.output/firefox-mv2/`. See [store assets](tools/store-assets/README.md) and [shared UI usage](packages/ui/README.md).

Use one extension version and changelog across browsers. Label each fix with the affected browsers. Shared fixes go to all three stores; a browser-specific hotfix can go only to that store, with the others skipping that version. Mark pending versions `Unreleased`, then use the GitHub publication date in UTC (`YYYY-MM-DD`). Store approval dates can differ.

Contributions are licensed under the [MIT License](LICENSE).
