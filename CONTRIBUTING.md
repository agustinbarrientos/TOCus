# Contributing

Bug reports, translations, documentation, and code contributions are welcome. Search existing issues first; discuss substantial changes before starting. Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Setup

Use the Node.js version in [.node-version](.node-version) and pnpm 12.14.0.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup:browsers
pnpm dev
```

On Linux, install missing browser dependencies with `pnpm exec playwright install --with-deps chromium firefox webkit`.

Dependency releases must be at least two days old. The workspace enforces a strict 2,880-minute cooldown for direct and transitive dependencies, and Dependabot uses the same two-day cooldown for npm version updates. TypeScript stays at 6.0.3, including transitive resolutions, until its build compatibility is verified separately. Refresh the other packages with `pnpm -r update --latest '!typescript' --depth Infinity`, then review the lockfile and run `pnpm install --frozen-lockfile` before the audit and checks. Repeat installs run workspace setup so generated extension types stay available.

## Changes

Every pull request with a user-visible change must update `CHANGELOG.md` under the next version marked `Unreleased`. Describe the resulting behavior and affected browsers in that pull request; do not defer entries to a release-only pull request.

- Name branches `<username>/<type>/<short-description>`; types are `enhancement`, `chore`, `fix`, and `feature`.
- Keep business logic in its domain, screen composition in features, and reusable controls in `packages/ui/`. Colocate tests.
- Develop behavioral changes test-first. Use shared components and tokens through `@tocus/ui`.
- Document declared types and functions with TSDoc/JSDoc, including `@since` for exports.
- Keep source and docs ASCII-only; translations use UTF-8. Do not hard-wrap prose.
- Preserve local-only operation, narrowly scoped permissions, keyboard access, contrast, and reduced motion. Do not add tracking, browsing-history collection, or medical claims.
- Keep builds, ZIPs, caches, secrets, and personal browsing data out of commits.

## Validation and pull requests

Run `pnpm check` for lint, types, unit coverage, builds, and browser tests. Describe the change and relevant validation in the PR; explain skipped checks and permission or storage changes. Include screenshots for visual changes.

Run browser suites from an environment that permits local listening sockets and browser process registration. Restricted execution on macOS can abort Chromium during application or IPC registration before a test opens the application. For startup diagnostics, use `pnpm test:build-browser --max-failures=1` to stop after the first failure instead of repeatedly launching a blocked browser. Rerun the normal suite after correcting the execution environment; do not suppress crashes or weaken assertions.

Installed Chrome, Edge, and Firefox must also pass the same native extension journeys in CI. To reproduce them on Ubuntu/Debian x86_64, run `pnpm setup:installed-browsers`, build the three extension targets, then `pnpm test:installed-extension:linux`. Setup needs root or passwordless sudo to install browser and accessibility dependencies; the tests use disposable profiles and automated native permission dialogs. Browser versions are recorded in `test-results/installed-browser-setup/versions.txt`.

Visual comparisons require macOS 26 ARM64. The maintainer has given standing approval to update affected baselines for intended, reviewed visual changes without asking again. Review expected, actual, and diff images; investigate unexpected differences rather than accepting every failed comparison. Preserve capture and comparison settings. See the [visual testing guide](tests/visual/README.md).

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
