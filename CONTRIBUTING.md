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

Visual comparisons require macOS 26 ARM64 and explicit approval before replacing baselines. See the [visual testing guide](tests/visual/README.md).

## Builds

```sh
pnpm build
pnpm zip:chrome
pnpm zip:edge
pnpm zip:firefox
```

ZIPs go to `apps/extension/.output/`; the website goes to `apps/website/dist/`. Build release packages from the tagged commit. See [Firefox review instructions](apps/extension/FIREFOX-REVIEW.md), [store assets](tools/store-assets/README.md), and [shared UI usage](packages/ui/README.md).

Contributions are licensed under the [MIT License](LICENSE).
